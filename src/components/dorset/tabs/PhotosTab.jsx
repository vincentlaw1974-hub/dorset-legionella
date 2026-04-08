import React, { useRef, useState } from 'react';
import { uid } from '@/lib/jobUtils';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const photoKinds = ['Cover Photo','Temperature Reading','Outlet','CWST','TMV','Dead Leg','Shower Head','Plant Room','Defect','General'];

export default function PhotosTab({ job, onChange }) {
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef();
  const uploadRef = useRef();

  const upload = async (files) => {
    setUploading(true);
    const newPhotos = [...(job.photos || [])];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newPhotos.push({ id: uid(), file_url, kind: 'General', location: '', caption: '' });
    }
    onChange({ photos: newPhotos });
    setUploading(false);
  };

  const handleInput = (e) => {
    const files = [...e.target.files];
    if (files.length > 0) upload(files);
    e.target.value = '';
  };

  const updatePhoto = (id, field, value) => {
    onChange({ photos: (job.photos || []).map(p => p.id === id ? { ...p, [field]: value } : p) });
  };

  const removePhoto = (id) => {
    onChange({ photos: (job.photos || []).filter(p => p.id !== id) });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <strong className="block mb-3">Photos</strong>

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

      {uploading && <div className="text-sm text-gray-500 mb-3">Uploading…</div>}

      <div className="space-y-4">
        {(job.photos || []).map(p => {
          const ready = (p.location || '').trim() && (p.caption || '').trim() && (p.kind || '').trim();
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
                {ready ? '✓ Ready for report' : '⚠ Add kind, location and caption'}
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