import React, { useState } from 'react';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';
import { uid, outletStatus } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const BUILDING_TYPES = ['Reception', 'Lodge', 'House', 'Bungalow', 'Plant Room', 'Club House', 'Spa / Leisure', 'Other'];
const OUTLET_TYPES = ['WHB', 'Shower', 'Bath', 'Kitchen Sink', 'Cleaner Sink', 'Pot Wash', 'Outside Tap', 'Other'];
const PHOTO_KINDS = ['General', 'Cold Water Tank', 'Boiler', 'HW Cylinder', 'Shower', 'Outlet', 'Plant Room', 'Exterior', 'Defect', 'Other'];

function defaultBuilding(name = '', type = 'Lodge') {
  return {
    id: uid(), name, type,
    has_mains_cold: true, cwst_count: 0, cwst_capacity: '', cwst_location: '',
    has_hw_storage: false, hw_storage_count: 1, hw_cylinder_temp: '',
    has_boiler: false, boiler_count: 1, boiler_set_temp: '',
    has_tmvs: false, has_outside_tap: false, has_shower: false, shower_count: 1,
    has_air_con: false, has_closed_system: false, notes: '',
    rooms: [], outlets: [], photos: [],
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

const SECTION_TABS = ['System', 'Rooms & Outlets', 'Photos', 'Notes'];

export default function BuildingsTab({ job, onChange }) {
  const [openId, setOpenId] = useState(null);
  const [sectionTab, setSectionTab] = useState({});
  const [uploading, setUploading] = useState({});

  const buildings = job.buildings || [];

  const updateBuilding = (id, changes) => {
    onChange({ buildings: buildings.map(b => b.id === id ? { ...b, ...changes } : b) });
  };

  const getTab = (id) => sectionTab[id] || 'System';
  const setTab = (id, tab) => setSectionTab(t => ({ ...t, [id]: tab }));

  // Quick-add rooms by count
  const quickAddRooms = (buildingId, count, prefix) => {
    const b = buildings.find(b => b.id === buildingId);
    const existing = b?.rooms || [];
    const newRooms = Array.from({ length: count }, (_, i) => ({ id: uid(), name: `${prefix} ${i + 1}` }));
    updateBuilding(buildingId, { rooms: [...existing, ...newRooms] });
  };

  // Photo handlers
  const handlePhoto = async (buildingId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(u => ({ ...u, [buildingId]: true }));
    const newId = uid();
    const dataUrl = await fileToDataUrl(file);
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { photos: [...(b?.photos || []), { id: newId, file_url: dataUrl, kind: 'General', caption: '' }] });
    setUploading(u => ({ ...u, [buildingId]: false }));
    e.target.value = '';
    uploadToCdn(file).then(cdnUrl => {
      if (cdnUrl) {
        const b2 = buildings.find(b => b.id === buildingId);
        updateBuilding(buildingId, { photos: (b2?.photos || []).map(p => p.id === newId ? { ...p, file_url: cdnUrl } : p) });
      }
    });
  };
  const updatePhoto = (buildingId, photoId, changes) => {
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { photos: (b?.photos || []).map(p => p.id === photoId ? { ...p, ...changes } : p) });
  };
  const removePhoto = (buildingId, photoId) => {
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { photos: (b?.photos || []).filter(p => p.id !== photoId) });
  };

  // Room handlers
  const addRoom = (buildingId) => {
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { rooms: [...(b?.rooms || []), { id: uid(), name: '' }] });
  };
  const updateRoom = (buildingId, roomId, name) => {
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { rooms: (b?.rooms || []).map(r => r.id === roomId ? { ...r, name } : r) });
  };
  const removeRoom = (buildingId, roomId) => {
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { rooms: (b?.rooms || []).filter(r => r.id !== roomId) });
  };

  // Outlet handlers
  const addOutlet = (buildingId) => {
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { outlets: [...(b?.outlets || []), { id: uid(), location: '', type: 'WHB', hot: '', cold: '', notes: '', infrequent: false, hasTmv: false }] });
  };
  const updateOutlet = (buildingId, outletId, changes) => {
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { outlets: (b?.outlets || []).map(o => o.id === outletId ? { ...o, ...changes } : o) });
  };
  const removeOutlet = (buildingId, outletId) => {
    const b = buildings.find(b => b.id === buildingId);
    updateBuilding(buildingId, { outlets: (b?.outlets || []).filter(o => o.id !== outletId) });
  };
  const handleOutletPhoto = async (buildingId, outletId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    updateOutlet(buildingId, outletId, { photo_url: dataUrl });
    e.target.value = '';
    uploadToCdn(file).then(cdnUrl => { if (cdnUrl) updateOutlet(buildingId, outletId, { photo_url: cdnUrl }); });
  };

  const addBuilding = (type = 'Lodge') => {
    const count = buildings.filter(b => b.type === type).length + 1;
    const b = defaultBuilding(`${type} ${count}`, type);
    onChange({ buildings: [...buildings, b] });
    setOpenId(b.id);
  };
  const removeBuilding = (id) => {
    onChange({ buildings: buildings.filter(b => b.id !== id) });
    if (openId === id) setOpenId(null);
  };

  const typeIcon = (t) => ({ Reception: '🏢', Lodge: '🏡', House: '🏠', Bungalow: '🏘️', 'Plant Room': '⚙️', 'Club House': '🏛️', 'Spa / Leisure': '💆', Other: '📦' }[t] || '📦');

  const totalCWSTs = buildings.reduce((n, b) => n + (parseInt(b.cwst_count) || 0), 0);
  const totalBoilers = buildings.reduce((n, b) => n + (b.has_boiler ? parseInt(b.boiler_count) || 0 : 0), 0);
  const totalHWS = buildings.reduce((n, b) => n + (b.has_hw_storage ? parseInt(b.hw_storage_count) || 0 : 0), 0);

  return (
    <div className="space-y-3">
      {buildings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm flex flex-wrap gap-4 text-sm">
          <span className="font-semibold text-gray-700">🏘️ {buildings.length} building{buildings.length !== 1 ? 's' : ''}</span>
          {totalCWSTs > 0 && <span className="text-blue-700">🏗️ {totalCWSTs} CWST{totalCWSTs !== 1 ? 's' : ''}</span>}
          {totalBoilers > 0 && <span className="text-orange-700">🔥 {totalBoilers} boiler{totalBoilers !== 1 ? 's' : ''}</span>}
          {totalHWS > 0 && <span className="text-red-700">♨️ {totalHWS} HW cyl{totalHWS !== 1 ? 's' : ''}</span>}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong className="block mb-3">Add a building</strong>
        <div className="flex flex-wrap gap-2">
          {BUILDING_TYPES.map(t => (
            <button key={t} onClick={() => addBuilding(t)} className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-300 hover:bg-gray-50">
              {typeIcon(t)} {t}
            </button>
          ))}
        </div>
      </div>

      {buildings.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">No buildings added yet.</div>
      )}

      {buildings.map(b => {
        const isOpen = openId === b.id;
        const tab = getTab(b.id);
        const cqc = job.cqc_mode;
        return (
          <div key={b.id} className={`rounded-2xl shadow-sm overflow-hidden border-2 transition-all ${isOpen ? 'border-red-500' : 'border-gray-200 bg-white'}`}>
            <button onClick={() => setOpenId(isOpen ? null : b.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left ${isOpen ? 'bg-red-600 text-white' : 'bg-white hover:bg-gray-50'}`}>
              <div className="flex items-center gap-3">
              <span className="text-xl">{typeIcon(b.type)}</span>
                <div>
                  <div className={`font-semibold text-sm ${isOpen ? 'text-white' : 'text-gray-900'}`}>{b.name || b.type}</div>
                  <div className={`text-xs ${isOpen ? 'text-red-100' : 'text-gray-500'}`}>
                    {b.type}
                    {b.has_boiler ? ` · ${b.boiler_count} boiler` : ''}
                    {b.has_hw_storage ? ` · ${b.hw_storage_count} HW cyl` : ''}
                    {parseInt(b.cwst_count) > 0 ? ` · ${b.cwst_count} CWST` : ''}
                    {(b.rooms||[]).length > 0 ? ` · ${b.rooms.length} room${b.rooms.length!==1?'s':''}` : ''}
                    {(b.outlets||[]).length > 0 ? ` · ${b.outlets.length} outlets` : ''}
                    {(b.photos||[]).length > 0 ? ` · ${b.photos.length} photo${b.photos.length!==1?'s':''}` : ''}
                  </div>
                </div>
              </div>
              <span className={`text-lg ${isOpen ? 'text-red-100' : 'text-gray-400'}`}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100">
                {/* Name/type row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 pb-0">
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

                {/* Section tabs */}
                <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
                  {SECTION_TABS.map(t => (
                    <button key={t} onClick={() => setTab(b.id, t)}
                      className={`px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 whitespace-nowrap ${tab === t ? 'border-red-600 text-red-700 bg-red-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                      {t}
                      {t === 'Rooms & Outlets' && ((b.rooms||[]).length + (b.outlets||[]).length) > 0 ? ` (${(b.rooms||[]).length}r / ${(b.outlets||[]).length}o)` : ''}
                      {t === 'Photos' && (b.photos||[]).length > 0 ? ` (${b.photos.length})` : ''}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-4">

                  {/* SYSTEM TAB */}
                  {tab === 'System' && (
                    <>
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-3">
                        <div className="font-semibold text-sm text-blue-800">🌊 Cold Water Supply</div>
                        <Chk label="Mains cold water supply" checked={b.has_mains_cold} onChange={v => updateBuilding(b.id, { has_mains_cold: v })} />
                        <div className="flex flex-wrap gap-4 items-end">
                          <NumField label="No. of CWSTs (0 = none)" value={b.cwst_count} min={0} onChange={v => updateBuilding(b.id, { cwst_count: v })} />
                          {parseInt(b.cwst_count) > 0 && (
                            <>
                              <div><Label>CWST location(s)</Label><Input value={b.cwst_location} onChange={e => updateBuilding(b.id, { cwst_location: e.target.value })} placeholder="e.g. loft, plant room" /></div>
                              <div><Label>Capacity (litres)</Label><Input value={b.cwst_capacity} onChange={e => updateBuilding(b.id, { cwst_capacity: e.target.value })} className="w-28" /></div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-3">
                        <div className="font-semibold text-sm text-orange-800">♨️ Hot Water</div>
                        <div className="space-y-2">
                          <Chk label="Boiler(s) present" checked={b.has_boiler} onChange={v => updateBuilding(b.id, { has_boiler: v })} />
                          {b.has_boiler && (
                            <div className="flex gap-3 flex-wrap ml-6">
                              <NumField label="No. of boilers" value={b.boiler_count} onChange={v => updateBuilding(b.id, { boiler_count: v })} />
                              <div><Label>Boiler set temp °C</Label><Input inputMode="decimal" value={b.boiler_set_temp} onChange={e => updateBuilding(b.id, { boiler_set_temp: e.target.value })} className="w-24" /></div>
                            </div>
                          )}
                          <Chk label="Hot water cylinder(s)" checked={b.has_hw_storage} onChange={v => updateBuilding(b.id, { has_hw_storage: v })} />
                          {b.has_hw_storage && (
                            <div className="flex gap-3 flex-wrap ml-6">
                              <NumField label="No. of cylinders" value={b.hw_storage_count} onChange={v => updateBuilding(b.id, { hw_storage_count: v })} />
                              <div>
                                <Label>Cylinder temp °C</Label>
                                <Input inputMode="decimal" value={b.hw_cylinder_temp} onChange={e => updateBuilding(b.id, { hw_cylinder_temp: e.target.value })} className="w-24" />
                                {b.hw_cylinder_temp && parseFloat(b.hw_cylinder_temp) < 60 && <div className="text-xs text-red-600 mt-1">⚠ Below 60°C — risk</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                        <div className="font-semibold text-sm text-gray-700">🔧 Fittings &amp; Features</div>
                        <div className="flex flex-wrap gap-4">
                          <Chk label="TMVs installed" checked={b.has_tmvs} onChange={v => updateBuilding(b.id, { has_tmvs: v })} />
                          <Chk label="Outside tap(s)" checked={b.has_outside_tap} onChange={v => updateBuilding(b.id, { has_outside_tap: v })} />
                          <Chk label="Air conditioning" checked={b.has_air_con} onChange={v => updateBuilding(b.id, { has_air_con: v })} />
                          <Chk label="Closed heating system" checked={b.has_closed_system} onChange={v => updateBuilding(b.id, { has_closed_system: v })} />
                        </div>
                      </div>
                    </>
                  )}

                  {tab === 'Rooms & Outlets' && (
                    <div className="space-y-4">
                      {/* Rooms section */}
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">🚪 Rooms / Areas</span>
                          <button onClick={() => addRoom(b.id)} className="text-sm px-3 py-1.5 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>+ Add room</button>
                        </div>
                        {/* Quick-add shortcuts */}
                        <div className="flex flex-wrap gap-2">
                          {['Bathroom', 'En-suite', 'Kitchen', 'Bedroom', 'Lounge', 'Utility Room', 'Cleaner Store', 'Plant Room', 'Hallway', 'WC'].map(prefix => (
                            <button key={prefix} onClick={() => quickAddRooms(b.id, 1, prefix)}
                              className="text-xs px-2 py-1 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-600">
                              + {prefix}
                            </button>
                          ))}
                        </div>
                        {(b.rooms || []).length === 0 && <div className="text-xs text-gray-400 py-2 text-center">No rooms added yet. Add rooms above then record outlet temperatures below.</div>}
                        {(b.rooms || []).map(r => (
                          <div key={r.id} className="flex items-center gap-2">
                            <Input value={r.name} onChange={e => updateRoom(b.id, r.id, e.target.value)} placeholder="e.g. Bathroom, Kitchen, En-suite" className="flex-1" />
                            <button onClick={() => removeRoom(b.id, r.id)} className="text-red-500 text-lg font-bold px-2">×</button>
                          </div>
                        ))}
                      </div>

                      {/* Outlets section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-700">💧 Outlets &amp; Temperatures</span>
                          <button onClick={() => addOutlet(b.id)} className="text-sm px-3 py-1.5 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>+ Add outlet</button>
                        </div>
                        {(b.outlets || []).length === 0 && <div className="text-xs text-gray-400 py-4 text-center">No outlets recorded. Add rooms first, then record outlet temperatures here.</div>}
                        <div className="space-y-3">
                          {(b.outlets || []).map(o => {
                            const st = outletStatus(o, cqc);
                            return (
                              <div key={o.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-600">{o.location || 'Outlet'} — {o.type}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold badge-${st.cls}`}>{st.text}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  <div>
                                    <Label>Room / Location</Label>
                                    {(b.rooms||[]).length > 0 ? (
                                      <select value={o.location} onChange={e => updateOutlet(b.id, o.id, { location: e.target.value })}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{ fontSize: '16px' }}>
                                        <option value="">-- select --</option>
                                        {(b.rooms||[]).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                      </select>
                                    ) : (
                                      <Input value={o.location} onChange={e => updateOutlet(b.id, o.id, { location: e.target.value })} placeholder="e.g. Bathroom" />
                                    )}
                                  </div>
                                  <div>
                                    <Label>Type</Label>
                                    <select value={o.type} onChange={e => updateOutlet(b.id, o.id, { type: e.target.value })}
                                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{ fontSize: '16px' }}>
                                      {OUTLET_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                  </div>
                                  {o.type !== 'Outside Tap' && <div><Label>Hot °C</Label><Input inputMode="decimal" value={o.hot} onChange={e => updateOutlet(b.id, o.id, { hot: e.target.value })} /></div>}
                                  <div><Label>Cold °C</Label><Input inputMode="decimal" value={o.cold} onChange={e => updateOutlet(b.id, o.id, { cold: e.target.value })} /></div>
                                  <div className="col-span-full flex flex-wrap gap-4 mt-1">
                                    <Chk label="TMV fitted" checked={!!o.hasTmv} onChange={v => updateOutlet(b.id, o.id, { hasTmv: v })} />
                                    <Chk label="Infrequently used" checked={!!o.infrequent} onChange={v => updateOutlet(b.id, o.id, { infrequent: v })} />
                                  </div>
                                  <div className="col-span-full"><Label>Notes</Label><Input value={o.notes} onChange={e => updateOutlet(b.id, o.id, { notes: e.target.value })} /></div>
                                </div>
                                <div className="flex gap-2 flex-wrap mt-1">
                                  {o.photo_url ? (
                                    <div className="relative inline-block">
                                      <img src={o.photo_url} alt="outlet" className="h-20 w-28 object-cover rounded-xl border border-gray-200" />
                                      <button onClick={() => updateOutlet(b.id, o.id, { photo_url: '' })} className="absolute top-1 right-1 bg-white border border-gray-300 rounded-full w-5 h-5 text-xs text-red-600 flex items-center justify-center font-bold">×</button>
                                    </div>
                                  ) : (
                                    <>
                                      <label className="text-xs px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium cursor-pointer hover:bg-gray-50">
                                        📷 Camera<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleOutletPhoto(b.id, o.id, e)} />
                                      </label>
                                      <label className="text-xs px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium cursor-pointer hover:bg-gray-50">
                                        🖼 Gallery<input type="file" accept="image/*" className="hidden" onChange={e => handleOutletPhoto(b.id, o.id, e)} />
                                      </label>
                                    </>
                                  )}
                                  <button onClick={() => removeOutlet(b.id, o.id)} className="text-xs px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50 ml-auto">Remove</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PHOTOS TAB */}
                  {tab === 'Photos' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Building photos</span>
                        <div className="flex gap-2">
                          <label className="text-sm px-3 py-1.5 rounded-xl font-bold text-white cursor-pointer" style={{ background: '#d71920' }}>
                            📷 Camera<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhoto(b.id, e)} disabled={uploading[b.id]} />
                          </label>
                          <label className="text-sm px-3 py-1.5 rounded-xl font-bold bg-white border border-gray-300 text-gray-700 cursor-pointer hover:bg-gray-50">
                            🖼 Gallery<input type="file" accept="image/*" className="hidden" onChange={e => handlePhoto(b.id, e)} disabled={uploading[b.id]} />
                          </label>
                        </div>
                      </div>
                      {uploading[b.id] && <div className="text-xs text-gray-400">⏳ Uploading...</div>}
                      {(b.photos || []).length === 0 && !uploading[b.id] && <div className="text-xs text-gray-400 text-center py-4">No photos yet for this building.</div>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(b.photos || []).map(p => (
                          <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="relative">
                              <img src={p.file_url} alt="" className="w-full h-40 object-cover" />
                              <button onClick={() => removePhoto(b.id, p.id)} className="absolute top-2 right-2 bg-white border border-gray-300 rounded-full w-6 h-6 text-xs text-red-600 flex items-center justify-center font-bold shadow">×</button>
                            </div>
                            <div className="p-2 space-y-1">
                              <div>
                                <Label>Photo type</Label>
                                <select value={p.kind || 'General'} onChange={e => updatePhoto(b.id, p.id, { kind: e.target.value })}
                                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" style={{ fontSize: '16px' }}>
                                  {PHOTO_KINDS.map(k => <option key={k}>{k}</option>)}
                                </select>
                              </div>
                              <div>
                                <Label>Caption</Label>
                                <Input value={p.caption || ''} onChange={e => updatePhoto(b.id, p.id, { caption: e.target.value })} placeholder="Describe what this shows..." />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NOTES TAB */}
                  {tab === 'Notes' && (
                    <div>
                      <Label>Notes for this building</Label>
                      <Textarea value={b.notes} onChange={e => updateBuilding(b.id, { notes: e.target.value })} placeholder="Access notes, restrictions, additional observations..." className="min-h-[120px]" />
                    </div>
                  )}

                  <button onClick={() => removeBuilding(b.id)}
                    className="text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50">
                    Remove building
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}