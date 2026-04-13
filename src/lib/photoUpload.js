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