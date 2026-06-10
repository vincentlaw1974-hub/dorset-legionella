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
 * Upload to CDN. Returns the CDN url, or null on failure.
 */
export async function uploadToCdn(file) {
  try {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  } catch {
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
 * Strip base64 data URLs from a job before saving to server (DB can't store them).
 */
export function stripBase64(job) {
  const clean = (url) => (url && url.startsWith('data:')) ? null : url;
  return {
    ...job,
    cover_photo_url: clean(job.cover_photo_url),
    cwst_photo_url: clean(job.cwst_photo_url),
    cylinder_photo_url: clean(job.cylinder_photo_url),
    plant_room_photo_url: clean(job.plant_room_photo_url),
    photos: (job.photos || []).map(p => ({ ...p, file_url: clean(p.file_url) || '' })),
    outlets: (job.outlets || []).map(o => ({ ...o, photo_url: clean(o.photo_url) })),
    dead_legs: (job.dead_legs || []).map(d => ({ ...d, photo_url: clean(d.photo_url) })),
    showers: (job.showers || []).map(s => ({ ...s, photo_url: clean(s.photo_url) })),
    buildings: (job.buildings || []).map(b => ({
      ...b,
      photos: (b.photos || []).map(p => ({ ...p, file_url: clean(p.file_url) || '' })),
      outlets: (b.outlets || []).map(o => ({ ...o, photo_url: clean(o.photo_url) })),
    })),
    tmv_register: (job.tmv_register || []).map(t => ({ ...t, photo_url: clean(t.photo_url) })),
  };
}

/**
 * Returns true if a job object contains any base64 photos.
 */
export function jobHasBase64Photos(job) {
  const isB64 = (u) => u && u.startsWith('data:');
  if (isB64(job.cover_photo_url)) return true;
  if (isB64(job.cwst_photo_url)) return true;
  if (isB64(job.cylinder_photo_url)) return true;
  if (isB64(job.plant_room_photo_url)) return true;
  if ((job.photos || []).some(p => isB64(p.file_url))) return true;
  if ((job.outlets || []).some(o => isB64(o.photo_url))) return true;
  if ((job.dead_legs || []).some(d => isB64(d.photo_url))) return true;
  if ((job.showers || []).some(s => isB64(s.photo_url))) return true;
  if ((job.buildings || []).some(b =>
    (b.photos || []).some(p => isB64(p.file_url)) ||
    (b.outlets || []).some(o => isB64(o.photo_url))
  )) return true;
  if ((job.tmv_register || []).some(t => isB64(t.photo_url))) return true;
  return false;
}