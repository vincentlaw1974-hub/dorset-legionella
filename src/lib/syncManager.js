/**
 * Sync Manager — bulletproof offline photo sync
 *
 * Strategy:
 * 1. All job changes (including base64 photos) are written to IndexedDB immediately.
 * 2. A separate "pending" set in localStorage tracks which job IDs have unsynced data.
 *    This is tiny (just IDs) so it never gets pruned.
 * 3. On reconnect (or every 30s), pending jobs are read from IDB, photos uploaded to CDN,
 *    then the clean job is pushed to the server.
 * 4. The in-memory job is updated with CDN urls so photos display immediately after sync.
 */
import { base44 } from '@/api/base44Client';
import { uploadDataUrlToCdn, stripBase64, jobHasBase64Photos } from './photoUpload';

const IDB_NAME = 'dorset-sync-v2';
const IDB_STORE = 'jobs';
const PENDING_KEY = 'dorset_pending_ids'; // localStorage key — stores JSON array of job IDs

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(value, key);
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[sync] idbPut failed:', e);
  }
}

async function idbGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}

async function idbDelete(key) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).delete(key);
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

// ── Pending ID set (tiny — safe in localStorage) ──────────────────────────────
function getPendingIds() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch { return []; }
}

function addPendingId(id) {
  try {
    const ids = getPendingIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(PENDING_KEY, JSON.stringify(ids));
    }
  } catch {}
}

function removePendingId(id) {
  try {
    const ids = getPendingIds().filter(i => i !== id);
    localStorage.setItem(PENDING_KEY, JSON.stringify(ids));
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persist full job data (including base64 photos) to IDB and mark as pending sync.
 */
export async function saveDraft(jobId, data) {
  addPendingId(jobId);
  await idbPut(jobId, data);
}

/**
 * Remove draft and pending marker once synced successfully.
 */
export function clearDraft(jobId) {
  removePendingId(jobId);
  idbDelete(jobId);
}

/**
 * Get a saved draft from IDB (returns null if not found).
 */
export async function getDraft(jobId) {
  return await idbGet(jobId);
}

/**
 * Check if there are any pending drafts (for UI indicator).
 */
export function getAllPendingDraftIds() {
  return getPendingIds();
}

// ── Upload base64 photos within a job to CDN, return updated job ──────────────
async function resolveBase64Photos(draft) {
  const isBase64 = (u) => u && u.startsWith('data:');
  const maybeUpload = async (url) => {
    if (!isBase64(url)) return url;
    const cdn = await uploadDataUrlToCdn(url);
    return cdn || url; // fall back to base64 if CDN fails — will retry next sync
  };

  const resolved = { ...draft };

  // Top-level photo fields
  for (const field of ['cover_photo_url', 'cwst_photo_url', 'cylinder_photo_url', 'plant_room_photo_url']) {
    if (isBase64(resolved[field])) resolved[field] = await maybeUpload(resolved[field]);
  }

  if (resolved.photos) {
    resolved.photos = await Promise.all(resolved.photos.map(async (p) => ({
      ...p, file_url: await maybeUpload(p.file_url)
    })));
  }
  if (resolved.outlets) {
    resolved.outlets = await Promise.all(resolved.outlets.map(async (o) => ({
      ...o, photo_url: await maybeUpload(o.photo_url)
    })));
  }
  if (resolved.dead_legs) {
    resolved.dead_legs = await Promise.all(resolved.dead_legs.map(async (d) => ({
      ...d, photo_url: await maybeUpload(d.photo_url)
    })));
  }
  if (resolved.showers) {
    resolved.showers = await Promise.all(resolved.showers.map(async (s) => ({
      ...s, photo_url: await maybeUpload(s.photo_url)
    })));
  }
  if (resolved.buildings) {
    resolved.buildings = await Promise.all(resolved.buildings.map(async (b) => ({
      ...b,
      photos: b.photos ? await Promise.all(b.photos.map(async (p) => ({
        ...p, file_url: await maybeUpload(p.file_url)
      }))) : b.photos,
      outlets: b.outlets ? await Promise.all(b.outlets.map(async (o) => ({
        ...o, photo_url: await maybeUpload(o.photo_url)
      }))) : b.outlets,
    })));
  }
  return resolved;
}

// ── Main sync ─────────────────────────────────────────────────────────────────
let _syncInProgress = false;

export async function syncAllPendingDrafts() {
  if (_syncInProgress) return { synced: 0, failed: 0, resolvedDrafts: {} };
  _syncInProgress = true;

  const ids = getPendingIds();
  if (ids.length === 0) {
    _syncInProgress = false;
    return { synced: 0, failed: 0, resolvedDrafts: {} };
  }

  let synced = 0, failed = 0;
  const resolvedDrafts = {};

  for (const id of ids) {
    let draft = await idbGet(id);
    if (!draft) {
      removePendingId(id);
      continue;
    }

    try {
      // Upload any base64 photos to CDN first
      draft = await resolveBase64Photos(draft);

      // Check if any photos still failed to upload (still base64) — if so, keep draft
      const stillHasBase64 = jobHasBase64Photos(draft);

      // Save the CDN-resolved draft back to IDB (so next sync uses CDN urls)
      await idbPut(id, draft);

      // Push to server — strip any remaining base64 that couldn't be uploaded
      await base44.entities.Job.update(id, stripBase64(draft));

      if (!stillHasBase64) {
        // All photos uploaded — clear the pending draft
        removePendingId(id);
        await idbDelete(id);
      }
      // Always return the resolved draft so UI can update photo urls
      resolvedDrafts[id] = draft;
      synced++;
    } catch (err) {
      console.warn('[sync] Failed to sync job', id, err?.message);
      if (err?.message?.includes('404') || err?.status === 404) {
        // Job deleted — discard draft
        removePendingId(id);
        await idbDelete(id);
      }
      failed++;
    }
  }

  _syncInProgress = false;
  return { synced, failed, resolvedDrafts };
}