import React, { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { uid } from '@/lib/jobUtils';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';

const TMV_TYPES = ['Central / Shared TMV', 'Point-of-use TMV'];
const CONDITIONS = ['Good', 'Requires Attention', 'Failed'];
const FAILSAFE_OPTIONS = ['Yes', 'No', 'Not tested'];

function TmvPhotoUpload({ url, onChange }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const handle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const dataUrl = await fileToDataUrl(file);
    onChange({ photo_url: dataUrl });
    const cdnUrl = await uploadToCdn(file);
    if (cdnUrl) onChange({ photo_url: cdnUrl });
    setUploading(false);
    e.target.value = '';
  };
  return (
    <div>
      <Label>Photo</Label>
      {url ? (
        <div className="relative mt-1">
          <img src={url} alt="TMV" className="w-full rounded-xl border border-gray-200" style={{ maxHeight: 160, objectFit: 'cover' }} />
          <button onClick={() => onChange({ photo_url: null })} className="absolute top-2 right-2 bg-white border border-gray-300 rounded-full px-2 py-0.5 text-xs text-red-600 font-bold shadow">✕</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current.click()} disabled={uploading}
          className="mt-1 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-red-400 hover:text-red-500">
          {uploading ? '⏳ Uploading…' : '📷 Add photo'}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handle} className="hidden" />
    </div>
  );
}

function blankTmv() {
  return {
    id: uid(),
    ref: '',
    location: '',
    type: 'Point-of-use TMV',
    outlets_served: '',
    last_inspection: '',
    last_descale: '',
    failsafe_passed: 'Not tested',
    condition: 'Good',
    notes: '',
    photo_url: '',
  };
}

export default function TmvsTab({ job, onChange }) {
  const tmvs = job.tmv_register || [];

  const updateTmv = (id, patch) => {
    onChange({ tmv_register: tmvs.map(t => t.id === id ? { ...t, ...patch } : t) });
  };

  const addTmv = () => {
    onChange({ tmv_register: [...tmvs, blankTmv()] });
  };

  const removeTmv = (id) => {
    onChange({ tmv_register: tmvs.filter(t => t.id !== id) });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <strong>TMV Register ({tmvs.length})</strong>
      </div>

      {tmvs.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
          No TMVs recorded. Add one below.
        </div>
      )}

      <div className="space-y-4">
        {tmvs.map((tmv) => (
          <div key={tmv.id} className="border border-gray-200 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <strong className="text-sm">{tmv.ref || 'New TMV'}</strong>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                tmv.condition === 'Good' ? 'bg-green-100 text-green-800' :
                tmv.condition === 'Requires Attention' ? 'bg-amber-100 text-amber-800' :
                'bg-red-100 text-red-800'
              }`}>{tmv.condition || 'Good'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <Label>TMV Reference / ID</Label>
                <Input value={tmv.ref} onChange={e => updateTmv(tmv.id, { ref: e.target.value })} placeholder="e.g. TMV-01" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={tmv.location} onChange={e => updateTmv(tmv.id, { location: e.target.value })} placeholder="e.g. Ground floor plant room" />
              </div>
              <div>
                <Label>Type</Label>
                <select value={tmv.type} onChange={e => updateTmv(tmv.id, { type: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                  {TMV_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-full">
                <Label>Outlets Served</Label>
                <Input value={tmv.outlets_served} onChange={e => updateTmv(tmv.id, { outlets_served: e.target.value })} placeholder="e.g. Rooms 1, 2, 3, 4, 5, 6" />
              </div>
              <div>
                <Label>Last Inspection Date</Label>
                <Input type="date" value={tmv.last_inspection} onChange={e => updateTmv(tmv.id, { last_inspection: e.target.value })} />
              </div>
              <div>
                <Label>Last Descale Date</Label>
                <Input type="date" value={tmv.last_descale} onChange={e => updateTmv(tmv.id, { last_descale: e.target.value })} />
              </div>
              <div>
                <Label>Failsafe Test Passed</Label>
                <select value={tmv.failsafe_passed} onChange={e => updateTmv(tmv.id, { failsafe_passed: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                  {FAILSAFE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                {tmv.failsafe_passed === 'No' && <div className="text-xs text-red-600 mt-1 font-bold">⚠ Failsafe test FAILED — immediate attention required</div>}
              </div>
              <div>
                <Label>Condition</Label>
                <select value={tmv.condition} onChange={e => updateTmv(tmv.id, { condition: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-full">
                <Label>Notes</Label>
                <Textarea value={tmv.notes} onChange={e => updateTmv(tmv.id, { notes: e.target.value })} className="min-h-[56px]" />
              </div>
              <div className="col-span-full">
                <TmvPhotoUpload url={tmv.photo_url} onChange={patch => updateTmv(tmv.id, patch)} />
              </div>
            </div>

            <button onClick={() => removeTmv(tmv.id)} className="mt-3 text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50">
              Remove TMV
            </button>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 pt-3 pb-1 bg-white border-t border-gray-100 mt-4">
        <button
          onClick={addTmv}
          className="w-full py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: '#d71920' }}
        >
          + Add TMV
        </button>
      </div>
    </div>
  );
}