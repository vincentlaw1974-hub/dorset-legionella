import React, { useRef, useState } from 'react';
import { uid } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { savePhotoImmediately } from '@/lib/photoUpload';
import { Loader2 } from 'lucide-react';

export default function DeadLegsTab({ job, onChange }) {
  const [uploading, setUploading] = React.useState(null);
  const fileRefs = React.useRef({});
  const deadLegs = job.dead_legs || [];
  const rooms = (job.rooms || []).map(r => r.name).filter(Boolean);

  const addDeadLeg = () => {
    onChange({ dead_legs: [...deadLegs, { id: uid(), location: '', description: '', action: '', photo_url: '' }] });
  };

  const update = (id, field, value) => {
    onChange({ dead_legs: deadLegs.map(d => d.id === id ? { ...d, [field]: value } : d) });
  };

  const remove = (id) => {
    onChange({ dead_legs: deadLegs.filter(d => d.id !== id) });
  };

  const handlePhoto = async (id, file) => {
    if (!file) return;
    setUploading(id);
    await savePhotoImmediately(
      file,
      (dataUrl) => update(id, 'photo_url', dataUrl),
      (cdnUrl)  => update(id, 'photo_url', cdnUrl)
    );
    setUploading(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <strong>Dead legs / blind ends</strong>
        <button onClick={addDeadLeg} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
          Add dead leg
        </button>
      </div>
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm mb-3">
        Document each dead leg or blind-ended pipe. Each record requires a location, description, and recommended action. Add a photo where possible. Dead legs are a key L8 risk factor — removal or a management regime must be documented.
      </div>

      {deadLegs.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6">No dead legs recorded.</div>
      )}

      <div className="space-y-3">
        {deadLegs.map(d => (
          <div key={d.id} className="border border-gray-200 rounded-2xl p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label>Location</Label>
                {rooms.length > 0 ? (
                  <select value={d.location} onChange={e => update(d.id, 'location', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{fontSize:'16px'}}>
                    <option value="">Select room...</option>
                    {rooms.map(r => <option key={r}>{r}</option>)}
                    <option value="__other">Other</option>
                  </select>
                ) : (
                  <Input value={d.location} onChange={e => update(d.id, 'location', e.target.value)} placeholder="e.g. Plant room" />
                )}
              </div>
            </div>
            <div className="mt-2"><Label>Description</Label><Textarea value={d.description} onChange={e => update(d.id, 'description', e.target.value)} placeholder="Describe the dead leg or blind end" className="min-h-[60px]" /></div>
            <div className="mt-2"><Label>Recommended action</Label><Textarea value={d.action} onChange={e => update(d.id, 'action', e.target.value)} placeholder="e.g. Remove dead leg or implement flushing regime" className="min-h-[60px]" /></div>
            <div className="mt-2">
              {d.photo_url ? (
                <div>
                  <Label>Photo</Label>
                  <div className="w-full aspect-video bg-gray-100 rounded-xl overflow-hidden mt-1 mb-1">
                    <img src={d.photo_url} alt="Dead leg" className="w-full h-full object-contain" />
                  </div>
                  <button onClick={() => update(d.id, 'photo_url', '')} className="text-xs text-red-600 underline">Remove photo</button>
                </div>
              ) : (
                <div>
                  <input ref={el => fileRefs.current[d.id] = el} type="file" accept="image/*" className="hidden" onChange={e => handlePhoto(d.id, e.target.files[0])} />
                  <button onClick={() => fileRefs.current[d.id]?.click()} disabled={uploading === d.id} className="text-sm px-3 py-1.5 rounded-xl bg-white border border-gray-300 font-medium hover:bg-gray-50 flex items-center gap-1">
                    {uploading === d.id ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</> : 'Add photo'}
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2">
              <button onClick={() => remove(d.id)} className="text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}