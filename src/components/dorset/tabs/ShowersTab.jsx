import React from 'react';
import { uid, today } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';
import { Loader2 } from 'lucide-react';

const CONDITIONS = [
  'Good',
  'Fair — minor scale present',
  'Poor — heavy scale present',
  'Poor — biofilm present',
  'Poor — scale and biofilm present',
  'Requires immediate replacement',
];

export default function ShowersTab({ job, onChange }) {
  const [uploading, setUploading] = React.useState(null);
  const showers = job.showers || [];
  const rooms = (job.rooms || []).map(r => r.name).filter(Boolean);

  const addShower = () => {
    onChange({ showers: [...showers, { id: uid(), location: '', last_descale: today(), condition: 'Good', notes: '', photo_url: '' }] });
  };

  const handleConditionChange = (shower, newCondition) => {
    const fields = { condition: newCondition };
    // Auto-create remedial action if condition is not Good
    if (newCondition !== 'Good') {
      const location = shower.location || 'unknown location';
      const newAction = {
        id: uid(),
        ref: `S${Date.now()}`,
        system: 'Shower Head',
        observation: `Shower head condition recorded as: ${newCondition}`,
        action: `Inspect, clean and descale shower head at ${location} — condition recorded as ${newCondition}`,
        priority: '2',
        responsible_person: job.responsible_person || '',
        deadline: '',
        status: 'Open',
      };
      const existingActions = job.actions || [];
      // Don't duplicate if same location+condition already has an action
      const alreadyExists = existingActions.some(a => a.action && a.action.includes(`at ${location}`) && a.action.includes(newCondition));
      if (!alreadyExists) {
        onChange({ showers: showers.map(s => s.id === shower.id ? { ...s, ...fields } : s), actions: [...existingActions, newAction] });
        return;
      }
    }
    updateShower(shower.id, fields);
  };

  // Batch update one shower by merging fields — avoids multiple rapid __arrayPatch races
  const updateShower = (id, fields) => {
    onChange({ showers: showers.map(s => s.id === id ? { ...s, ...fields } : s) });
  };

  const remove = (id) => {
    onChange({ showers: showers.filter(s => s.id !== id) });
  };

  const handlePhoto = async (id, file) => {
    if (!file) return;
    setUploading(id);
    const dataUrl = await fileToDataUrl(file);
    onChange({ showers: (job.showers || []).map(s => s.id === id ? { ...s, photo_url: dataUrl } : s) });
    setUploading(null);
    uploadToCdn(file).then(cdnUrl => {
      if (cdnUrl) onChange({ __arrayPatch: { key: 'showers', id, field: 'photo_url', value: cdnUrl } });
    });
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Location</Label>
                {rooms.length > 0 ? (
                  <select value={s.location} onChange={e => updateShower(s.id, { location: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select room...</option>
                    {rooms.map(r => <option key={r}>{r}</option>)}
                    <option value="__other">Other</option>
                  </select>
                ) : (
                  <Input value={s.location} onChange={e => updateShower(s.id, { location: e.target.value })} placeholder="e.g. Room 1 Ensuite" />
                )}
              </div>
              <div>
                <Label>Condition</Label>
                <select value={s.condition || 'Good'} onChange={e => handleConditionChange(s, e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
                {s.condition && s.condition !== 'Good' && (
                  <div className="text-xs text-amber-700 mt-1 font-semibold">⚠ Remedial action will be auto-created</div>
                )}
              </div>
              <div>
                <Label>Last descale date</Label>
                <label className="flex items-center gap-2 text-xs mb-1 cursor-pointer">
                  <input type="checkbox" checked={!!s.descale_not_known} onChange={e => {
                    const notKnown = e.target.checked;
                    if (notKnown) {
                      const reportDate = job.assessment_date || today();
                      const d = new Date(reportDate);
                      d.setMonth(d.getMonth() + 3);
                      // Batch all related fields in one onChange call
                      updateShower(s.id, { descale_not_known: true, last_descale: '', next_descale: d.toISOString().slice(0, 10) });
                    } else {
                      updateShower(s.id, { descale_not_known: false });
                    }
                  }} className="w-3.5 h-3.5 accent-red-600" />
                  Date not known
                </label>
                {!s.descale_not_known && (
                  <Input type="date" value={s.last_descale || ''} onChange={e => {
                    const val = e.target.value;
                    const next = val ? new Date(new Date(val).setMonth(new Date(val).getMonth() + 3)).toISOString().slice(0, 10) : '';
                    updateShower(s.id, { last_descale: val, next_descale: next });
                  }} />
                )}
              </div>
              <div>
                <Label>Next descale due <span className="text-xs text-gray-400">(auto: +3 months)</span></Label>
                <Input type="date" value={s.next_descale || ''} onChange={e => updateShower(s.id, { next_descale: e.target.value })} />
                {s.next_descale && new Date(s.next_descale) < new Date() && (
                  <div className="text-xs text-red-600 mt-1 font-bold">⚠ Descale overdue</div>
                )}
              </div>
            </div>

            <div className="mt-2">
              <Label>Notes</Label>
              <Textarea value={s.notes || ''} onChange={e => updateShower(s.id, { notes: e.target.value })} className="min-h-[50px]" />
            </div>

            <div className="mt-2">
              {s.photo_url ? (
                <div>
                  <Label>Photo</Label>
                  <div className="w-full aspect-video bg-gray-100 rounded-xl overflow-hidden mt-1 mb-1">
                    <img src={s.photo_url} alt="Shower head" className="w-full h-full object-contain" />
                  </div>
                  <button onClick={() => updateShower(s.id, { photo_url: '' })} className="text-xs text-red-600 underline">Remove photo</button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  {uploading === s.id ? (
                    <span className="text-sm text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving photo…</span>
                  ) : (
                    <label className="text-sm px-3 py-1.5 rounded-xl bg-white border border-gray-300 font-medium cursor-pointer hover:bg-gray-50 inline-block">
                      📷 Add photo
                      <input type="file" accept="image/*" className="hidden" onChange={e => { handlePhoto(s.id, e.target.files[0]); e.target.value = ''; }} />
                    </label>
                  )}
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