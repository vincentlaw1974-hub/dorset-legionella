import { base44 } from '@/api/base44Client';

/**
 * Convert a File to a base64 data URL (works fully offline).
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload to CDN in background after saving locally.
 * Returns the CDN url, or null on failure.
 */
export async function uploadToCdn(file) {
  try {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  } catch (e) {
    return null;
  }
}

/**
 * Upload a base64 data URL to CDN. Returns CDN url or null.
 */
export async function uploadDataUrlToCdn(dataUrl) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });
    return await uploadToCdn(file);
  } catch {
    return null;
  }
}

/**
 * Strip base64 data URLs from a job before saving to server.
 */
export function stripBase64(job) {
  const clean = (url) => (url && url.startsWith('data:')) ? null : url;
  return {
    ...job,
    cover_photo_url: clean(job.cover_photo_url),
    photos: (job.photos || []).map(p => ({ ...p, file_url: clean(p.file_url) })).filter(p => p.file_url),
    outlets: (job.outlets || []).map(o => ({ ...o, photo_url: clean(o.photo_url) })),
    dead_legs: (job.dead_legs || []).map(d => ({ ...d, photo_url: clean(d.photo_url) })),
    showers: (job.showers || []).map(s => ({ ...s, photo_url: clean(s.photo_url) })),
    buildings: (job.buildings || []).map(b => ({
      ...b,
      photos: (b.photos || []).map(p => ({ ...p, file_url: clean(p.file_url) })).filter(p => p.file_url),
      outlets: (b.outlets || []).map(o => ({ ...o, photo_url: clean(o.photo_url) })),
    })),
  };
}