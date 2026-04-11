import React, { useState } from 'react';
import { outletStatus } from '@/lib/jobUtils';

const OUTLET_ICONS = {
  'WHB': '🚿',
  'Shower': '🚿',
  'Bath': '🛁',
  'Kitchen Sink': '🍽️',
  'Cleaner Sink': '🪣',
  'Pot Wash': '🍳',
  'Outside Tap': '🚰',
  'Other': '💧',
};

function OutletChip({ outlet, cqc_mode }) {
  const st = outletStatus(outlet, cqc_mode);
  const bgMap = { ok: '#dcfce7', warn: '#fef3c7', fail: '#fee2e2' };
  const borderMap = { ok: '#86efac', warn: '#fcd34d', fail: '#fca5a5' };
  const textMap = { ok: '#166534', warn: '#92400e', fail: '#991b1b' };

  return (
    <div
      title={`${outlet.type} — ${outlet.hot ? `Hot: ${outlet.hot}°C` : ''} ${outlet.cold ? `Cold: ${outlet.cold}°C` : ''} ${outlet.notes || ''}`}
      className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border text-center min-w-[64px]"
      style={{ background: bgMap[st.cls], borderColor: borderMap[st.cls] }}
    >
      <span className="text-lg leading-none">{OUTLET_ICONS[outlet.type] || '💧'}</span>
      <span className="text-[10px] font-semibold leading-tight" style={{ color: textMap[st.cls] }}>{outlet.type}</span>
      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: textMap[st.cls] }}>{st.text}</span>
      {outlet.hot && <span className="text-[9px] text-gray-500">{outlet.hot}°C H</span>}
      {outlet.cold && <span className="text-[9px] text-gray-500">{outlet.cold}°C C</span>}
    </div>
  );
}

function SystemNode({ label, icon, detail, color = '#e5e7eb' }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl border-2 text-center min-w-[90px]"
      style={{ borderColor: color, background: color + '22' }}>
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-bold text-gray-700">{label}</span>
      {detail && <span className="text-[10px] text-gray-500">{detail}</span>}
    </div>
  );
}

export default function SchematicTab({ job, onChange }) {
  const [selectedRoom, setSelectedRoom] = useState(null);

  const rooms = job.rooms || [];
  const outlets = job.outlets || [];

  // Group outlets by room/location
  const roomNames = rooms.map(r => r.name);
  const grouped = {};
  const ungrouped = [];

  outlets.forEach(o => {
    const loc = o.location || '';
    if (roomNames.includes(loc)) {
      grouped[loc] = grouped[loc] || [];
      grouped[loc].push(o);
    } else {
      ungrouped.push(o);
    }
  });

  // If no rooms defined, group by location string
  const displayGroups = roomNames.length > 0
    ? roomNames.map(name => ({ name, outlets: grouped[name] || [] }))
    : Object.entries(
        outlets.reduce((acc, o) => {
          const k = o.location || 'Unassigned';
          acc[k] = acc[k] || [];
          acc[k].push(o);
          return acc;
        }, {})
      ).map(([name, outlets]) => ({ name, outlets }));

  // Room risk colour
  const roomRisk = (outs) => {
    if (outs.some(o => outletStatus(o, job.cqc_mode).cls === 'fail')) return { bg: '#fee2e2', border: '#fca5a5', dot: '#dc2626' };
    if (outs.some(o => outletStatus(o, job.cqc_mode).cls === 'warn')) return { bg: '#fffbeb', border: '#fcd34d', dot: '#d97706' };
    if (outs.length === 0) return { bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af' };
    return { bg: '#f0fdf4', border: '#86efac', dot: '#16a34a' };
  };

  const totalOutlets = outlets.length;
  const failCount = outlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'fail').length;
  const warnCount = outlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'warn').length;
  const okCount = outlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'ok').length;

  return (
    <div className="space-y-4">

      {/* System overview bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="font-bold text-sm mb-3">🔧 System Overview</div>
        <div className="flex flex-wrap gap-3 items-center">
          <SystemNode label="Cold Mains" icon="🌊" detail={job.cold_source || 'Mains'} color="#3b82f6" />
          <div className="text-gray-400 font-bold text-lg">→</div>
          {job.cwst_present && (
            <>
              <SystemNode label="Cold Tank" icon="🪣" detail={job.cwst_location || ''} color="#60a5fa" />
              <div className="text-gray-400 font-bold text-lg">→</div>
            </>
          )}
          <SystemNode
            label={job.hw_not_stored ? 'Combi/Boiler' : 'HW Cylinder'}
            icon="♨️"
            detail={job.cylinder_temp ? `${job.cylinder_temp}°C` : job.hw_boiler_set_temp ? `Set ${job.hw_boiler_set_temp}°C` : ''}
            color={(() => {
              const t = parseFloat(job.hw_not_stored ? job.hw_boiler_set_temp : job.cylinder_temp);
              return !isNaN(t) && t < 60 ? '#ef4444' : '#f97316';
            })()}
          />
          {job.tmvs_installed && (
            <>
              <div className="text-gray-400 font-bold text-lg">→</div>
              <SystemNode label="TMVs" icon="🔧" detail="Blended outlets" color="#8b5cf6" />
            </>
          )}
          <div className="text-gray-400 font-bold text-lg">→</div>
          <SystemNode label="Outlets" icon="🚿" detail={`${totalOutlets} total`} color="#10b981" />
        </div>

        {/* Legend + summary */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" />{okCount} Pass</div>
          <div className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />{warnCount} Warning</div>
          <div className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" />{failCount} Fail</div>
          <div className="ml-auto text-xs text-gray-400">{totalOutlets} outlets across {displayGroups.length} areas</div>
        </div>
      </div>

      {/* Room grid */}
      {displayGroups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm shadow-sm">
          No rooms or outlets recorded yet. Add rooms and outlets to see the schematic.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayGroups.map(({ name, outlets: roomOutlets }) => {
            const risk = roomRisk(roomOutlets);
            const isSelected = selectedRoom === name;
            return (
              <div
                key={name}
                onClick={() => setSelectedRoom(isSelected ? null : name)}
                className="bg-white border-2 rounded-2xl p-3 shadow-sm cursor-pointer transition-all hover:shadow-md"
                style={{ borderColor: isSelected ? '#d71920' : risk.border, background: isSelected ? '#fff5f5' : risk.bg }}
              >
                {/* Room header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: risk.dot }} />
                    <span className="font-bold text-sm truncate">{name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{roomOutlets.length} outlet{roomOutlets.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Outlet chips */}
                {roomOutlets.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-2">No outlets assigned</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {roomOutlets.map(o => (
                      <OutletChip key={o.id} outlet={o} cqc_mode={job.cqc_mode} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped outlets (only if rooms are defined) */}
          {roomNames.length > 0 && ungrouped.length > 0 && (
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-gray-300 flex-shrink-0" />
                <span className="font-bold text-sm text-gray-500">Unassigned</span>
                <span className="text-xs text-gray-400 ml-auto">{ungrouped.length} outlet{ungrouped.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ungrouped.map(o => (
                  <OutletChip key={o.id} outlet={o} cqc_mode={job.cqc_mode} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Holiday Park Buildings */}
      {(job.buildings || []).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-sm mb-3">🏘️ Buildings ({job.buildings.length})</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(job.buildings || []).map(b => {
              const bOutlets = b.outlets || [];
              const bFail = bOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'fail').length;
              const bWarn = bOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'warn').length;
              const bOk = bOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'ok').length;
              const borderCol = bFail > 0 ? '#fca5a5' : bWarn > 0 ? '#fcd34d' : bOutlets.length > 0 ? '#86efac' : '#e5e7eb';
              const bgCol = bFail > 0 ? '#fff5f5' : bWarn > 0 ? '#fffbeb' : bOutlets.length > 0 ? '#f0fdf4' : '#fafafa';
              const bRooms = b.rooms || [];
              return (
                <div key={b.id} className="border-2 rounded-xl p-3" style={{ borderColor: borderCol, background: bgCol }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-sm">{b.name || b.type}</div>
                    <div className="text-xs text-gray-500">{bOutlets.length} outlets · {bRooms.length} rooms</div>
                  </div>
                  {/* System summary chips */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {b.has_boiler && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">🔥 {b.boiler_count || 1} boiler{b.boiler_set_temp ? ` ${b.boiler_set_temp}°C` : ''}</span>}
                    {b.has_hw_storage && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">♨️ HW cyl{b.hw_cylinder_temp ? ` ${b.hw_cylinder_temp}°C` : ''}</span>}
                    {parseInt(b.cwst_count) > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🏗️ {b.cwst_count} CWST</span>}
                    {b.has_tmvs && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">🔧 TMVs</span>}
                  </div>
                  {/* Outlet chips grouped by room */}
                  {bOutlets.length > 0 && (
                    <div className="space-y-1">
                      {bRooms.length > 0 ? bRooms.map(r => {
                        const rOutlets = bOutlets.filter(o => o.location === r.name);
                        if (rOutlets.length === 0) return null;
                        return (
                          <div key={r.id}>
                            <div className="text-[10px] font-semibold text-gray-500 mb-1">{r.name}</div>
                            <div className="flex flex-wrap gap-1">{rOutlets.map(o => <OutletChip key={o.id} outlet={o} cqc_mode={job.cqc_mode} />)}</div>
                          </div>
                        );
                      }) : <div className="flex flex-wrap gap-1">{bOutlets.map(o => <OutletChip key={o.id} outlet={o} cqc_mode={job.cqc_mode} />)}</div>}
                    </div>
                  )}
                  {bOutlets.length === 0 && <div className="text-xs text-gray-400">No outlets recorded</div>}
                  {/* Status summary */}
                  {bOutlets.length > 0 && (
                    <div className="flex gap-3 mt-2 pt-2 border-t border-gray-200 text-xs">
                      {bOk > 0 && <span className="text-green-700">✓ {bOk} pass</span>}
                      {bWarn > 0 && <span className="text-yellow-700">⚠ {bWarn} warn</span>}
                      {bFail > 0 && <span className="text-red-700">✕ {bFail} fail</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dead legs */}
      {(job.dead_legs || []).length > 0 && (
        <div className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-sm mb-2 text-red-700">⚠ Dead Legs / Blind Ends ({job.dead_legs.length})</div>
          <div className="flex flex-wrap gap-2">
            {job.dead_legs.map(d => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-xs">
                <span className="text-red-500 font-bold">✕</span>
                <span className="font-semibold">{d.location || 'Unknown'}</span>
                {d.pipe_material && <span className="text-gray-500">({d.pipe_material})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}