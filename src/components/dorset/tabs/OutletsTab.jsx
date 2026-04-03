import React from 'react';
import { uid, templateOutlets, outletStatus } from '@/lib/jobUtils';
import { base44 } from '@/api/base44Client';
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
    const outlets = [...(job.outlets || []), { id: uid(), location: '', type: 'WHB', hot: '', cold: '', notes: '', infrequent: false }];
    onChange({ outlets });
  };

  const addTemplateOutlets = () => {
    const name = job.property_type in templateOutlets ? job.property_type : 'Nursing Home';
    const newOnes = templateOutlets[name].map(([location, type]) => ({ id: uid(), location, type, hot: '', cold: '', notes: '', infrequent: false }));
    onChange({ outlets: [...(job.outlets || []), ...newOnes] });
  };

  const removeOutlet = (id) => {
    onChange({ outlets: (job.outlets || []).filter(o => o.id !== id) });
  };

  const handleOutletPhoto = async (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateOutlet(id, 'photo_url', file_url);
    e.target.value = '';
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
                    <select value={o.location} onChange={e => updateOutlet(o.id, 'location', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{fontSize:'16px'}}>
                      <option value="">-- select room --</option>
                      {(job.rooms || []).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  ) : (
                    <Input value={o.location} onChange={e => updateOutlet(o.id, 'location', e.target.value)} />
                  )}
                </div>
                <div>
                  <Label>Type</Label>
                  <select value={o.type} onChange={e => updateOutlet(o.id, 'type', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{fontSize:'16px'}}>
                    {outletTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                {o.type !== 'Outside Tap' && (
                  <div><Label>Hot °C</Label><Input inputMode="decimal" value={o.hot} onChange={e => updateOutlet(o.id, 'hot', e.target.value)} /></div>
                )}
                {o.type !== 'Outside Tap' && (
                  <div><Label>Cold °C</Label><Input inputMode="decimal" value={o.cold} onChange={e => updateOutlet(o.id, 'cold', e.target.value)} /></div>
                )}
                {o.type === 'Outside Tap' && (
                  <div><Label>Cold °C</Label><Input inputMode="decimal" value={o.cold} onChange={e => updateOutlet(o.id, 'cold', e.target.value)} /></div>
                )}

                {o.type === 'Outside Tap' ? (
                  <div className="col-span-full">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={!!o.hasCheckValve || !!o.check_valve} onChange={e => updateOutlet(o.id, 'hasCheckValve', e.target.checked)} className="w-4 h-4 accent-red-600" />
                      Check valve / double-check valve fitted
                    </label>
                    {!o.hasCheckValve && !o.check_valve && <div className="text-xs text-red-600 mt-1">⚠ No check valve — backflow risk</div>}
                    {(o.hasCheckValve || o.check_valve) && <div className="text-xs text-green-700 mt-1">✓ Check valve fitted</div>}
                  </div>
                ) : (
                  <div className="col-span-full">
                    <div className="flex flex-wrap gap-4 mt-1">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={!!o.hasTmv} onChange={e => updateOutlet(o.id, 'hasTmv', e.target.checked)} className="w-4 h-4 accent-red-600" />
                        TMV fitted — record blended outlet temp (38–46°C)
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={!!o.infrequent} onChange={e => updateOutlet(o.id, 'infrequent', e.target.checked)} className="w-4 h-4 accent-red-600" />
                        Infrequently used
                      </label>
                    </div>
                    {o.hasTmv && <div className="text-xs text-blue-700 mt-1">⚠ Enter the blended outlet temp, NOT the system/boiler temp. Pass range: 38–46°C.</div>}
                  </div>
                )}
              </div>

              <div className="mt-2">
                <Label>Notes</Label>
                <Textarea value={o.notes} onChange={e => updateOutlet(o.id, 'notes', e.target.value)} className="min-h-[60px]" />
              </div>

              {/* Outlet photo */}
              <div className="mt-2">
                {o.photo_url ? (
                  <div className="relative inline-block">
                    <img src={o.photo_url} alt="outlet" className="h-24 w-32 object-cover rounded-xl border border-gray-200" />
                    <button onClick={() => updateOutlet(o.id, 'photo_url', '')} className="absolute top-1 right-1 bg-white border border-gray-300 rounded-full w-5 h-5 text-xs text-red-600 flex items-center justify-center font-bold">×</button>
                  </div>
                ) : (
                  <label className="text-xs px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium cursor-pointer hover:bg-gray-50 inline-block">
                    📷 Add outlet photo
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleOutletPhoto(o.id, e)} />
                  </label>
                )}
              </div>

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