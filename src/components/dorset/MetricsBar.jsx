import React from 'react';

function Metric({ label, value, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${color || ''}`}>{value}</div>
    </div>
  );
}

export default function MetricsBar({ job }) {
  const riskColor = { LOW: 'text-green-700', MEDIUM: 'text-amber-700', HIGH: 'text-red-700' }[job.risk] || '';
  return (
    <div className="grid grid-cols-4 gap-2 mb-3">
      <Metric label="Risk" value={job.risk || 'LOW'} color={riskColor} />
      <Metric label="Outlets" value={(job.outlets || []).length} />
      <Metric label="Actions" value={(job.actions || []).length} />
      <Metric label="Photos" value={(job.photos || []).length} />
    </div>
  );
}