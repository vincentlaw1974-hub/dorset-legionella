import React, { useRef, useState, useCallback } from 'react';
import { uid } from '@/lib/jobUtils';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, RotateCcw, RotateCw, X } from 'lucide-react';

const photoKinds = ['Cover Photo','Temperature Reading','Outlet','CWST','TMV','Dead Leg','Shower Head','Plant Room','Defect','General'];

export default function PhotosTab({ job, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [editor, setEditor] = useState(null); // { file, dataUrl, rotation }
  const cameraRef = useRef();
  const uploadRef = useRef();

  // Load file into editor
  const openEditor = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setEditor({ file, dataUrl: e.target.result, rotation: 0 });
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => {
    const files = [...e.target.files];
    if (files.length) openEditor(files[0]);
    e.target.value = '';
  };

  const rotate = (deg) => setEditor(ed => ({ ...ed, rotation: (ed.rotation + deg + 360) % 360 }));

  const savePhoto = useCallback(async () => {
    if (!editor) return;
    setUploading(true);
    setEditor(null);

    // Apply rotation to canvas then upload
    const img = new Image();
    img.onload = async () => {
      const { rotation } = editor;
      const swap = rotation === 90 || rotation === 270;
      const canvas = document.createElement('canvas');
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      canvas.toBlob(async (blob) => {
        const file = new File([blob], editor.file.name, { type: 'image/jpeg' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        onChange({ photos: [...(job.photos || []), { id: uid(), file_url, kind: 'General', location: '', caption: '' }] });
        setUploading(false);
      }, 'image/jpeg', 0.9);
    };
    img.src = editor.dataUrl;
  }, [editor, job, onChange]);

  const updatePhoto = (id, field, value) => {
    onChange({ photos: (job.photos || []).map(p => p.id === id ? { ...p, [field]: value } : p) });
  };

  const removePhoto = (id) => {
    onChange({ photos: (job.photos || []).filter(p => p.id !== id) });
  };

  return (
    <>
      {/* Photo rotation editor overlay */}
      {editor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <strong>Edit photo</strong>
              <button onClick={() => setEditor(null)} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Rotate until the photo looks correct, then save it.</p>
            <div className="w-full aspect-video bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center mb-4">
              <img
                src={editor.dataUrl}
                alt="Preview"
                style={{ transform: `rotate(${editor.rotation}deg)`, maxWidth: '100%', maxHeight: '100%', transition: 'transform 0.2s' }}
              />
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={() => rotate(-90)} className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl border border-gray-300 bg-white font-medium hover:bg-gray-50">
                <RotateCcw className="w-4 h-4" /> Rotate left
              </button>
              <button onClick={() => rotate(90)} className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl border border-gray-300 bg-white font-medium hover:bg-gray-50">
                <RotateCw className="w-4 h-4" /> Rotate right
              </button>
              <button onClick={savePhoto} className="flex-1 text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
                Use this photo
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <strong>Photos</strong>
          <div className="flex gap-2">
            <button onClick={() => cameraRef.current.click()} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>Take photo</button>
            <button onClick={() => uploadRef.current.click()} className="text-sm px-3 py-2 rounded-xl font-bold bg-white border border-gray-300 text-gray-900">Upload photos</button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileInput} className="hidden" />
            <input ref={uploadRef} type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
          </div>
        </div>
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm mb-3">
          Use <strong>Take photo</strong> on site for direct camera capture. Each photo opens in an edit step so you can rotate it. Every photo needs a location, type, and caption.
        </div>
        {uploading && <div className="flex items-center gap-2 text-sm text-gray-500 mb-3"><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</div>}
        <div className="space-y-3">
          {(job.photos || []).map(p => {
            const ready = (p.location || '').trim() && (p.caption || '').trim() && (p.kind || '').trim();
            return (
              <div key={p.id} className="border border-gray-200 rounded-2xl p-3">
                {p.file_url && (
                  <div className="w-full aspect-video bg-gray-100 rounded-xl mb-3 overflow-hidden">
                    <img src={p.file_url} alt="" className="w-full h-full object-contain" />
                  </div>
                )}
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
    </>
  );
}