/**
 * Sync Manager — persists job drafts to localStorage and flushes them
 * to the server whenever the device comes back online.
 */
import { base44 } from '@/api/base44Client';

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
export async function syncAllPendingDrafts() {
  const ids = getAllPendingDraftIds();
  if (ids.length === 0) return { synced: 0, failed: 0 };

  let synced = 0, failed = 0;
  await Promise.all(ids.map(async (id) => {
    const draft = getDraft(id);
    if (!draft) return;
    try {
      await base44.entities.Job.update(id, draft);
      clearDraft(id);
      synced++;
    } catch {
      failed++;
    }
  }));
  return { synced, failed };
}