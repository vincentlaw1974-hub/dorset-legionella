import React, { useRef } from 'react';
import { outletStatus } from '@/lib/jobUtils';

const isDomesticJob = (job) => (job.property_type || '').toLowerCase() === 'domestic';

const STATUS_COLORS = { ok: '#16a34a', warn: '#d97706', fail: '#dc2626', none: '#9ca3af' };

function getRoomStatus(outlets, job) {
  if (!outlets || outlets.length === 0) return 'none';
  const isDomestic = isDomesticJob(job);
  if (outlets.some(o => outletStatus(o, job.cqc_mode, isDomestic).cls === 'fail')) return 'fail';
  if (outlets.some(o => outletStatus(o, job.cqc_mode, isDomestic).cls === 'warn')) return 'warn';
  return 'ok';
}

export default function SchematicDrawing({ job }) {
  const svgRef = useRef(null);
  const isDomestic = isDomesticJob(job);

  const outlets = job.outlets || [];
  const rooms = job.rooms || [];

  // Build display groups
  const roomNames = rooms.map(r => r.name);
  const grouped = {};
  outlets.forEach(o => {
    const k = o.location || 'Unassigned';
    grouped[k] = grouped[k] || [];
    grouped[k].push(o);
  });

  const displayGroups = roomNames.length > 0
    ? roomNames.map(name => ({ name, outlets: grouped[name] || [] }))
    : Object.entries(grouped).map(([name, outs]) => ({ name, outlets: outs }));

  if (!displayGroups.length && !outlets.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
        No rooms or outlets to draw. Add rooms and outlets first.
      </div>
    );
  }

  // Layout constants
  const MARGIN = 40;
  const NODE_W = 90;
  const NODE_H = 44;
  const ROOM_W = 110;
  const ROOM_H = 60;
  const PIPE_COLOR = '#6b7280';
  const COLD_COLOR = '#3b82f6';
  const HOT_COLOR = '#ef4444';

  // Spine nodes (left to right)
  const spineNodes = [];
  spineNodes.push({ id: 'mains', label: 'Cold Mains', icon: '🌊', color: COLD_COLOR, sub: job.cold_source || 'Mains' });
  if (job.cwst_present) spineNodes.push({ id: 'cwst', label: 'Cold Tank', icon: '🪣', color: '#60a5fa', sub: job.cwst_location || '' });
  const cylLabel = job.hw_not_stored ? 'Combi Boiler' : 'HW Cylinder';
  const cylTemp = job.hw_not_stored ? job.hw_boiler_set_temp : job.cylinder_temp;
  const cylColor = (() => { const t = parseFloat(cylTemp); return !isNaN(t) && t < 60 ? '#ef4444' : '#f97316'; })();
  spineNodes.push({ id: 'cylinder', label: cylLabel, icon: '♨️', color: cylColor, sub: cylTemp ? `${cylTemp}°C` : '' });
  if (job.tmvs_installed) spineNodes.push({ id: 'tmv', label: 'TMVs', icon: '🔧', color: '#8b5cf6', sub: 'Blended' });
  spineNodes.push({ id: 'dist', label: 'Distribution', icon: '⚡', color: '#10b981', sub: '' });

  // SVG sizing
  const spineCount = spineNodes.length;
  const spineSpacing = 130;
  const spineY = MARGIN + 60;
  const spineStartX = MARGIN;

  const roomsPerRow = Math.max(1, Math.min(4, Math.ceil(displayGroups.length / 2)));
  const roomSpacingX = 130;
  const roomSpacingY = 100;
  const roomStartX = MARGIN;
  const roomStartY = spineY + NODE_H + 90;

  const totalW = Math.max(
    spineStartX + (spineCount - 1) * spineSpacing + NODE_W + MARGIN,
    roomStartX + (roomsPerRow - 1) * roomSpacingX + ROOM_W + MARGIN
  );

  const totalH = roomStartY + Math.ceil(displayGroups.length / roomsPerRow) * roomSpacingY + ROOM_H + MARGIN;

  // Position rooms in a grid
  const roomPositions = displayGroups.map((g, i) => {
    const col = i % roomsPerRow;
    const row = Math.floor(i / roomsPerRow);
    return {
      x: roomStartX + col * roomSpacingX,
      y: roomStartY + row * roomSpacingY,
      ...g
    };
  });

  // Distribution node is the last spine node
  const distNode = spineNodes[spineNodes.length - 1];
  const distX = spineStartX + (spineNodes.length - 1) * spineSpacing + NODE_W / 2;
  const distY = spineY + NODE_H / 2;

  const handleDownload = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schematic-${(job.site_name || 'site').replace(/\s+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-bold text-sm">📐 Indicative Schematic Drawing</div>
          <div className="text-xs text-gray-500 mt-0.5">Illustrative pipe flow diagram — not to scale</div>
        </div>
        <button
          onClick={handleDownload}
          className="text-xs px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 font-semibold text-gray-700"
        >
          ⬇ Download SVG
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50">
        <svg
          ref={svgRef}
          width={totalW}
          height={totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ fontFamily: 'Arial, sans-serif', minWidth: 340 }}
        >
          {/* Background */}
          <rect width={totalW} height={totalH} fill="#f9fafb" rx="12" />

          {/* Title */}
          <text x={MARGIN} y={26} fontSize={11} fontWeight="bold" fill="#111">
            {job.site_name || job.client || 'Site'} — Indicative Water System Schematic
          </text>
          <text x={MARGIN} y={40} fontSize={9} fill="#6b7280">
            Illustrative only · Not to scale · Dorset Plumbing Legionella Risk Assessment
          </text>

          {/* Spine: horizontal cold pipe */}
          <line
            x1={spineStartX + NODE_W / 2}
            y1={spineY + NODE_H / 2}
            x2={spineStartX + (spineCount - 1) * spineSpacing + NODE_W / 2}
            y2={spineY + NODE_H / 2}
            stroke={COLD_COLOR}
            strokeWidth={3}
            strokeDasharray="6 3"
          />

          {/* Hot pipe from cylinder down */}
          {(() => {
            const cylIdx = spineNodes.findIndex(n => n.id === 'cylinder');
            const cylX = spineStartX + cylIdx * spineSpacing + NODE_W / 2;
            return (
              <line
                x1={cylX}
                y1={spineY + NODE_H}
                x2={cylX}
                y2={spineY + NODE_H + 30}
                stroke={HOT_COLOR}
                strokeWidth={2.5}
              />
            );
          })()}

          {/* Spine nodes */}
          {spineNodes.map((node, i) => {
            const nx = spineStartX + i * spineSpacing;
            const ny = spineY;
            const isNext = i > 0;
            return (
              <g key={node.id}>
                {/* Arrow between nodes */}
                {isNext && (
                  <text
                    x={nx - 12}
                    y={ny + NODE_H / 2 + 4}
                    fontSize={14}
                    fill={PIPE_COLOR}
                    textAnchor="middle"
                  >→</text>
                )}
                {/* Node box */}
                <rect
                  x={nx}
                  y={ny}
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill="white"
                  stroke={node.color}
                  strokeWidth={2.5}
                />
                <text x={nx + NODE_W / 2} y={ny + 16} fontSize={14} textAnchor="middle">{node.icon}</text>
                <text x={nx + NODE_W / 2} y={ny + 28} fontSize={9} fontWeight="bold" textAnchor="middle" fill="#111">{node.label}</text>
                {node.sub && (
                  <text x={nx + NODE_W / 2} y={ny + 39} fontSize={8} textAnchor="middle" fill="#6b7280">{node.sub}</text>
                )}
              </g>
            );
          })}

          {/* Vertical drop from distribution to room grid */}
          {roomPositions.length > 0 && (
            <line
              x1={distX}
              y1={distY + NODE_H / 2}
              x2={distX}
              y2={roomStartY - 12}
              stroke={PIPE_COLOR}
              strokeWidth={2}
            />
          )}

          {/* Horizontal room bus */}
          {roomPositions.length > 1 && (() => {
            const firstX = roomPositions[0].x + ROOM_W / 2;
            const lastRowEnd = roomPositions[Math.min(roomsPerRow - 1, roomPositions.length - 1)].x + ROOM_W / 2;
            return (
              <line
                x1={firstX}
                y1={roomStartY - 12}
                x2={lastRowEnd}
                y2={roomStartY - 12}
                stroke={PIPE_COLOR}
                strokeWidth={2}
              />
            );
          })()}

          {/* Room cards */}
          {roomPositions.map(({ x, y, name, outlets: roomOutlets }, i) => {
            const status = getRoomStatus(roomOutlets, job);
            const col = STATUS_COLORS[status];
            const midX = x + ROOM_W / 2;
            const isDomestic = isDomesticJob(job);

            // Count outlet statuses
            const passC = roomOutlets.filter(o => outletStatus(o, job.cqc_mode, isDomestic).cls === 'ok').length;
            const warnC = roomOutlets.filter(o => outletStatus(o, job.cqc_mode, isDomestic).cls === 'warn').length;
            const failC = roomOutlets.filter(o => outletStatus(o, job.cqc_mode, isDomestic).cls === 'fail').length;

            // Pipe drop from bus to room
            const busRow = Math.floor(i / roomsPerRow);
            const busY = roomStartY - 12 + busRow * roomSpacingY;

            return (
              <g key={name}>
                {/* Drop pipe */}
                <line
                  x1={midX}
                  y1={busY}
                  x2={midX}
                  y2={y}
                  stroke={col}
                  strokeWidth={2}
                />

                {/* Room box */}
                <rect x={x} y={y} width={ROOM_W} height={ROOM_H} rx={8} fill="white" stroke={col} strokeWidth={2.5} />

                {/* Status indicator dot */}
                <circle cx={x + 12} cy={y + 12} r={5} fill={col} />

                {/* Room name */}
                <text x={x + 20} y={y + 16} fontSize={9} fontWeight="bold" fill="#111">
                  {name.length > 14 ? name.slice(0, 13) + '…' : name}
                </text>

                {/* Outlet count */}
                <text x={midX} y={y + 30} fontSize={8} textAnchor="middle" fill="#6b7280">
                  {roomOutlets.length} outlet{roomOutlets.length !== 1 ? 's' : ''}
                </text>

                {/* Status tally */}
                {roomOutlets.length > 0 && (
                  <text x={midX} y={y + 43} fontSize={8} textAnchor="middle" fill={col} fontWeight="bold">
                    {failC > 0 ? `✕${failC} fail` : warnC > 0 ? `⚠${warnC} warn` : `✓${passC} pass`}
                  </text>
                )}

                {/* Outlet type mini-chips */}
                {roomOutlets.slice(0, 4).map((o, oi) => {
                  const st = outletStatus(o, job.cqc_mode, isDomestic);
                  const chipCol = STATUS_COLORS[st.cls];
                  return (
                    <rect
                      key={o.id}
                      x={x + 6 + oi * 22}
                      y={y + ROOM_H - 12}
                      width={18}
                      height={8}
                      rx={3}
                      fill={chipCol}
                      opacity={0.8}
                    />
                  );
                })}
                {roomOutlets.length > 4 && (
                  <text x={x + 6 + 4 * 22} y={y + ROOM_H - 5} fontSize={7} fill="#6b7280">+{roomOutlets.length - 4}</text>
                )}
              </g>
            );
          })}

          {/* Legend */}
          {[
            { color: STATUS_COLORS.ok, label: 'Pass' },
            { color: STATUS_COLORS.warn, label: 'Warning' },
            { color: STATUS_COLORS.fail, label: 'Fail' },
            { color: STATUS_COLORS.none, label: 'No data' },
          ].map((l, i) => (
            <g key={l.label}>
              <circle cx={MARGIN + i * 80} cy={totalH - 16} r={5} fill={l.color} />
              <text x={MARGIN + i * 80 + 10} y={totalH - 12} fontSize={8} fill="#374151">{l.label}</text>
            </g>
          ))}

          {/* Pipe legend */}
          <line x1={MARGIN + 340} y1={totalH - 16} x2={MARGIN + 356} y2={totalH - 16} stroke={COLD_COLOR} strokeWidth={2} strokeDasharray="4 2" />
          <text x={MARGIN + 360} y={totalH - 12} fontSize={8} fill="#374151">Cold</text>
          <line x1={MARGIN + 390} y1={totalH - 16} x2={MARGIN + 406} y2={totalH - 16} stroke={HOT_COLOR} strokeWidth={2} />
          <text x={MARGIN + 410} y={totalH - 12} fontSize={8} fill="#374151">Hot</text>
        </svg>
      </div>

      <div className="mt-2 text-xs text-gray-400 text-center">
        This drawing is indicative only — for illustration purposes. It does not represent actual pipe routes, sizes, or elevations.
      </div>
    </div>
  );
}