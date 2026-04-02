import React, { useState, useRef } from 'react';
import { uid, today } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

const conditions = ['Good', 'Fair', 'Poor – scale/biofilm present', 'Replaced this visit'];

export default function ShowersTab({ job, onChange }) {
  const [uploading, setUploading] = React.useState(null);
  const fileRefs = React.useRef({});
  const showers = job.showers || [];
  const rooms = (job.rooms || []).map(r => r.name).filter(Boolean);

  const addShower = () => {
    onChange({ showers: [...showers, { id: uid(), location: '', last_descale: today(), condition: 'Good', notes: '', photo_url: '' }] });
  };

  const update = (id, field, value) => {
    onChange({ showers: showers.map(s => s.id === id ? { ...s, [field]: value } : s) });
  };

  const remove = (id) => {
    onChange({ showers: showers.filter(s => s.id !== id) });
  };

  const handlePhoto = async (id, file) => {
    if (!file) return;
    setUploading(id);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update(id, 'photo_url', file_url);
    setUploading(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <strong>Shower head register</strong>
        <button onClick={addShower} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
          Add shower head
        </button>
      </div>
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm mb-3">
        Record each shower head and hose on site. Each needs a location, last descale date, condition, and photo where possible.
      </div>

      {showers.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6">No shower heads recorded.</div>
      )}

      <div className="space-y-3">
        {showers.map(s => (
          <div key={s.id} className="border border-gray-200 rounded-2xl p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label>Location</Label>
                {rooms.length > 0 ? (
                  <select value={s.location} onChange={e => update(s.id, 'location', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{fontSize:'16px'}}>
                    <option value="">Select room...</option>
                    {rooms.map(r => <option key={r}>{r}</option>)}
                    <option value="__other">Other</option>
                  </select>
                ) : (
                  <Input value={s.location} onChange={e => update(s.id, 'location', e.target.value)} placeholder="e.g. Room 1 Ensuite" />
                )}
              </div>
              <div>
                <Label>Last descale date</Label>
                <Input type="date" value={s.last_descale} onChange={e => {
                  const val = e.target.value;
                  const next = val ? new Date(new Date(val).setMonth(new Date(val).getMonth() + 3)).toISOString().slice(0,10) : '';
                  update(s.id, 'last_descale', val);
                  update(s.id, 'next_descale', next);
                }} />
              </div>
              <div>
                <Label>Next descale due <span className="text-xs text-gray-400">(auto: +3 months)</span></Label>
                <Input type="date" value={s.next_descale || ''} onChange={e => update(s.id, 'next_descale', e.target.value)} />
                {s.next_descale && new Date(s.next_descale) < new Date() && (
                  <div className="text-xs text-red-600 mt-1 font-bold">⚠ Descale overdue</div>
                )}
              </div>
              <div>
                <Label>Condition</Label>
                <select value={s.condition} onChange={e => update(s.id, 'condition', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{fontSize:'16px'}}>
                  {conditions.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2"><Label>Notes</Label><Textarea value={s.notes} onChange={e => update(s.id, 'notes', e.target.value)} className="min-h-[50px]" /></div>
            <div className="mt-2">
              {s.photo_url ? (
                <div>
                  <Label>Photo</Label>
                  <div className="w-full aspect-video bg-gray-100 rounded-xl overflow-hidden mt-1 mb-1">
                    <img src={s.photo_url} alt="Shower head" className="w-full h-full object-contain" />
                  </div>
                  <button onClick={() => update(s.id, 'photo_url', '')} className="text-xs text-red-600 underline">Remove photo</button>
                </div>
              ) : (
                <div>
                  <input ref={el => fileRefs.current[s.id] = el} type="file" accept="image/*" className="hidden" onChange={e => handlePhoto(s.id, e.target.files[0])} />
                  <button onClick={() => fileRefs.current[s.id]?.click()} disabled={uploading === s.id} className="text-sm px-3 py-1.5 rounded-xl bg-white border border-gray-300 font-medium hover:bg-gray-50 flex items-center gap-1">
                    {uploading === s.id ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</> : 'Add photo'}
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2">
              <button onClick={() => remove(s.id)} className="text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}