import React, { useState } from 'react';
import { outletStatus } from '@/lib/jobUtils';

const STATUS_ORDER = ['In Progress', 'Completed', 'Reviewed', 'Future'];
const STATUS_COLORS = {
  'In Progress': { bg: '#eff6ff', border: '#3b82f6', dot: '#3b82f6', label: '#1d4ed8' },
  'Completed':   { bg: '#f0fdf4', border: '#22c55e', dot: '#22c55e', label: '#15803d' },
  'Reviewed':    { bg: '#faf5ff', border: '#a855f7', dot: '#a855f7', label: '#7e22ce' },
  'Future':      { bg: '#f9fafb', border: '#9ca3af', dot: '#9ca3af', label: '#4b5563' },
};
const RISK_COLORS = { LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#dc2626' };

function jobProgress(job) {
  // Outlets with at least one temp recorded
  const outlets = job.outlets || [];
  const totalOutlets = outlets.length;
  const recordedOutlets = outlets.filter(o =>
    (o.hot && o.hot !== '') || (o.cold && o.cold !== '')
  ).length;

  // Rooms defined
  const rooms = job.rooms || [];

  // Buildings progress (for holiday parks)
  const buildings = job.buildings || [];
  let bOutletTotal = 0, bOutletRecorded = 0;
  buildings.forEach(b => {
    const bo = b.outlets || [];
    bOutletTotal += bo.length;
    bOutletRecorded += bo.filter(o => (o.hot && o.hot !== '') || (o.cold && o.cold !== '')).length;
  });

  // Actions completed
  const actions = job.actions || [];
  const completedActions = actions.filter(a => a.status === 'Completed').length;

  // Combine main outlets + building outlets
  const grandTotal = totalOutlets + bOutletTotal;
  const grandRecorded = recordedOutlets + bOutletRecorded;

  // Score: weighted combination
  const outletScore = grandTotal > 0 ? grandRecorded / grandTotal : null;
  const hasRooms = rooms.length > 0 || buildings.some(b => (b.rooms||[]).length > 0);

  // Fields filled: key job fields
  const fieldChecks = [
    job.assessor, job.assessment_date, job.review_due, job.responsible_person,
    job.site_description || job.site_name, job.summary,
  ].filter(Boolean).length;
  const fieldScore = fieldChecks / 6;

  // Overall percent
  let pct = 0;
  let breakdown = [];
  if (grandTotal > 0) {
    pct = Math.round((outletScore * 0.6 + fieldScore * 0.4) * 100);
    breakdown = [
      { label: 'Outlets recorded', val: grandRecorded, total: grandTotal },
      ...(actions.length > 0 ? [{ label: 'Actions completed', val: completedActions, total: actions.length }] : []),
    ];
  } else {
    pct = Math.round(fieldScore * 100);
    breakdown = [{ label: 'Key fields', val: fieldChecks, total: 6 }];
  }

  return { pct: Math.min(pct, 100), breakdown, grandTotal, grandRecorded, rooms: rooms.length + buildings.reduce((n,b)=>n+(b.rooms||[]).length,0) };
}

function ProgressBar({ pct, status }) {
  const color = status === 'Completed' || status === 'Reviewed' ? '#22c55e' : pct >= 70 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
        <span>Progress</span>
        <span className="font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function JobCard({ job, onSelect }) {
  const { pct, breakdown, grandTotal, grandRecorded, rooms } = jobProgress(job);
  const risk = job.risk || 'LOW';
  const riskColor = RISK_COLORS[risk] || '#888';

  return (
    <div
      onClick={() => onSelect(job.id)}
      className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow hover:border-gray-300"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate text-gray-900">{job.site_name || job.client || 'Untitled'}</div>
          <div className="text-[11px] text-gray-400 truncate">{job.address || job.client || '—'}</div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: riskColor, background: riskColor + '18' }}>{risk}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 mb-1">
        {job.assessment_date && <span>📅 {job.assessment_date}</span>}
        {grandTotal > 0 && <span>💧 {grandRecorded}/{grandTotal} outlets</span>}
        {rooms > 0 && <span>🚪 {rooms} rooms</span>}
        {(job.buildings||[]).length > 0 && <span>🏘️ {job.buildings.length} buildings</span>}
      </div>

      <ProgressBar pct={pct} status={job.status} />

      {breakdown.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1.5">
          {breakdown.map((b, i) => (
            <span key={i} className="text-[9px] text-gray-400">
              {b.label}: {b.val}/{b.total}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatusGroupedTab({ jobs, onSelect }) {
  const [collapsed, setCollapsed] = useState({});

  const grouped = {};
  STATUS_ORDER.forEach(s => { grouped[s] = []; });
  jobs.forEach(j => {
    const s = j.status || 'In Progress';
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(j);
  });

  const toggleCollapse = (status) => setCollapsed(c => ({ ...c, [status]: !c[status] }));

  return (
    <div className="space-y-4">
      {STATUS_ORDER.map(status => {
        const group = grouped[status] || [];
        if (group.length === 0) return null;
        const colors = STATUS_COLORS[status] || STATUS_COLORS['In Progress'];
        const isCollapsed = collapsed[status];
        const avgPct = Math.round(group.reduce((s, j) => s + jobProgress(j).pct, 0) / group.length);

        return (
          <div key={status} className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${colors.border}`, background: colors.bg }}>
            {/* Group header */}
            <button
              onClick={() => toggleCollapse(status)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors.dot }} />
                <span className="font-bold text-sm" style={{ color: colors.label }}>{status}</span>
                <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                  {group.length} job{group.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-bold" style={{ color: colors.dot }}>Avg {avgPct}%</div>
                  <div className="h-1.5 w-20 bg-white/60 rounded-full overflow-hidden mt-0.5">
                    <div className="h-full rounded-full" style={{ width: `${avgPct}%`, background: colors.dot }} />
                  </div>
                </div>
                <span className="text-gray-400 text-sm">{isCollapsed ? '▼' : '▲'}</span>
              </div>
            </button>

            {/* Job cards */}
            {!isCollapsed && (
              <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.map(job => (
                  <JobCard key={job.id} job={job} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {jobs.length === 0 && (
        <div className="text-center text-gray-400 py-12 text-sm">No jobs yet.</div>
      )}
    </div>
  );
}