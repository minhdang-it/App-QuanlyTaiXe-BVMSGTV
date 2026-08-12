import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { addPending, listPending, pendingCount, removePending, updatePending } from './offline';
import { supabase } from './supabase';
import { getCurrentLocation, getErrorMessage, normalizePhone, uid } from './utils';
import { optimizeCapturedImage } from './image';
const LIVE_CACHE_KEY = 'msg-car-live-cache-v1';
function readLiveCache() {
    const raw = localStorage.getItem(LIVE_CACHE_KEY);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function writeLiveCache(data) {
    try {
        localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(data));
    }
    catch {
        // Local storage may be full if the browser has a very small quota.
    }
}
function expenseReviewTransition(expense, action, reviewerId, reviewerRole, reason) {
    const now = new Date().toISOString();
    const isAdmin = reviewerRole === 'admin';
    if (action === 'director_approve') {
        if (!isAdmin && reviewerRole !== 'director')
            throw new Error('Chỉ Ban Giám đốc được duyệt bước đầu.');
        if (expense.status !== 'pending_director')
            throw new Error('Chi phí không còn ở bước chờ Ban Giám đốc duyệt.');
        return {
            expectedStatus: 'pending_director',
            changes: {
                status: 'pending_accountant',
                director_reviewer_id: reviewerId,
                director_reviewed_at: now,
                reviewer_id: reviewerId,
                reviewed_at: now,
                rejection_reason: null,
                updated_at: now,
            },
        };
    }
    if (action === 'accountant_approve') {
        if (!isAdmin && reviewerRole !== 'accountant')
            throw new Error('Chỉ Kế toán được duyệt bước thanh toán.');
        if (expense.status !== 'pending_accountant')
            throw new Error('Chi phí chưa được Ban Giám đốc duyệt hoặc đã được xử lý.');
        return {
            expectedStatus: 'pending_accountant',
            changes: {
                status: 'approved',
                accountant_reviewer_id: reviewerId,
                accountant_reviewed_at: now,
                reviewer_id: reviewerId,
                reviewed_at: now,
                rejection_reason: null,
                updated_at: now,
            },
        };
    }
    if (action === 'mark_paid') {
        if (!isAdmin && reviewerRole !== 'accountant')
            throw new Error('Chỉ Kế toán được xác nhận chi trả.');
        if (expense.status !== 'approved')
            throw new Error('Chi phí chưa hoàn tất hai bước duyệt.');
        return {
            expectedStatus: 'approved',
            changes: {
                status: 'paid',
                paid_by: reviewerId,
                paid_at: now,
                reviewer_id: reviewerId,
                reviewed_at: now,
                updated_at: now,
            },
        };
    }
    if (!reason?.trim())
        throw new Error('Cần nhập lý do từ chối.');
    const canReject = isAdmin
        || (reviewerRole === 'director' && expense.status === 'pending_director')
        || (reviewerRole === 'accountant' && expense.status === 'pending_accountant');
    if (!canReject)
        throw new Error('Bạn không có quyền từ chối chi phí ở bước hiện tại.');
    return {
        expectedStatus: expense.status,
        changes: {
            status: 'rejected',
            reviewer_id: reviewerId,
            reviewed_at: now,
            rejection_reason: reason.trim(),
            updated_at: now,
        },
    };
}
function applyOptimisticToLiveCache(operation, optimistic) {
    const cache = readLiveCache();
    if (!cache || !optimistic || typeof optimistic !== 'object')
        return;
    const tableMap = {
        'expense.create': 'expenses',
        'incident.create': 'incidents',
        'odometer.update': 'trips',
    };
    const tableName = operation.split('.')[0];
    const key = tableMap[operation] ?? (tableName in cache ? tableName : null);
    if (!key)
        return;
    const record = optimistic;
    if (!record.id)
        return;
    const items = cache[key];
    const index = items.findIndex((item) => item.id === record.id);
    if (index >= 0)
        items[index] = { ...items[index], ...record };
    else
        items.unshift(record);
    writeLiveCache(cache);
}
function phoneToE164(phone) {
    const digits = normalizePhone(phone).replace(/\D/g, '');
    if (digits.startsWith('84'))
        return `+${digits}`;
    if (digits.startsWith('0'))
        return `+84${digits.slice(1)}`;
    return `+84${digits}`;
}
function phoneToInternalEmail(phone) {
    const e164 = phoneToE164(phone);
    return `${e164.slice(1)}@auth.bvmsgtv.internal`;
}
function friendlyLoginError(message) {
    if (/invalid login credentials/i.test(message))
        return 'Số điện thoại hoặc mật khẩu không đúng.';
    if (/email logins are disabled/i.test(message))
        return 'Supabase chưa bật đăng nhập Email. Hãy bật Authentication → Providers → Email.';
    return message;
}
async function friendlyFunctionError(error) {
    if (error instanceof FunctionsHttpError) {
        try {
            const payload = await error.context.clone().json();
            return payload.error ?? payload.message ?? `Edge Function trả lỗi HTTP ${error.context.status}.`;
        }
        catch {
            return `Edge Function trả lỗi HTTP ${error.context.status}. Hãy xem Supabase → Edge Functions → manage-user → Logs.`;
        }
    }
    if (error instanceof FunctionsFetchError) {
        return 'Không kết nối được Edge Function manage-user. Hãy deploy lại Edge Function manage-user và kiểm tra đúng Supabase Project.';
    }
    if (error instanceof FunctionsRelayError) {
        return `Supabase Edge Relay gặp lỗi: ${error.message}`;
    }
    return error instanceof Error ? error.message : String(error);
}
async function requireSupabase() {
    if (!supabase)
        throw new Error('Supabase chưa được cấu hình.');
    return supabase;
}
async function uploadMedia(file, folder, fileKey) {
    const client = await requireSupabase();
    const mime = file.type.split(';')[0] || 'application/octet-stream';
    const rawExt = mime.split('/')[1] || 'bin';
    const ext = rawExt.replace('jpeg', 'jpg').replace('mpeg', 'mp3').replace('mp4', 'm4a');
    const basename = fileKey ?? `${Date.now()}-${uid('media')}`;
    const path = `${folder}/${basename}.${ext}`;
    const { error } = await client.storage.from('vehicle-media').upload(path, file, { contentType: mime, upsert: Boolean(fileKey) });
    if (error) {
        const message = error.message || String(error);
        if (/bucket.*not found|not found.*bucket/i.test(message))
            throw new Error('Chưa có kho ảnh vehicle-media. Quản trị cần chạy lại supabase/schema.sql.');
        if (/row-level security|policy|not authorized|permission/i.test(message))
            throw new Error('Tài khoản không có quyền tải ảnh. Kiểm tra Storage Policy và tài khoản tài xế.');
        if (/too large|maximum|payload|size/i.test(message))
            throw new Error('Ảnh vượt dung lượng cho phép. Vui lòng chụp lại ở độ phân giải thấp hơn.');
        throw new Error(`Không tải được ảnh: ${message}`);
    }
    return path;
}
async function uploadAccountAvatar(file, targetUserId) {
    const optimized = await optimizeCapturedImage(file, { maxDimension: 720, quality: 0.82, maxBytes: 650_000 });
    return await uploadMedia(optimized, `${targetUserId}/avatars`, 'profile');
}
async function removeStoredMedia(path) {
    if (!path || path.startsWith('data:') || path.startsWith('http'))
        return;
    const client = await requireSupabase();
    await client.storage.from('vehicle-media').remove([path]);
}
async function signMedia(path) {
    if (!path || path.startsWith('data:') || path.startsWith('http'))
        return path;
    const client = await requireSupabase();
    const { data } = await client.storage.from('vehicle-media').createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? path;
}
async function hydrateProfile(profile) {
    const avatarPath = profile.avatar_path ?? profile.avatar_url ?? null;
    return {
        ...profile,
        avatar_path: avatarPath,
        avatar_url: await signMedia(avatarPath),
    };
}
async function hydrateData(data) {
    const profiles = await Promise.all(data.profiles.map(hydrateProfile));
    const vehicleRequests = await Promise.all(data.vehicleRequests.map(async (request) => {
        const planPath = request.plan_document_path ?? request.plan_document_url ?? null;
        return { ...request, plan_document_path: planPath, plan_document_url: await signMedia(planPath) };
    }));
    const trips = await Promise.all(data.trips.map(async (trip) => {
        const planPath = trip.plan_document_path ?? trip.plan_document_url ?? null;
        return {
            ...trip,
            plan_document_path: planPath,
            plan_document_url: await signMedia(planPath),
            start_odometer_image_url: await signMedia(trip.start_odometer_image_url),
            end_odometer_image_url: await signMedia(trip.end_odometer_image_url),
        };
    }));
    const expenses = await Promise.all(data.expenses.map(async (expense) => ({ ...expense, receipt_url: await signMedia(expense.receipt_url) })));
    const incidents = await Promise.all(data.incidents.map(async (incident) => ({
        ...incident,
        image_url: await signMedia(incident.image_url),
        audio_url: await signMedia(incident.audio_url),
    })));
    return { ...data, profiles, vehicleRequests, trips, expenses, incidents };
}
async function supabaseLoadData() {
    const cache = readLiveCache();
    if (!navigator.onLine && cache)
        return cache;
    try {
        const client = await requireSupabase();
        const tables = ['profiles', 'vehicles', 'vehicle_requests', 'trips', 'checklists', 'expenses', 'incidents', 'maintenances'];
        const results = await Promise.all(tables.map((table) => client.from(table).select('*').order('created_at', { ascending: false })));
        results.forEach((result) => { if (result.error)
            throw result.error; });
        const hydrated = await hydrateData({
            profiles: (results[0].data ?? []),
            vehicles: (results[1].data ?? []),
            vehicleRequests: (results[2].data ?? []),
            trips: (results[3].data ?? []),
            checklists: (results[4].data ?? []),
            expenses: (results[5].data ?? []),
            incidents: (results[6].data ?? []),
            maintenances: (results[7].data ?? []),
        });
        writeLiveCache(hydrated);
        return hydrated;
    }
    catch (error) {
        if (cache)
            return cache;
        throw error;
    }
}
async function queue(operation, payload, file, secondFile) {
    const action = { id: uid('pending'), operation, payload, file, secondFile, createdAt: new Date().toISOString(), attempts: 0 };
    await addPending(action);
}
async function executeAction(action) {
    const client = await requireSupabase();
    const payload = { ...action.payload };
    if (action.operation === 'expense.create') {
        const recordId = String(payload.id);
        if (action.file)
            payload.receipt_url = await uploadMedia(action.file, `${payload.driver_id}/receipts`, `expense-${recordId}`);
        const { error } = await client.from('expenses').upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
        if (error)
            throw error;
        return;
    }
    if (action.operation === 'incident.create') {
        const recordId = String(payload.id);
        if (action.file)
            payload.image_url = await uploadMedia(action.file, `${payload.driver_id}/incidents`, `incident-${recordId}`);
        if (action.secondFile)
            payload.audio_url = await uploadMedia(action.secondFile, `${payload.driver_id}/incident-audio`, `incident-audio-${recordId}`);
        const { error } = await client.from('incidents').upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
        if (error)
            throw error;
        return;
    }
    if (action.operation === 'odometer.update') {
        const phase = String(payload.phase);
        const field = phase === 'start' ? 'start_odometer_image_url' : 'end_odometer_image_url';
        const tripId = String(payload.trip_id);
        if (action.file)
            payload[field] = await uploadMedia(action.file, `${payload.driver_id}/odometer`, `${tripId}-${phase}`);
        delete payload.phase;
        delete payload.driver_id;
        delete payload.trip_id;
        const { error } = await client.from('trips').update(payload).eq('id', tripId);
        if (error)
            throw error;
        return;
    }
    const [table, method] = action.operation.split('.');
    const id = payload.id ? String(payload.id) : null;
    if (method === 'insert') {
        const { error } = await client.from(table).upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
        if (error)
            throw error;
    }
    else if (method === 'update' && id) {
        delete payload.id;
        const { error } = await client.from(table).update(payload).eq('id', id);
        if (error)
            throw error;
    }
}
async function performOrQueue(operation, payload, work, optimistic, file, secondFile) {
    if (!navigator.onLine) {
        await queue(operation, payload, file, secondFile);
        applyOptimisticToLiveCache(operation, optimistic);
        return optimistic;
    }
    try {
        return await work();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/fetch|network|offline|failed to fetch/i.test(message)) {
            await queue(operation, payload, file, secondFile);
            applyOptimisticToLiveCache(operation, optimistic);
            return optimistic;
        }
        throw error;
    }
}
const supabaseBackend = {
    mode: 'supabase',
    async login(phone, password) {
        const client = await requireSupabase();
        const email = phoneToInternalEmail(phone);
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error)
            throw new Error(friendlyLoginError(error.message));
        if (!data.user)
            throw new Error('Không đăng nhập được.');
        const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).single();
        if (profileError)
            throw profileError;
        if (!profile.active) {
            await client.auth.signOut();
            throw new Error('Tài khoản đã bị khóa.');
        }
        return { id: data.user.id, profile: await hydrateProfile(profile) };
    },
    async logout() {
        const client = await requireSupabase();
        await client.auth.signOut();
    },
    async session() {
        const client = await requireSupabase();
        const { data } = await client.auth.getSession();
        if (!data.session?.user)
            return null;
        const { data: profile } = await client.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
        if (!profile || !profile.active) {
            await client.auth.signOut();
            return null;
        }
        return { id: data.session.user.id, profile: await hydrateProfile(profile) };
    },
    async changeOwnPassword(password) {
        const client = await requireSupabase();
        const nextPassword = String(password ?? '').trim();
        if (nextPassword.length < 6)
            throw new Error('Mật khẩu mới cần ít nhất 6 ký tự.');
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData.user)
            throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại trước khi đổi mật khẩu.');
        const { error } = await client.auth.updateUser({ password: nextPassword });
        if (error)
            throw new Error(`Không đổi được mật khẩu: ${error.message}`);
    },
    loadData: supabaseLoadData,
    async createUser(input, avatarFile) {
        const client = await requireSupabase();
        const { data, error } = await client.functions.invoke('manage-user', {
            body: { action: 'create', ...input, avatar_url: null },
        });
        if (error)
            throw new Error(await friendlyFunctionError(error));
        if (data?.error)
            throw new Error(data.error);
        if (!data?.profile)
            throw new Error('Edge Function không trả về hồ sơ tài khoản mới.');
        let profile = data.profile;
        if (avatarFile) {
            const avatarPath = await uploadAccountAvatar(avatarFile, profile.id);
            const updateResult = await client.functions.invoke('manage-user', {
                body: {
                    action: 'update',
                    id: profile.id,
                    full_name: input.full_name,
                    phone: input.phone,
                    role: input.role,
                    active: true,
                    employee_code: input.employee_code,
                    department: input.department,
                    job_title: input.job_title,
                    notes: input.notes,
                    avatar_url: avatarPath,
                },
            });
            if (updateResult.error) {
                await removeStoredMedia(avatarPath);
                throw new Error(await friendlyFunctionError(updateResult.error));
            }
            if (updateResult.data?.error) {
                await removeStoredMedia(avatarPath);
                throw new Error(updateResult.data.error);
            }
            if (updateResult.data?.profile)
                profile = updateResult.data.profile;
        }
        return await hydrateProfile(profile);
    },
    async updateUser(input, avatarFile) {
        const client = await requireSupabase();
        const oldAvatarPath = input.previous_avatar_url ?? null;
        const avatarPath = avatarFile
            ? await uploadAccountAvatar(avatarFile, input.id)
            : input.avatar_url === null
                ? null
                : input.avatar_url ?? oldAvatarPath;
        const { data, error } = await client.functions.invoke('manage-user', {
            body: { action: 'update', ...input, avatar_url: avatarPath },
        });
        if (error) {
            if (avatarFile)
                await removeStoredMedia(avatarPath);
            throw new Error(await friendlyFunctionError(error));
        }
        if (data?.error) {
            if (avatarFile)
                await removeStoredMedia(avatarPath);
            throw new Error(data.error);
        }
        if (!data?.profile)
            throw new Error('Edge Function không trả về hồ sơ đã cập nhật.');
        if (oldAvatarPath && oldAvatarPath !== avatarPath)
            await removeStoredMedia(oldAvatarPath);
        return await hydrateProfile(data.profile);
    },
    async deleteUser(id) {
        if (!navigator.onLine)
            throw new Error('Cần kết nối mạng để xóa tài khoản.');
        const client = await requireSupabase();
        const { data, error } = await client.functions.invoke('manage-user', { body: { action: 'delete', id } });
        if (error)
            throw new Error(await friendlyFunctionError(error));
        if (data?.error)
            throw new Error(data.error);
    },
    async updateProfile(id, changes) {
        const client = await requireSupabase();
        const { data, error } = await client.from('profiles').update(changes).eq('id', id).select().single();
        if (error)
            throw error;
        return data;
    },
    subscribe(onChange) {
        const client = supabase;
        if (!client)
            return () => undefined;
        const channel = client.channel('msg-car-changes');
        for (const table of ['profiles', 'vehicle_requests', 'trips', 'vehicles', 'expenses', 'incidents', 'maintenances', 'checklists']) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
        }
        channel.subscribe();
        return () => {
            void client.removeChannel(channel);
        };
    },
    async createVehicleRequest(input, requesterId, planFile) {
        if (!navigator.onLine)
            throw new Error('Cần kết nối mạng để gửi đề nghị điều xe và văn bản kế hoạch.');
        const client = await requireSupabase();
        const id = uid('vehicle-request');
        const now = new Date().toISOString();
        let planPath = null;
        if (planFile)
            planPath = await uploadMedia(planFile, `${requesterId}/trip-plans`, `request-${id}`);
        const payload = {
            ...input,
            id,
            requester_id: requesterId,
            plan_document_url: planPath,
            status: 'pending_fleet',
        };
        const { data, error } = await client.from('vehicle_requests').insert(payload).select().single();
        if (error) {
            if (planPath)
                await removeStoredMedia(planPath);
            throw new Error(getErrorMessage(error, 'Không thể tạo đề nghị điều hành xe.'));
        }
        return { ...data, plan_document_path: planPath, plan_document_url: await signMedia(planPath), created_at: data.created_at ?? now };
    },
    async updateVehicleRequest(id, changes) {
        if (!navigator.onLine)
            throw new Error('Cần kết nối mạng để duyệt đề nghị điều xe.');
        const client = await requireSupabase();
        const payload = { ...changes, updated_at: new Date().toISOString() };
        const { data, error } = await client.from('vehicle_requests').update(payload).eq('id', id).select().single();
        if (error)
            throw error;
        const record = data;
        const planPath = record.plan_document_url ?? null;
        return { ...record, plan_document_path: planPath, plan_document_url: await signMedia(planPath) };
    },
    async createTrip(input, creatorId, planFile) {
        const client = await requireSupabase();
        const now = new Date().toISOString();
        const id = uid('trip');
        const { existing_plan_path, ...tripInput } = input;
        // Nếu chuyến được tạo từ đề nghị của Trưởng khoa đã được Hành chính duyệt,
        // không yêu cầu Hành chính duyệt lần thứ hai. Giữ lại người/thời gian duyệt
        // từ đề nghị để bảo toàn dấu vết phê duyệt và giao chuyến thẳng cho tài xế.
        let approvedRequest = null;
        if (input.vehicle_request_id) {
            const { data: requestData, error: requestError } = await client
                .from('vehicle_requests')
                .select('status, plan_document_url, fleet_reviewer_id, fleet_reviewed_at')
                .eq('id', input.vehicle_request_id)
                .single();
            if (requestError)
                throw requestError;
            if (!requestData || requestData.status !== 'fleet_approved') {
                throw new Error('Đề nghị điều xe chưa được Hành chính duyệt hoặc đã được tạo thành chuyến.');
            }
            approvedRequest = requestData;
        }
        let planPath = existing_plan_path ?? approvedRequest?.plan_document_url ?? null;
        if (planFile)
            planPath = await uploadMedia(planFile, `${creatorId}/trip-plans`, `trip-${id}`);
        const fromApprovedDepartmentRequest = Boolean(input.vehicle_request_id && approvedRequest);
        const approvedPlan = Boolean(planPath);
        const payload = {
            ...tripInput,
            id,
            created_by: creatorId,
            status: fromApprovedDepartmentRequest ? 'assigned' : 'pending_fleet',
            approval_mode: fromApprovedDepartmentRequest || approvedPlan ? 'fleet_only' : 'director_required',
            approved_plan: approvedPlan,
            plan_document_url: planPath,
            fleet_reviewer_id: fromApprovedDepartmentRequest ? approvedRequest?.fleet_reviewer_id ?? null : null,
            fleet_reviewed_at: fromApprovedDepartmentRequest ? approvedRequest?.fleet_reviewed_at ?? null : null,
            checklist_completed: false,
        };
        const optimistic = { ...payload, plan_document_path: planPath, created_at: now, updated_at: now };
        try {
            const { data, error } = await client.from('trips').insert(payload).select().single();
            if (error)
                throw error;
            const record = data;
            return { ...record, plan_document_path: planPath, plan_document_url: await signMedia(planPath) };
        }
        catch (error) {
            if (planFile && planPath)
                await removeStoredMedia(planPath);
            throw error;
        }
    },
    async updateTrip(id, changes) {
        const client = await requireSupabase();
        const payload = { ...changes, updated_at: new Date().toISOString() };
        const optimistic = { id, ...payload };
        return await performOrQueue('trips.update', { id, ...payload }, async () => {
            const { data, error } = await client.from('trips').update(payload).eq('id', id).select().single();
            if (error)
                throw error;
            return data;
        }, optimistic);
    },
    async updateTripLocation(id, lat, lng) {
        const client = await requireSupabase();
        const payload = {
            current_lat: lat,
            current_lng: lng,
            location_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await client
            .from('trips')
            .update(payload)
            .eq('id', id)
            .eq('status', 'active')
            .select()
            .single();
        if (error)
            throw error;
        return data;
    },
    async deleteTrip(id) {
        if (!navigator.onLine)
            throw new Error('Cần kết nối mạng để xóa chuyến đi.');
        const client = await requireSupabase();
        const { error } = await client.from('trips').delete().eq('id', id);
        if (error)
            throw error;
    },
    async createChecklist(input) {
        const client = await requireSupabase();
        const id = uid('checklist');
        const payload = { ...input, id };
        const record = { ...input, id, created_at: new Date().toISOString() };
        const result = await performOrQueue('checklists.insert', payload, async () => {
            const { data, error } = await client.from('checklists').insert(payload).select().single();
            if (error)
                throw error;
            return data;
        }, record);
        const allOk = input.fuel_ok && input.tires_ok && input.lights_horn_ok && input.vehicle_clean && input.documents_ok;
        await this.updateTrip(input.trip_id, { checklist_completed: true, status: allOk ? 'ready' : 'accepted' });
        return result;
    },
    async submitOdometer(trip, phase, odometer, file) {
        const client = await requireSupabase();
        const location = await getCurrentLocation();
        const changes = phase === 'start'
            ? { start_odometer: odometer, start_lat: location?.lat, start_lng: location?.lng }
            : { end_odometer: odometer, end_lat: location?.lat, end_lng: location?.lng };
        const optimistic = { ...trip, ...changes, updated_at: new Date().toISOString() };
        const queuePayload = { trip_id: trip.id, driver_id: trip.driver_id, phase, ...changes };
        return await performOrQueue('odometer.update', queuePayload, async () => {
            if (file)
                changes[phase === 'start' ? 'start_odometer_image_url' : 'end_odometer_image_url'] = await uploadMedia(file, `${trip.driver_id}/odometer`, `${trip.id}-${phase}`);
            const { data, error } = await client.from('trips').update(changes).eq('id', trip.id).select().single();
            if (error)
                throw error;
            return data;
        }, optimistic, file);
    },
    async createExpense(input, file) {
        const client = await requireSupabase();
        const now = new Date().toISOString();
        const id = uid('local-expense');
        const optimistic = { ...input, id, receipt_url: null, created_at: now, updated_at: now };
        const payload = { ...input, id };
        return await performOrQueue('expense.create', payload, async () => {
            if (file)
                payload.receipt_url = await uploadMedia(file, `${input.driver_id}/receipts`, `expense-${id}`);
            const { data, error } = await client.from('expenses').insert(payload).select().single();
            if (error)
                throw error;
            return data;
        }, optimistic, file);
    },
    async reviewExpense(id, action, reviewerId, reviewerRole, reason) {
        const client = await requireSupabase();
        let current = readLiveCache()?.expenses.find((expense) => expense.id === id) ?? null;
        if (navigator.onLine) {
            const { data, error } = await client.from('expenses').select('*').eq('id', id).single();
            if (error)
                throw error;
            current = data;
        }
        if (!current)
            throw new Error('Không tìm thấy chi phí trong dữ liệu hiện tại.');
        const transition = expenseReviewTransition(current, action, reviewerId, reviewerRole, reason);
        const optimistic = { ...current, ...transition.changes };
        return await performOrQueue('expenses.update', { id, ...transition.changes }, async () => {
            const { data, error } = await client
                .from('expenses')
                .update(transition.changes)
                .eq('id', id)
                .eq('status', transition.expectedStatus)
                .select()
                .single();
            if (error)
                throw error;
            return data;
        }, optimistic);
    },
    async createIncident(input, media) {
        const client = await requireSupabase();
        const location = await getCurrentLocation();
        const id = uid('incident');
        const payload = { ...input, id, status: 'pending_director', lat: input.lat ?? location?.lat, lng: input.lng ?? location?.lng };
        const now = new Date().toISOString();
        const optimistic = {
            ...input,
            status: 'pending_director',
            id,
            image_url: null,
            audio_url: null,
            lat: Number(payload.lat) || null,
            lng: Number(payload.lng) || null,
            created_at: now,
        };
        return await performOrQueue('incident.create', payload, async () => {
            if (media?.file)
                payload.image_url = await uploadMedia(media.file, `${input.driver_id}/incidents`, `incident-${id}`);
            if (media?.secondFile)
                payload.audio_url = await uploadMedia(media.secondFile, `${input.driver_id}/incident-audio`, `incident-audio-${id}`);
            const { data, error } = await client.from('incidents').insert(payload).select().single();
            if (error)
                throw error;
            return data;
        }, optimistic, media?.file, media?.secondFile);
    },
    async updateIncident(id, changes) {
        const client = await requireSupabase();
        const optimistic = { id, ...changes };
        return await performOrQueue('incidents.update', { id, ...changes }, async () => {
            const { data, error } = await client.from('incidents').update(changes).eq('id', id).select().single();
            if (error)
                throw error;
            return data;
        }, optimistic);
    },
    async createVehicle(input) {
        const client = await requireSupabase();
        const now = new Date().toISOString();
        const id = uid('vehicle');
        const payload = { ...input, id };
        const optimistic = { ...input, id, created_at: now, updated_at: now };
        return await performOrQueue('vehicles.insert', payload, async () => {
            const { data, error } = await client.from('vehicles').insert(payload).select().single();
            if (error)
                throw error;
            return data;
        }, optimistic);
    },
    async updateVehicle(id, changes) {
        const client = await requireSupabase();
        const payload = { ...changes, updated_at: new Date().toISOString() };
        const optimistic = { id, ...payload };
        return await performOrQueue('vehicles.update', { id, ...payload }, async () => {
            const { data, error } = await client.from('vehicles').update(payload).eq('id', id).select().single();
            if (error)
                throw error;
            return data;
        }, optimistic);
    },
    async createMaintenance(input) {
        const client = await requireSupabase();
        const now = new Date().toISOString();
        const id = uid('maintenance');
        const payload = { ...input, id, status: 'pending_director' };
        const optimistic = { ...input, id, status: 'pending_director', created_at: now, updated_at: now };
        return await performOrQueue('maintenances.insert', payload, async () => {
            const { data, error } = await client.from('maintenances').insert(payload).select().single();
            if (error)
                throw error;
            return data;
        }, optimistic);
    },
    async updateMaintenance(id, changes) {
        const client = await requireSupabase();
        const payload = { ...changes, updated_at: new Date().toISOString() };
        const optimistic = { id, ...payload };
        return await performOrQueue('maintenances.update', { id, ...payload }, async () => {
            const { data, error } = await client.from('maintenances').update(payload).eq('id', id).select().single();
            if (error)
                throw error;
            return data;
        }, optimistic);
    },
    async syncPending() {
        if (!navigator.onLine)
            return await pendingCount();
        const actions = (await listPending()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        for (const action of actions) {
            try {
                await executeAction(action);
                await removePending(action.id);
            }
            catch {
                await updatePending({ ...action, attempts: action.attempts + 1 });
            }
        }
        return await pendingCount();
    },
    async getPendingCount() { return await pendingCount(); },
};
// Production-only mode: never fall back to sample/demo data.
// If Supabase configuration is missing, requireSupabase() returns a clear configuration error.
export const backend = supabaseBackend;
