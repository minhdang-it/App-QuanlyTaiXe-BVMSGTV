import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { extname, join, normalize, resolve, sep } from 'node:path'
import process from 'node:process'

const httpPort = Number(process.env.PORT || 8080)
const httpsPort = Number(process.env.HTTPS_PORT || 8443)
const root = resolve(process.env.ROOT_DIR || join(process.cwd(), 'dist'))
const certFile = resolve(process.env.TLS_CERT_FILE || join(process.cwd(), '.certs', 'msg-car-cert.pem'))
const keyFile = resolve(process.env.TLS_KEY_FILE || join(process.cwd(), '.certs', 'msg-car-key.pem'))
const tlsEnabled = existsSync(certFile) && existsSync(keyFile)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0])
  const relative = normalize(decoded).replace(/^([/\\])+/, '')
  const fullPath = resolve(root, relative)
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) return null
  return fullPath
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(value))
}

function sendFile(req, res, filePath, secure) {
  const extension = extname(filePath).toLowerCase()
  const headers = {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  }

  if (secure) headers['Strict-Transport-Security'] = 'max-age=31536000'

  if (filePath.endsWith(`${sep}sw.js`) || extension === '.html') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
  } else if (['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff2'].includes(extension)) {
    headers['Cache-Control'] = 'public, max-age=604800, immutable'
  } else {
    headers['Cache-Control'] = 'no-cache'
  }

  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return
  }

  const stream = createReadStream(filePath)
  stream.on('error', (error) => {
    console.error(new Date().toISOString(), 'stream error', error)
    if (!res.headersSent) res.writeHead(500)
    res.end('Internal Server Error')
  })
  stream.pipe(res)
}

function serveApplication(req, res, secure) {
  try {
    if (req.url === '/__health') {
      sendJson(res, 200, {
        ok: true,
        service: 'msg-car-web',
        httpPort,
        httpsPort: tlsEnabled ? httpsPort : null,
        tlsEnabled,
        root,
      })
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      res.end('Method Not Allowed')
      return
    }

    const requested = safePath(req.url)
    if (!requested) {
      res.writeHead(400)
      res.end('Bad Request')
      return
    }

    let filePath = requested
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html')
    if (!existsSync(filePath) || !statSync(filePath).isFile()) filePath = join(root, 'index.html')

    if (!existsSync(filePath)) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Build output not found. Run npm run build.')
      return
    }

    sendFile(req, res, filePath, secure)
  } catch (error) {
    console.error(new Date().toISOString(), 'request error', error)
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Internal Server Error')
  }
}

function redirectToHttps(req, res) {
  if (req.url === '/__health') {
    serveApplication(req, res, false)
    return
  }
  const rawHost = String(req.headers.host || 'localhost').replace(/:\d+$/, '')
  const host = rawHost.includes(':') && !rawHost.startsWith('[') ? `[${rawHost}]` : rawHost
  res.writeHead(302, {
    Location: `https://${host}:${httpsPort}${req.url || '/'}`,
    'Cache-Control': 'no-store',
  })
  res.end()
}

const httpServer = createHttpServer((req, res) => {
  if (tlsEnabled) redirectToHttps(req, res)
  else serveApplication(req, res, false)
})

const httpsServer = tlsEnabled
  ? createHttpsServer({ cert: readFileSync(certFile), key: readFileSync(keyFile) }, (req, res) => serveApplication(req, res, true))
  : null

function handleServerError(label) {
  return (error) => {
    console.error(new Date().toISOString(), `${label} server error`, error)
    process.exit(1)
  }
}

httpServer.on('error', handleServerError('HTTP'))
httpsServer?.on('error', handleServerError('HTTPS'))

httpServer.listen(httpPort, '0.0.0.0', () => {
  console.log(`${new Date().toISOString()} MSG Car HTTP started at http://0.0.0.0:${httpPort}`)
  console.log(`${new Date().toISOString()} Serving: ${root}`)
  if (!tlsEnabled) console.warn(`${new Date().toISOString()} HTTPS is not enabled. GPS and browser notifications will be blocked on mobile LAN addresses.`)
})

httpsServer?.listen(httpsPort, '0.0.0.0', () => {
  console.log(`${new Date().toISOString()} MSG Car HTTPS started at https://0.0.0.0:${httpsPort}`)
  console.log(`${new Date().toISOString()} TLS certificate: ${certFile}`)
})

function shutdown(signal) {
  console.log(`${new Date().toISOString()} Received ${signal}. Stopping...`)
  let pending = httpsServer ? 2 : 1
  const finish = () => {
    pending -= 1
    if (pending <= 0) process.exit(0)
  }
  httpServer.close(finish)
  httpsServer?.close(finish)
  setTimeout(() => process.exit(1), 10000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (error) => {
  console.error(new Date().toISOString(), 'uncaughtException', error)
  process.exit(1)
})
process.on('unhandledRejection', (error) => {
  console.error(new Date().toISOString(), 'unhandledRejection', error)
  process.exit(1)
})
