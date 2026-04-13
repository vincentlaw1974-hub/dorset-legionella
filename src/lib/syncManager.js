/**
 * Sync Manager — persists job drafts to localStorage and flushes them
 * to the server whenever the device comes back online.
 * Base64 images are re-uploaded to CDN before sending to server.
 */
import { base44 } from '@/api/base44Client';
import { uploadDataUrlToCdn } from './photoUpload';

const DRAFT_PREFIX = 'job_draft_';

export function saveDraft(jobId, data) {
  try {
    localStorage.setItem(DRAFT_PREFIX + jobId, JSON.stringify(data));
  } catch {}
}

export function clearDraft(jobId) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + jobId);
  } catch {}
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
      if (key && key.startsWith(DRAFT_PREFIX)) {
        ids.push(key.slice(DRAFT_PREFIX.length));
      }
    }
  } catch {}
  return ids;
}

/**
 * Sync every pending draft to the server.
 * Returns { synced: number, failed: number }
 */
/**
 * Walk a draft and replace any base64 data URLs with CDN uploads.
 */
async function resolveBase64Photos(draft) {
  const isBase64 = (u) => u && u.startsWith('data:');

  async function maybeUpload(url) {
    if (!isBase64(url)) return url;
    const cdnUrl = await uploadDataUrlToCdn(url);
    return cdnUrl || url; // keep base64 if upload fails
  }

  const resolved = { ...draft };

  if (isBase64(resolved.cover_photo_url)) {
    resolved.cover_photo_url = await maybeUpload(resolved.cover_photo_url);
  }

  if (resolved.photos) {
    resolved.photos = await Promise.all(
      resolved.photos.map(async (p) => ({ ...p, file_url: await maybeUpload(p.file_url) }))
    );
  }

  if (resolved.outlets) {
    resolved.outlets = await Promise.all(
      resolved.outlets.map(async (o) => ({ ...o, photo_url: await maybeUpload(o.photo_url) }))
    );
  }

  if (resolved.dead_legs) {
    resolved.dead_legs = await Promise.all(
      resolved.dead_legs.map(async (d) => ({ ...d, photo_url: await maybeUpload(d.photo_url) }))
    );
  }

  if (resolved.showers) {
    resolved.showers = await Promise.all(
      resolved.showers.map(async (s) => ({ ...s, photo_url: await maybeUpload(s.photo_url) }))
    );
  }

  if (resolved.buildings) {
    resolved.buildings = await Promise.all(
      resolved.buildings.map(async (b) => ({
        ...b,
        photos: b.photos ? await Promise.all(b.photos.map(async (p) => ({ ...p, file_url: await maybeUpload(p.file_url) }))) : b.photos,
        outlets: b.outlets ? await Promise.all(b.outlets.map(async (o) => ({ ...o, photo_url: await maybeUpload(o.photo_url) }))) : b.outlets,
      }))
    );
  }

  return resolved;
}

export async function syncAllPendingDrafts() {
  const ids = getAllPendingDraftIds();
  if (ids.length === 0) return { synced: 0, failed: 0 };

  let synced = 0, failed = 0;
  await Promise.all(ids.map(async (id) => {
    let draft = getDraft(id);
    if (!draft) return;
    try {
      // Re-upload any base64 photos to CDN first
      draft = await resolveBase64Photos(draft);
      // Update the draft in localStorage with CDN urls
      saveDraft(id, draft);
      await base44.entities.Job.update(id, draft);
      clearDraft(id);
      synced++;
    } catch {
      failed++;
    }
  }));
  return { synced, failed };
}