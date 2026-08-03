import { openDB } from 'idb'

export interface PendingAction {
  id: string
  operation: string
  payload: Record<string, unknown>
  file?: Blob | null
  secondFile?: Blob | null
  createdAt: string
  attempts: number
}

const dbPromise = openDB('msg-car-offline', 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('pending')) {
      db.createObjectStore('pending', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('drafts')) {
      db.createObjectStore('drafts')
    }
    if (!db.objectStoreNames.contains('media')) {
      db.createObjectStore('media')
    }
  },
})

export async function addPending(action: PendingAction) {
  const db = await dbPromise
  await db.put('pending', action)
}

export async function listPending(): Promise<PendingAction[]> {
  const db = await dbPromise
  return await db.getAll('pending')
}

export async function removePending(id: string) {
  const db = await dbPromise
  await db.delete('pending', id)
}

export async function updatePending(action: PendingAction) {
  const db = await dbPromise
  await db.put('pending', action)
}

export async function pendingCount() {
  const db = await dbPromise
  return await db.count('pending')
}

export async function saveDraft<T>(key: string, value: T) {
  const db = await dbPromise
  await db.put('drafts', value, key)
}

export async function loadDraft<T>(key: string): Promise<T | undefined> {
  const db = await dbPromise
  return await db.get('drafts', key)
}

export async function removeDraft(key: string) {
  const db = await dbPromise
  await db.delete('drafts', key)
}

export async function saveMediaBlob(key: string, value: Blob) {
  const db = await dbPromise
  await db.put('media', value, key)
}

export async function loadMediaBlob(key: string): Promise<Blob | undefined> {
  const db = await dbPromise
  return await db.get('media', key)
}

export async function removeMediaBlob(key: string) {
  const db = await dbPromise
  await db.delete('media', key)
}
