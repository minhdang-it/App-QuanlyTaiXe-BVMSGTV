const CACHE = 'dieu-phoi-xe-bvmsgtv-shell-v260'

self.addEventListener('install', (event) => {
  const scope = self.registration.scope
  const core = [
    scope,
    `${scope}index.html`,
    `${scope}manifest.webmanifest`,
    `${scope}icons/icon-192.png`,
    `${scope}icons/icon-512.png`,
    `${scope}logo-bvmsgtv-v201.png`,
  ]
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(core))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        if (event.request.mode === 'navigate') return caches.match(`${self.registration.scope}index.html`)
        return Response.error()
      }),
  )
})
