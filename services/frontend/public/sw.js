const CACHE_NAME = 'krishimitra-v1.0.0';
const STATIC_CACHE = 'krishimitra-static-v1';
const DYNAMIC_CACHE = 'krishimitra-dynamic-v1';
const API_CACHE = 'krishimitra-api-v1';

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/login',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
];

const API_ENDPOINTS = [
  '/api/v1/farms',
  '/api/v1/dashboard',
  '/api/v1/weather'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      }),
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => 
              cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== API_CACHE
            )
            .map((cacheName) => caches.delete(cacheName))
        );
      }),
      self.clients.claim()
    ])
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Handle static assets
  if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Handle images
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
    return;
  }

  // Default strategy for other requests
  event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
});

// Network first strategy (with fallback to cache)
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Cache first strategy (with network fallback)
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(processBackgroundSync());
  }
});

async function processBackgroundSync() {
  // Process queued offline actions
  const offlineActions = await getOfflineActions();
  
  for (const action of offlineActions) {
    try {
      await fetch(action.url, action.options);
      await removeOfflineAction(action.id);
    } catch (error) {
      console.log('Background sync failed for action:', action.id);
    }
  }
}

async function getOfflineActions() {
  // Implementation would read from IndexedDB
  return [];
}

async function removeOfflineAction(actionId) {
  // Implementation would remove from IndexedDB
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    image: data.image,
    tag: data.tag || 'default',
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/dashboard';

  if (data.url) {
    url = data.url;
  } else if (event.action) {
    // Handle action clicks
    switch (event.action) {
      case 'view':
        url = data.viewUrl || '/dashboard';
        break;
      case 'dismiss':
        return;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if none found
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
