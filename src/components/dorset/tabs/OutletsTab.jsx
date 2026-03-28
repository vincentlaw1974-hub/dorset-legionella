import React from 'react';
import { uid, templateOutlets, outletStatus } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const outletTypes = ['WHB','Shower','Bath','Kitchen Sink','Cleaner Sink','Pot Wash','Outside Tap','Other'];

export default function OutletsTab({ job, onChange }) {
  const updateOutlet = (id, field, value) => {
    const outlets = (job.outlets || []).map(o => o.id === id ? { ...o, [field]: value } : o);
    onChange({ outlets });
  };

  const addOutlet = () => {
    const outlets = [...(job.outlets || []), { id: uid(), location: '', type: 'WHB', hot: '', cold: '', notes: '', designation: '', infrequent: false }];
    onChange({ outlets });
  };

  const addTemplateOutlets = () => {
    const name = job.property_type in templateOutlets ? job.property_type : 'Nursing Home';
    const newOnes = templateOutlets[name].map(([location, type]) => ({ id: uid(), location, type, hot: '', cold: '', notes: '', designation: '', infrequent: false }));
    onChange({ outlets: [...(job.outlets || []), ...newOnes] });
  };

  const removeOutlet = (id) => {
    onChange({ outlets: (job.outlets || []).filter(o => o.id !== id) });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <strong>Outlet inspection table</strong>
        <div className="flex gap-2">
          <button onClick={addOutlet} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>Add outlet</button>
          <button onClick={addTemplateOutlets} className="text-sm px-3 py-2 rounded-xl font-bold bg-white border border-gray-300 text-gray-900">Add template outlets</button>
        </div>
      </div>

      {(job.outlets || []).length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6">No outlets yet. Add one above.</div>
      )}

      <div className="space-y-3">
        {(job.outlets || []).map(o => {
          const st = outletStatus(o, job.cqc_mode);
          return (
            <div key={o.id} className="border border-gray-200 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <strong className="text-sm">{o.location || 'Outlet'}</strong>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold badge-${st.cls}`}>{st.text}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <Label>Location</Label>
                  {(job.rooms || []).length > 0 ? (
                    <select value={o.location} onChange={e => updateOutlet(o.id, 'location', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                      <option value="">-- select room --</option>
                      {(job.rooms || []).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  ) : (
                    <Input value={o.location} onChange={e => updateOutlet(o.id, 'location', e.target.value)} />
                  )}
                </div>
                <div>
                  <Label>Type</Label>
                  <select value={o.type} onChange={e => updateOutlet(o.id, 'type', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                    {outletTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><Label>Hot °C</Label><Input inputMode="decimal" value={o.hot} onChange={e => updateOutlet(o.id, 'hot', e.target.value)} /></div>
                <div><Label>Cold °C</Label><Input inputMode="decimal" value={o.cold} onChange={e => updateOutlet(o.id, 'cold', e.target.value)} /></div>
                <div><Label>Designation</Label><Input value={o.designation} onChange={e => updateOutlet(o.id, 'designation', e.target.value)} placeholder="S / Q / T / Y" /></div>
                <label className="flex items-center gap-2 text-sm mt-4 cursor-pointer">
                  <input type="checkbox" checked={!!o.infrequent} onChange={e => updateOutlet(o.id, 'infrequent', e.target.checked)} className="w-4 h-4 accent-red-600" />
                  Infrequently used
                </label>
              </div>
              <div className="mt-2"><Label>Notes</Label><Textarea value={o.notes} onChange={e => updateOutlet(o.id, 'notes', e.target.value)} className="min-h-[60px]" /></div>
              <div className="mt-2">
                <button onClick={() => removeOutlet(o.id)} className="text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50">Remove outlet</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}