import React from 'react';
import { reportChecks } from '@/lib/jobUtils';

export default function ReportChecks({ job }) {
  const checks = reportChecks(job);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
      <div className="text-xs text-gray-500 mb-2">Report readiness</div>
      {checks.map(([label, ok]) => (
        <div key={label} className="text-xs my-1.5">
          {ok ? '✅' : '⚠️'} {label}
        </div>
      ))}
    </div>
  );
}