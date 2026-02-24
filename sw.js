const CACHE_NAME = 'pielarmonia-v11-20260224-swopt1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/telemedicina.html',
    '/admin.html',
    '/admin.css',
    '/admin.js',
    '/styles-deferred.css?v=ui-20260223-clsfix1',
    '/js/bootstrap-inline-engine.js?v=figo-20260221-phase10-realagenda1',
    '/script.js?v=figo-20260222-slotservicefix1',
    // Fonts preloaded on every page
    '/fonts/plus-jakarta-sans.woff2',
    '/fonts/fraunces.woff2',
    // Deferred section content — needed for offline
    '/content/index.json',
    '/content/es.json',
    '/content/en.json',
    // Hero image responsive set (WebP — what the HTML actually preloads)
    '/images/optimized/hero-woman-640.webp',
    '/images/optimized/hero-woman-1024.webp',
    '/images/optimized/hero-woman-1344.webp',
    '/favicon.ico',
    '/manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png',
];

const NETWORK_ONLY_PREFIXES = [
    '/api.php',
    '/figo-chat.php',
    '/figo-ai-bridge.php',
    '/check-ai-response.php',
    '/figo-backend.php',
    '/admin-auth.php',
    '/stripe-webhook.php',
];

const CACHEABLE_EXTENSIONS = [
    '.css',
    '.js',
    '.json',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.avif',
    '.svg',
    '.gif',
    '.woff',
    '.woff2',
    '.ico',
];

function isSameOrigin(url) {
    return url.origin === self.location.origin;
}

function isNetworkOnlyPath(pathname) {
    return NETWORK_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isHtmlRequest(request, url) {
    if (request.mode === 'navigate') {
        return true;
    }
    const accept = request.headers.get('accept') || '';
    return accept.includes('text/html') || url.pathname.endsWith('.html');
}

function isCacheableAsset(pathname) {
    return CACHEABLE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function shouldUseNetworkFirstForAsset(pathname) {
    return (
        pathname.endsWith('.js') ||
        pathname.endsWith('.css') ||
        pathname.endsWith('.json')
    );
}

async function putInCache(request, response) {
    if (!response || response.status !== 200 || response.type !== 'basic') {
        return;
    }
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        await putInCache(request, networkResponse);
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

async function cacheFirst(request) {
    // Try exact URL first, then fall back to ignoring the query string so cached
    // assets are still served when a version bump changes only the ?v= param.
    const cachedResponse =
        (await caches.match(request)) ||
        (await caches.match(request, { ignoreSearch: true }));
    if (cachedResponse) {
        return cachedResponse;
    }

    const networkResponse = await fetch(request);
    await putInCache(request, networkResponse);
    return networkResponse;
}

// Serve from cache immediately while refreshing the cache entry in the background.
// Best for images: fast paint on repeat visits, always eventually fresh.
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);
    const networkFetch = fetch(request)
        .then((networkResponse) => {
            putInCache(request, networkResponse.clone());
            return networkResponse;
        })
        .catch(() => null);
    return cachedResponse || (await networkFetch);
}

function isImageAsset(pathname) {
    return ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif', '.ico'].some(
        (ext) => pathname.endsWith(ext)
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName !== CACHE_NAME)
                        .map((cacheName) => caches.delete(cacheName))
                )
            )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);
    if (!isSameOrigin(url)) {
        return;
    }

    if (isNetworkOnlyPath(url.pathname)) {
        event.respondWith(fetch(request));
        return;
    }

    if (isHtmlRequest(request, url)) {
        event.respondWith(networkFirst(request));
        return;
    }

    if (isCacheableAsset(url.pathname)) {
        if (shouldUseNetworkFirstForAsset(url.pathname)) {
            event.respondWith(networkFirst(request));
        } else if (isImageAsset(url.pathname)) {
            event.respondWith(staleWhileRevalidate(request));
        } else {
            event.respondWith(cacheFirst(request));
        }
        return;
    }

    event.respondWith(fetch(request));
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-appointments') {
        // Background sync placeholder - no-op for now
    }
});

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Piel en Armonía';
    const options = {
        body: data.body || 'Tienes una nueva notificación.',
        icon: '/images/icon-192.png',
        badge: '/images/icon-192.png',
        data: data.url || '/'
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.openWindow(event.notification.data)
    );
});
