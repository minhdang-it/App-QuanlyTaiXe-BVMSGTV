import http from 'node:http'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tripId='beead09c-0e46-4f55-8d12-f99616bd5c51'
const vehicleId='beead09c-0e46-4f55-8d12-f99616bd5c52'
const demoServiceKey = ['service', 'test', 'secret'].join('-')
const demoAnonKey = ['anon', 'test', 'secret'].join('-')
const demoPassword = ['test', 'pass'].join('')
let saved=null, refreshed=false, gatewayAuth=''
const server = http.createServer(async (req,res) => {
  const pathname=new URL(req.url, 'http://127.0.0.1').pathname
  const json=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))}
  if (pathname==='/auth/v1/token') return json({access_token:'session-test-token',expires_in:3600})
  if (pathname==='/rest/v1/trips') {
    if (req.url.includes('status=eq.completed')) return json([])
    return json([{id:tripId,vehicle_id:vehicleId,status:'active',started_at:new Date(Date.now()-30000).toISOString(),ended_at:null}])
  }
  if (pathname==='/rest/v1/vehicles') return json([{id:vehicleId,plate_number:'64A-366.87',navicom_enabled:true,navicom_device_id:'TEST-IMEI'}])
  if (pathname==='/vehicle/TEST-IMEI') {gatewayAuth=req.headers.authorization||'';return json({gps:{lat:9.934456,lng:106.323456,speed_kph:71,updated_at:new Date().toISOString()}})}
  if (pathname==='/rest/v1/trip_gps_samples') {
    let raw='';for await (const part of req) raw+=part
    saved=JSON.parse(raw)
    assert.equal(req.headers.authorization,`Bearer ${demoServiceKey}`)
    return json(null,201)
  }
  if (pathname==='/rest/v1/rpc/refresh_trip_gps_summary') {refreshed=true;return json(null)}
  return json({error:'bad mock route',pathname},404)
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const port=server.address().port
const env={...process.env,SUPABASE_URL:`http://127.0.0.1:${port}`,SUPABASE_SERVICE_ROLE_KEY:demoServiceKey,SUPABASE_ANON_KEY:demoAnonKey,COLLECTOR_EMAIL:'test@example.com',COLLECTOR_PASSWORD:demoPassword,NAVICOM_GATEWAY_URL:`http://127.0.0.1:${port}`}
try {
  const proc=spawn(process.execPath,[path.join(root,'server/trip-telemetry/collector.mjs'),'--once'],{env})
  let out='',err='';proc.stdout.on('data',d=>out+=d);proc.stderr.on('data',d=>err+=d)
  const exitCode=await new Promise(resolve=>proc.on('close',resolve))
  assert.equal(exitCode,0,err)
  assert.ok(saved,'No stored sample: '+out+' '+err)
  assert.equal(saved.trip_id,tripId)
  assert.equal(saved.speed_kph,71)
  assert.equal(saved.latitude,9.934456)
  assert.equal(gatewayAuth,'Bearer session-test-token')
  assert.ok(refreshed,'Summary RPC was not called')
  console.log('MOCK COLLECTOR TEST PASSED: authenticated gateway + GPS insert + summary refresh')
} finally {server.close()}
