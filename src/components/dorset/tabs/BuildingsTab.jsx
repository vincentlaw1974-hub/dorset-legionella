import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { uid } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const BUILDING_TYPES = ['Reception', 'Lodge', 'House', 'Bungalow', 'Plant Room', 'Club House', 'Spa / Leisure', 'Other'];

function defaultBuilding(name = '', type = 'Lodge') {
  return {
    id: uid(),
    name,
    type,
    // Cold water
    has_mains_cold: true,
    cwst_count: 0,
    cwst_capacity: '',
    cwst_location: '',
    // Hot water
    has_hw_storage: false,
    hw_storage_count: 1,
    hw_cylinder_temp: '',
    has_boiler: false,
    boiler_count: 1,
    boiler_set_temp: '',
    // Fittings
    has_tmvs: false,
    has_outside_tap: false,
    has_shower: false,
    shower_count: 1,
    // Other
    has_air_con: false,
    has_closed_system: false,
    notes: '',
  };
}

const Chk = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
    <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-red-600" />
    {label}
  </label>
);

const NumField = ({ label, value, onChange, min = 1 }) => (
  <div>
    <Label>{label}</Label>
    <Input type="number" inputMode="numeric" min={min} value={value} onChange={e => onChange(e.target.value)} className="w-20" />
  </div>
);

export default function BuildingsTab({ job, onChange }) {
  const [openId, setOpenId] = useState(null);
  const [uploading, setUploading] = useState({});

  const handlePhoto = async (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(u => ({ ...u, [id]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateBuilding(id, { photos: [...(buildings.find(b => b.id === id)?.photos || []), { id: uid(), file_url }] });
    setUploading(u => ({ ...u, [id]: false }));
    e.target.value = '';
  };

  const removePhoto = (buildingId, photoId) => {
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { photos: (b?.photos || []).filter(p => p.id !== photoId) });
  };

  const buildings = job.buildings || [];

  const updateBuilding = (id, changes) => {
    onChange({ buildings: buildings.map(b => b.id === id ? { ...b, ...changes } : b) });
  };

  const addBuilding = (type = 'Lodge') => {
    const count = buildings.filter(b => b.type === type).length + 1;
    const name = `${type} ${count}`;
    const b = defaultBuilding(name, type);
    onChange({ buildings: [...buildings, b] });
    setOpenId(b.id);
  };

  const removeBuilding = (id) => {
    onChange({ buildings: buildings.filter(b => b.id !== id) });
    if (openId === id) setOpenId(null);
  };

  const typeIcon = (t) => ({ Reception: '🏢', Lodge: '🏡', House: '🏠', Bungalow: '🏘️', 'Plant Room': '⚙️', 'Club House': '🏛️', 'Spa / Leisure': '💆', Other: '📦' }[t] || '📦');

  // Summary counts
  const totalCWSTs = buildings.reduce((n, b) => n + (parseInt(b.cwst_count) || 0), 0);
  const totalBoilers = buildings.reduce((n, b) => n + (b.has_boiler ? parseInt(b.boiler_count) || 0 : 0), 0);
  const totalHWS = buildings.reduce((n, b) => n + (b.has_hw_storage ? parseInt(b.hw_storage_count) || 0 : 0), 0);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      {buildings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm flex flex-wrap gap-4 text-sm">
          <span className="font-semibold text-gray-700">🏘️ {buildings.length} building{buildings.length !== 1 ? 's' : ''}</span>
          {totalCWSTs > 0 && <span className="text-blue-700">🏗️ {totalCWSTs} CWST{totalCWSTs !== 1 ? 's' : ''}</span>}
          {totalBoilers > 0 && <span className="text-orange-700">🔥 {totalBoilers} boiler{totalBoilers !== 1 ? 's' : ''}</span>}
          {totalHWS > 0 && <span className="text-red-700">♨️ {totalHWS} HW cylinder{totalHWS !== 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* Add buttons */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong className="block mb-3">Add a building</strong>
        <div className="flex flex-wrap gap-2">
          {BUILDING_TYPES.map(t => (
            <button key={t} onClick={() => addBuilding(t)}
              className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-300 hover:bg-gray-50">
              {typeIcon(t)} {t}
            </button>
          ))}
        </div>
      </div>

      {buildings.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">No buildings added yet. Use the buttons above to add your first building.</div>
      )}

      {/* Building cards */}
      {buildings.map(b => {
        const isOpen = openId === b.id;
        return (
          <div key={b.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setOpenId(isOpen ? null : b.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{typeIcon(b.type)}</span>
                <div>
                  <div className="font-semibold text-sm">{b.name || b.type}</div>
                  <div className="text-xs text-gray-500">
                    {b.type}
                    {b.has_boiler ? ` · ${b.boiler_count} boiler` : ''}
                    {b.has_hw_storage ? ` · ${b.hw_storage_count} HW cyl` : ''}
                    {parseInt(b.cwst_count) > 0 ? ` · ${b.cwst_count} CWST` : ''}
                    {b.has_tmvs ? ' · TMVs' : ''}
                    {b.has_shower ? ` · ${b.shower_count} shower${b.shower_count > 1 ? 's' : ''}` : ''}
                  </div>
                </div>
              </div>
              <span className="text-gray-400 text-lg">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                {/* Basic info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Building name</Label>
                    <Input value={b.name} onChange={e => updateBuilding(b.id, { name: e.target.value })} placeholder="e.g. Lodge 1, Main Reception" />
                  </div>
                  <div>
                    <Label>Building type</Label>
                    <select value={b.type} onChange={e => updateBuilding(b.id, { type: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{ fontSize: '16px' }}>
                      {BUILDING_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Cold water */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-3">
                  <div className="font-semibold text-sm text-blue-800">🌊 Cold Water Supply</div>
                  <Chk label="Mains cold water supply" checked={b.has_mains_cold} onChange={v => updateBuilding(b.id, { has_mains_cold: v })} />
                  <div className="flex flex-wrap gap-4 items-end">
                    <NumField label="No. of CWSTs (0 = none)" value={b.cwst_count} min={0} onChange={v => updateBuilding(b.id, { cwst_count: v })} />
                    {parseInt(b.cwst_count) > 0 && (
                      <>
                        <div>
                          <Label>CWST location(s)</Label>
                          <Input value={b.cwst_location} onChange={e => updateBuilding(b.id, { cwst_location: e.target.value })} placeholder="e.g. Plant room, roof space" />
                        </div>
                        <div>
                          <Label>Capacity (litres)</Label>
                          <Input value={b.cwst_capacity} onChange={e => updateBuilding(b.id, { cwst_capacity: e.target.value })} placeholder="e.g. 1000" className="w-28" />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Hot water */}
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-3">
                  <div className="font-semibold text-sm text-orange-800">♨️ Hot Water</div>
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-2">
                      <Chk label="Boiler(s) present" checked={b.has_boiler} onChange={v => updateBuilding(b.id, { has_boiler: v })} />
                      {b.has_boiler && (
                        <div className="flex gap-3 flex-wrap ml-6">
                          <NumField label="No. of boilers" value={b.boiler_count} onChange={v => updateBuilding(b.id, { boiler_count: v })} />
                          <div>
                            <Label>Boiler set temp °C</Label>
                            <Input inputMode="decimal" value={b.boiler_set_temp} onChange={e => updateBuilding(b.id, { boiler_set_temp: e.target.value })} className="w-24" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Chk label="Hot water cylinder(s) / calorifier(s)" checked={b.has_hw_storage} onChange={v => updateBuilding(b.id, { has_hw_storage: v })} />
                      {b.has_hw_storage && (
                        <div className="flex gap-3 flex-wrap ml-6">
                          <NumField label="No. of cylinders" value={b.hw_storage_count} onChange={v => updateBuilding(b.id, { hw_storage_count: v })} />
                          <div>
                            <Label>Cylinder temp °C</Label>
                            <Input inputMode="decimal" value={b.hw_cylinder_temp} onChange={e => updateBuilding(b.id, { hw_cylinder_temp: e.target.value })} className="w-24" />
                            {b.hw_cylinder_temp && parseFloat(b.hw_cylinder_temp) < 60 && (
                              <div className="text-xs text-red-600 mt-1">⚠ Below 60°C — risk</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fittings */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="font-semibold text-sm text-gray-700">🔧 Fittings &amp; Features</div>
                  <div className="flex flex-wrap gap-4">
                    <Chk label="TMVs installed" checked={b.has_tmvs} onChange={v => updateBuilding(b.id, { has_tmvs: v })} />
                    <Chk label="Outside tap(s)" checked={b.has_outside_tap} onChange={v => updateBuilding(b.id, { has_outside_tap: v })} />
                    <Chk label="Air conditioning" checked={b.has_air_con} onChange={v => updateBuilding(b.id, { has_air_con: v })} />
                    <Chk label="Closed heating system" checked={b.has_closed_system} onChange={v => updateBuilding(b.id, { has_closed_system: v })} />
                  </div>
                  <div className="pt-1">
                    <Chk label="Shower(s) present" checked={b.has_shower} onChange={v => updateBuilding(b.id, { has_shower: v })} />
                    {b.has_shower && (
                      <div className="ml-6 mt-2">
                        <NumField label="No. of showers" value={b.shower_count} onChange={v => updateBuilding(b.id, { shower_count: v })} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes for this building</Label>
                  <Textarea value={b.notes} onChange={e => updateBuilding(b.id, { notes: e.target.value })} placeholder="Additional details, access notes, restrictions..." className="min-h-[60px]" />
                </div>

                {/* Photos */}
                <div>
                  <Label>Building photos</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(b.photos || []).map(p => (
                      <div key={p.id} className="relative inline-block">
                        <img src={p.file_url} alt="" className="h-24 w-32 object-cover rounded-xl border border-gray-200" />
                        <button onClick={() => removePhoto(b.id, p.id)} className="absolute top-1 right-1 bg-white border border-gray-300 rounded-full w-5 h-5 text-xs text-red-600 flex items-center justify-center font-bold">×</button>
                      </div>
                    ))}
                    <label className="h-24 w-32 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50 text-gray-400 text-xs text-center gap-1">
                      {uploading[b.id] ? '⏳ Uploading...' : <><span className="text-2xl">📷</span><span>Add photo</span></>}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhoto(b.id, e)} disabled={uploading[b.id]} />
                    </label>
                    <label className="h-24 w-32 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50 text-gray-400 text-xs text-center gap-1">
                      {uploading[b.id] ? '' : <><span className="text-2xl">🖼️</span><span>Gallery</span></>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => handlePhoto(b.id, e)} disabled={uploading[b.id]} />
                    </label>
                  </div>
                </div>

                <button onClick={() => removeBuilding(b.id)}
                  className="text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50">
                  Remove building
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}