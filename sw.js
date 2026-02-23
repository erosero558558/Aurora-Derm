const CACHE_NAME = 'pielarmonia-v11-20260224-sw-fix';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/telemedicina.html',
    '/admin.html',
    '/admin.css?v=admin-css-fix-login1',
    '/admin.js',
    '/styles.min.css',
    '/admin.min.css',
    '/styles-deferred.css?v=ui-20260223-clsfix1',
    '/js/bootstrap-inline-engine.js?v=figo-20260221-phase10-realagenda1',
    '/script.js?v=figo-20260222-slotservicefix1',
    '/js/engines/ui-bundle.js?v=20260220-consolidated1&cv=figo-20260221-phase10-realagenda1',
    '/js/engines/data-bundle.js?v=20260220-consolidated1&cv=figo-20260221-phase10-realagenda1',
    '/js/engines/data-engine.js?v=figo-data-20260219-phase1&cv=figo-20260221-phase10-realagenda1',
    '/js/engines/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1&cv=figo-20260221-phase10-realagenda1',
    '/images/optimized/hero-woman.jpg',
    '/favicon.ico',
    '/manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png',
    '/fonts/plus-jakarta-sans.woff2',
    '/fonts/fraunces.woff2',
];

const NETWORK_ONLY_PREFIXES = [
    '/api.php',
    '/figo-chat.php',
    '/figo-ai-bridge.php',
    '/check-ai-response.php',
    '/figo-backend.php',
    '/proxy.php',
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
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    const networkResponse = await fetch(request);
    await putInCache(request, networkResponse);
    return networkResponse;
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
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
        event.respondWith(
            shouldUseNetworkFirstForAsset(url.pathname)
                ? networkFirst(request)
                : cacheFirst(request)
        );
        return;
    }

    event.respondWith(fetch(request));
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-appointments') {
        // Placeholder for background sync logic.
        // Full implementation requires IndexedDB instead of localStorage (which is currently used).
        // This handler is ready for future integration.
        console.log('[SW] Sync event triggered for appointments');
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
