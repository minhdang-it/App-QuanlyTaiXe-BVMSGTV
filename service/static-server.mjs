import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import process from 'node:process'

const port = Number(process.env.PORT || 8080)
const root = resolve(process.env.ROOT_DIR || join(process.cwd(), 'dist'))

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

function sendFile(req, res, filePath) {
  const extension = extname(filePath).toLowerCase()
  const headers = {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=(self)',
  }

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

const server = createServer((req, res) => {
  try {
    if (req.url === '/__health') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(JSON.stringify({ ok: true, service: 'msg-car-web', port, root }))
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
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html')
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      filePath = join(root, 'index.html')
    }

    if (!existsSync(filePath)) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Build output not found. Run npm run build.')
      return
    }

    sendFile(req, res, filePath)
  } catch (error) {
    console.error(new Date().toISOString(), 'request error', error)
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Internal Server Error')
  }
})

server.on('error', (error) => {
  console.error(new Date().toISOString(), 'server error', error)
  process.exit(1)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`${new Date().toISOString()} MSG Car web started at http://0.0.0.0:${port}`)
  console.log(`${new Date().toISOString()} Serving: ${root}`)
})

function shutdown(signal) {
  console.log(`${new Date().toISOString()} Received ${signal}. Stopping...`)
  server.close((error) => process.exit(error ? 1 : 0))
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
