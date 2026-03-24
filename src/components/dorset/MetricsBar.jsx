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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      <Metric label="Overall risk" value={job.risk || 'LOW'} color={riskColor} />
      <Metric label="Outlets" value={(job.outlets || []).length} />
      <Metric label="Temp fails" value={(job.outlets || []).filter(o => { const hot = parseFloat(o.hot), cold = parseFloat(o.cold); return (!isNaN(hot) && hot < (job.cqc_mode ? 55 : 50)) || (!isNaN(cold) && cold > 20); }).length} />
      <Metric label="Photos" value={(job.photos || []).length} />
      <Metric label="Log entries" value={(job.logs || []).length} />
    </div>
  );
}