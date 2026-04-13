import { base44 } from '@/api/base44Client';

/**
 * Convert a File to a base64 data URL synchronously (works offline).
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
 * Save photo immediately as a base64 data URL (so it's never lost),
 * then attempt to upload to CDN and call onUploaded(cdnUrl) if it succeeds.
 *
 * Usage:
 *   await savePhotoImmediately(file,
 *     (dataUrl) => update(id, 'photo_url', dataUrl),   // instant save
 *     (cdnUrl)  => update(id, 'photo_url', cdnUrl)     // background upgrade
 *   );
 */
export async function savePhotoImmediately(file, onImmediate, onUploaded) {
  const dataUrl = await fileToDataUrl(file);
  onImmediate(dataUrl);
  try {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUploaded(file_url);
  } catch {
    // Keep the base64 data URL — it will be included in the next sync
  }
}