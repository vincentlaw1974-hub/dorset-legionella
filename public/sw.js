/**
 * Dorset Plumbing — Service Worker
 * - Caches app shell assets (cache-first for static, network-first for API)
 * - Background Sync: retries pending job mutations when back online
 */

const CACHE_NAME = 'dorset-v2';
const SYNC_TAG = 'sync-jobs';

// App shell assets to pre-cache
const PRECACHE_URLS = ['/', '/index.html'];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {})
    )
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for navigation; network-first for API ───────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin API requests
  if (request.method !== 'GET') return;
  if (url.hostname !== self.location.hostname && !url.pathname.startsWith('/assets')) return;

  // API calls — network first, no caching
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/functions')) {
    return;
  }

  // Static assets — cache first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchAndCache = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => cached); // offline fallback to cache
      return cached || fetchAndCache;
    })
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncPendingJobs());
  }
});

async function syncPendingJobs() {
  // Read all pending drafts from IndexedDB (written by syncManager.js)
  const db = await openDB();
  const ids = await getAllKeys(db);
  if (ids.length === 0) return;

  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const draft = await getRecord(db, id);
      if (!draft) return;
      // Strip base64 fields before sending to server
      const clean = stripBase64Fields(draft);
      const resp = await fetch(`/api/entities/Job/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clean),
      });
      if (resp.ok) {
        await deleteRecord(db, id);
      }
    })
  );

  // Notify all open clients that sync is done
  const synced = results.filter((r) => r.status === 'fulfilled').length;
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) =>
    client.postMessage({ type: 'SYNC_COMPLETE', synced, total: ids.length })
  );
}

function stripBase64Fields(job) {
  const clean = (url) => (url && url.startsWith('data:') ? null : url);
  return {
    ...job,
    cover_photo_url: clean(job.cover_photo_url),
    cwst_photo_url: clean(job.cwst_photo_url),
    cylinder_photo_url: clean(job.cylinder_photo_url),
    plant_room_photo_url: clean(job.plant_room_photo_url),
    photos: (job.photos || []).map((p) => ({ ...p, file_url: clean(p.file_url) })).filter((p) => p.file_url),
    outlets: (job.outlets || []).map((o) => ({ ...o, photo_url: clean(o.photo_url) })),
    dead_legs: (job.dead_legs || []).map((d) => ({ ...d, photo_url: clean(d.photo_url) })),
    showers: (job.showers || []).map((s) => ({ ...s, photo_url: clean(s.photo_url) })),
    buildings: (job.buildings || []).map((b) => ({
      ...b,
      photos: (b.photos || []).map((p) => ({ ...p, file_url: clean(p.file_url) })).filter((p) => p.file_url),
      outlets: (b.outlets || []).map((o) => ({ ...o, photo_url: clean(o.photo_url) })),
    })),
  };
}

// ── Tiny IndexedDB helpers (mirrors syncManager.js localStorage keys) ─────────
const IDB_NAME = 'dorset-sync';
const IDB_STORE = 'pending-jobs';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllKeys(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getRecord(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteRecord(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
