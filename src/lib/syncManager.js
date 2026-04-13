/**
 * Sync Manager
 * - Persists job drafts to localStorage (fast, always available)
 * - Also persists to IndexedDB so the service worker Background Sync can pick them up
 * - syncAllPendingDrafts() is called in-app when coming back online
 * - The SW sync tag 'sync-jobs' handles the fallback when the tab is closed
 */
import { base44 } from '@/api/base44Client';
import { uploadDataUrlToCdn, stripBase64 } from './photoUpload';

const DRAFT_PREFIX = 'job_draft_';
const IDB_NAME = 'dorset-sync';
const IDB_STORE = 'pending-jobs';
const SW_SYNC_TAG = 'sync-jobs';

// ── LocalStorage helpers ──────────────────────────────────────────────────────
export function saveDraft(jobId, data) {
  try { localStorage.setItem(DRAFT_PREFIX + jobId, JSON.stringify(data)); } catch {}
  // Also write to IndexedDB for SW Background Sync
  idbPut(jobId, data).catch(() => {});
  // Register a Background Sync tag so SW can retry even if tab closes
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg) => reg.sync.register(SW_SYNC_TAG))
      .catch(() => {});
  }
}

export function clearDraft(jobId) {
  try { localStorage.removeItem(DRAFT_PREFIX + jobId); } catch {}
  idbDelete(jobId).catch(() => {});
}

export function getDraft(jobId) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + jobId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getAllPendingDraftIds() {
  const ids = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) ids.push(key.slice(DRAFT_PREFIX.length));
    }
  } catch {}
  return ids;
}

// ── Base64 resolver (upgrades local photos to CDN before server push) ─────────
async function resolveBase64Photos(draft) {
  const isBase64 = (u) => u && u.startsWith('data:');
  const maybeUpload = async (url) => {
    if (!isBase64(url)) return url;
    const cdn = await uploadDataUrlToCdn(url);
    return cdn || url;
  };

  const resolved = { ...draft };
  if (isBase64(resolved.cover_photo_url)) resolved.cover_photo_url = await maybeUpload(resolved.cover_photo_url);
  if (isBase64(resolved.cwst_photo_url)) resolved.cwst_photo_url = await maybeUpload(resolved.cwst_photo_url);
  if (isBase64(resolved.cylinder_photo_url)) resolved.cylinder_photo_url = await maybeUpload(resolved.cylinder_photo_url);
  if (isBase64(resolved.plant_room_photo_url)) resolved.plant_room_photo_url = await maybeUpload(resolved.plant_room_photo_url);

  if (resolved.photos) resolved.photos = await Promise.all(resolved.photos.map(async (p) => ({ ...p, file_url: await maybeUpload(p.file_url) })));
  if (resolved.outlets) resolved.outlets = await Promise.all(resolved.outlets.map(async (o) => ({ ...o, photo_url: await maybeUpload(o.photo_url) })));
  if (resolved.dead_legs) resolved.dead_legs = await Promise.all(resolved.dead_legs.map(async (d) => ({ ...d, photo_url: await maybeUpload(d.photo_url) })));
  if (resolved.showers) resolved.showers = await Promise.all(resolved.showers.map(async (s) => ({ ...s, photo_url: await maybeUpload(s.photo_url) })));
  if (resolved.buildings) {
    resolved.buildings = await Promise.all(resolved.buildings.map(async (b) => ({
      ...b,
      photos: b.photos ? await Promise.all(b.photos.map(async (p) => ({ ...p, file_url: await maybeUpload(p.file_url) }))) : b.photos,
      outlets: b.outlets ? await Promise.all(b.outlets.map(async (o) => ({ ...o, photo_url: await maybeUpload(o.photo_url) }))) : b.outlets,
    })));
  }
  return resolved;
}

// ── Main sync (called in-app on reconnect) ────────────────────────────────────
export async function syncAllPendingDrafts() {
  const ids = getAllPendingDraftIds();
  if (ids.length === 0) return { synced: 0, failed: 0 };

  let synced = 0, failed = 0;
  await Promise.all(ids.map(async (id) => {
    let draft = getDraft(id);
    if (!draft) return;
    try {
      draft = await resolveBase64Photos(draft);
      saveDraft(id, draft); // save back with CDN urls
      await base44.entities.Job.update(id, stripBase64(draft));
      clearDraft(id);
      synced++;
    } catch {
      failed++;
    }
  }));
  return { synced, failed };
}

// ── IndexedDB helpers (used by SW Background Sync) ────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).delete(key);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}