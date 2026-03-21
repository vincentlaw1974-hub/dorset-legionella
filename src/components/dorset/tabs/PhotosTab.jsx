import React, { useRef } from 'react';
import { uid } from '@/lib/jobUtils';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

const photoKinds = ['Cover Photo','Temperature Reading','Outlet','CWST','TMV','Dead Leg','Shower Head','Plant Room','Defect','General'];

export default function PhotosTab({ job, onChange }) {
  const [uploading, setUploading] = React.useState(false);
  const cameraRef = useRef();
  const uploadRef = useRef();

  const handlePhotos = async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    setUploading(true);
    const newPhotos = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newPhotos.push({ id: uid(), file_url, kind: 'General', location: '', caption: '' });
    }
    onChange({ photos: [...(job.photos || []), ...newPhotos] });
    setUploading(false);
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
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <strong>Photos</strong>
        <div className="flex gap-2">
          <button onClick={() => cameraRef.current.click()} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>Take photo</button>
          <button onClick={() => uploadRef.current.click()} className="text-sm px-3 py-2 rounded-xl font-bold bg-white border border-gray-300 text-gray-900">Upload photos</button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotos} className="hidden" />
          <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
        </div>
      </div>
      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm mb-3">
        A front cover photo should be added and marked as <strong>Cover Photo</strong>. Each photo also needs location and caption.
      </div>
      {uploading && <div className="flex items-center gap-2 text-sm text-gray-500 mb-3"><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</div>}
      <div className="space-y-3">
        {(job.photos || []).map(p => {
          const ready = (p.location || '').trim() && (p.caption || '').trim() && (p.kind || '').trim();
          return (
            <div key={p.id} className="border border-gray-200 rounded-2xl p-3">
              {p.file_url && <img src={p.file_url} alt="" className="w-full max-h-52 object-cover rounded-xl mb-3 bg-gray-100" />}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label>Kind</Label>
                  <select value={p.kind} onChange={e => updatePhoto(p.id, 'kind', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                    {photoKinds.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><Label>Location</Label><Input value={p.location} onChange={e => updatePhoto(p.id, 'location', e.target.value)} /></div>
              </div>
              <div className="mt-2"><Label>Caption</Label><Input value={p.caption} onChange={e => updatePhoto(p.id, 'caption', e.target.value)} /></div>
              <div className={`text-xs mt-2 ${ready ? 'text-green-700' : 'text-red-700'}`}>{ready ? 'Ready for report' : 'Add kind, location and caption'}</div>
              <button onClick={() => removePhoto(p.id)} className="mt-2 text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50">Remove photo</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}