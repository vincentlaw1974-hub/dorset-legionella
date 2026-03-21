import React from 'react';
import { buildControlScheme, outletStatus } from '@/lib/jobUtils';

function h(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSchematic(job) {
  const groups = {};
  (job.outlets || []).forEach(o => {
    const key = o.location || 'Area';
    const hot = parseFloat(o.hot), cold = parseFloat(o.cold);
    const target = o.type === 'Pot Wash' ? 60 : (job.cqc_mode ? 55 : 50);
    groups[key] = groups[key] || { count: 0, issue: false, types: new Set() };
    groups[key].count++;
    groups[key].types.add(o.type || 'Outlet');
    if ((!isNaN(hot) && hot < target) || (!isNaN(cold) && cold > 20)) groups[key].issue = true;
  });
  return Object.entries(groups).map(([name, info]) => ({ name, count: info.count, issue: info.issue, types: [...info.types].join(', ') }));
}

export default function ReportTab({ job, onPrint }) {
  const fails = (job.outlets || []).filter(o => outletStatus(o, job.cqc_mode).cls !== 'ok').length;
  const scheme = buildControlScheme(job);
  const riskBadge = (job.risk || 'LOW').toLowerCase();
  const areas = buildSchematic(job);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <strong>Report preview</strong>
        <button onClick={onPrint} className="text-sm px-4 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
          Export report PDF
        </button>
      </div>

      <div className="text-sm space-y-2">
        <div className="font-bold text-base">{job.site_name || job.client || 'Untitled site'}</div>
        <div className="text-gray-500 text-xs">{job.address}</div>
        <hr />
        <div className="flex flex-wrap gap-2 items-center">
          <strong>Risk:</strong>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold badge-${riskBadge}`}>{job.risk || 'LOW'}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-ok">Outlets {(job.outlets || []).length}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${fails ? 'badge-warn' : 'badge-ok'}`}>Temp flags {fails}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-ok">Actions {(job.actions || []).length}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-ok">Photos {(job.photos || []).length}</span>
          {job.cqc_mode && <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-high">CQC support mode</span>}
        </div>
        <hr />
        {job.summary && <div>{job.summary.split('\n').map((l, i) => <div key={i}>{l}</div>)}</div>}
        <hr />
        <div><strong>Management structure</strong></div>
        <div className="text-xs text-gray-600">Duty Holder: {job.duty_holder} • Responsible Person: {job.responsible_person} • Assessor: {job.assessor}</div>

        {scheme.length > 0 && (
          <>
            <hr />
            <div><strong>Control scheme ({scheme.length} tasks)</strong></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs mt-1">
                <thead><tr className="bg-red-50">{['Task','Frequency','Requirement','Responsible','Record'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>{scheme.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border border-gray-200 p-1.5">{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </>
        )}

        {areas.length > 0 && (
          <>
            <hr />
            <div><strong>Indicative schematic</strong></div>
            <div className="flex flex-wrap gap-2 mt-2">
              {areas.map((a, i) => (
                <div key={i} className={`border-2 rounded-xl p-2 text-xs text-center min-w-[100px] ${a.issue ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 bg-white'}`}>
                  <div className="font-bold">{a.name}</div>
                  <div className="text-gray-500">{a.types}</div>
                  <div className="text-gray-500">{a.count} outlet{a.count !== 1 ? 's' : ''}</div>
                  {a.issue && <div className="font-bold text-red-600 text-[10px]">Issue flagged</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}