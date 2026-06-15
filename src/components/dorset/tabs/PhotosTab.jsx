import React, { useRef, useState, useCallback } from 'react';
import { uid } from '@/lib/jobUtils';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

const photoKinds = ['Cover Photo','Temperature Reading','Outlet','CWST','TMV','Dead Leg','Shower Head','Plant Room','Defect','General'];

// Use AI to analyse the actual image content and tag it
async function detectPhotoMeta(dataUrl, rooms) {
  const roomNames = rooms.map(r => r.name);
  try {
    // Resize image to max 800px before uploading to save credits
    const resized = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const max = 800;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
    const blob = await (await fetch(resized)).blob();
    const { file_url } = await base44.integrations.Core.UploadFile({ file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }) });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are tagging a photo for a Legionella water safety risk assessment report.
Look at the image and respond with JSON only:
{
  "location": "<best matching room name from this list: ${JSON.stringify(roomNames)} — or empty string if none match or list is empty>",
  "kind": "<one of: Cover Photo, Temperature Reading, Outlet, CWST, TMV, Dead Leg, Shower Head, Plant Room, Defect, General>",
  "caption": "<short descriptive caption of what the photo shows, under 10 words>"
}
Pick the most accurate kind based on what you actually see in the image.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          kind: { type: 'string' },
          caption: { type: 'string' }
        }
      }
    });
    return result;
  } catch {
    return { location: '', kind: 'General', caption: '' };
  }
}

export default function PhotosTab({ job, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const cameraRef = useRef();
  const uploadRef = useRef();

  const upload = async (files, useAI = false) => {
    setUploading(true);
    for (const file of files) {
      const newId = uid();
      const dataUrl = await fileToDataUrl(file);

      let meta = { kind: 'General', location: '', caption: '' };
      if (useAI) {
        meta = await detectPhotoMeta(dataUrl, job.rooms || []);
        if (!photoKinds.includes(meta.kind)) meta.kind = 'General';
        const knownRooms = (job.rooms || []).map(r => r.name);
        if (!knownRooms.includes(meta.location)) meta.location = '';
      }

      // Step 1: Add photo with base64 immediately — visible & saved to IDB even if offline
      onChange({ __addPhoto: { id: newId, file_url: dataUrl, kind: meta.kind, location: meta.location, caption: meta.caption } });

      // Step 2: Try CDN upload in background.
      // If it works → upgrade the photo url to CDN (permanent, fast).
      // If it fails → the base64 stays in IDB and syncAllPendingDrafts will upload it on reconnect.
      if (navigator.onLine) {
        uploadToCdn(file).then(cdnUrl => {
          if (cdnUrl) {
            onChange({ __photoUpgrade: { id: newId, url: cdnUrl } });
          }
          // No else needed — saveDraft is called by handleChange on every __addPhoto
        }).catch(() => {});
      }
      // If offline, do nothing — the draft in IDB will sync on reconnect
    }
    setUploading(false);
  };

  const handleInput = (e) => {
    const files = [...e.target.files];
    if (files.length > 0) upload(files, true);
    e.target.value = '';
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (files.length > 0) upload(files, true);
  }, []);

  const updatePhoto = (id, field, value) => {
    onChange({ photos: (job.photos || []).map(p => p.id === id ? { ...p, [field]: value } : p) });
  };

  const removePhoto = (id) => {
    onChange({ photos: (job.photos || []).filter(p => p.id !== id) });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <strong className="block mb-3">Photos</strong>

      {/* Drag and drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-4 border-2 border-dashed rounded-2xl p-6 text-center transition-all ${dragOver ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'}`}
      >
        <div className="text-3xl mb-1">🖼️</div>
        <div className="text-sm font-semibold text-gray-700">Drag &amp; drop photos here</div>
        <div className="text-xs text-gray-500 mt-1">
          {(job.rooms || []).length > 0
            ? '✨ AI will detect the room and type from the filename'
            : 'Add rooms first to enable AI auto-tagging'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => cameraRef.current.click()}
          className="py-5 rounded-2xl font-bold text-white flex flex-col items-center gap-1.5"
          style={{ background: '#d71920' }}
        >
          <span className="text-2xl">📷</span>
          <span className="text-sm">Take photo</span>
        </button>
        <button
          onClick={() => uploadRef.current.click()}
          className="py-5 rounded-2xl font-bold bg-white border-2 border-gray-300 text-gray-800 flex flex-col items-center gap-1.5"
        >
          <span className="text-2xl">📁</span>
          <span className="text-sm">Upload</span>
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleInput} className="hidden" />
      <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handleInput} className="hidden" />

      {uploading && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">✨ AI is tagging photos from filenames…</div>}

      <div className="space-y-4">
        {(job.photos || []).map(p => {
          const ready = (p.location || '').trim() && (p.kind || '').trim();
          return (
            <div key={p.id} className="border border-gray-200 rounded-2xl p-3">
              {p.file_url && (
                <div className="w-full bg-gray-100 rounded-xl mb-3 flex items-center justify-center" style={{ minHeight: '160px' }}>
                  <img src={p.file_url} alt="" style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }} />
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <Label>Kind</Label>
                  <select value={p.kind} onChange={e => updatePhoto(p.id, 'kind', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base">
                    {photoKinds.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Location</Label>
                  {(job.rooms || []).length > 0 ? (
                    <select value={p.location} onChange={e => updatePhoto(p.id, 'location', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base">
                      <option value="">-- select room --</option>
                      {(job.rooms || []).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  ) : (
                    <Input className="h-12 text-base" value={p.location} onChange={e => updatePhoto(p.id, 'location', e.target.value)} />
                  )}
                </div>
                <div>
                  <Label>Caption</Label>
                  <Input className="h-12 text-base" value={p.caption} onChange={e => updatePhoto(p.id, 'caption', e.target.value)} />
                </div>
              </div>
              <div className={`text-xs mt-2 font-medium ${ready ? 'text-green-700' : 'text-amber-600'}`}>
                {ready ? '✓ Ready for report' : '⚠ Add kind and location'}
              </div>
              <button onClick={() => removePhoto(p.id)} className="mt-3 w-full py-3 rounded-xl bg-white text-red-600 border border-red-200 font-bold text-sm">
                Remove photo
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}