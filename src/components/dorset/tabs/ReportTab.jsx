import React, { useRef } from 'react';
import { buildControlScheme, outletStatus } from '@/lib/jobUtils';

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
  const printRef = useRef();
  const fails = (job.outlets || []).filter(o => outletStatus(o, job.cqc_mode).cls !== 'ok').length;
  const scheme = buildControlScheme(job);
  const riskBadge = (job.risk || 'LOW').toLowerCase();
  const areas = buildSchematic(job);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Legionella Risk Assessment - ${job.site_name || job.client || 'Report'}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20mm; }
        h1 { font-size: 18px; color: #d71920; margin-bottom: 4px; }
        h2 { font-size: 13px; border-bottom: 2px solid #d71920; padding-bottom: 4px; margin-top: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
        th { background: #f5e6e6; text-align: left; padding: 6px; border: 1px solid #ccc; }
        td { padding: 5px 6px; border: 1px solid #ccc; vertical-align: top; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-weight: bold; font-size: 10px; }
        .badge-low { background: #dcfce7; color: #166534; }
        .badge-medium { background: #fef3c7; color: #92400e; }
        .badge-high { background: #fee2e2; color: #991b1b; }
        .badge-ok { background: #dcfce7; color: #166534; }
        .badge-warn { background: #fef3c7; color: #92400e; }
        .badge-fail { background: #fee2e2; color: #991b1b; }
        .schematics { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .schema-box { border: 2px solid #ccc; border-radius: 8px; padding: 8px; min-width: 100px; text-align: center; }
        .schema-box.issue { border-color: #d71920; background: #fff5f5; color: #991b1b; }
        @media print { body { margin: 10mm; } }
      </style></head><body>
      ${el.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <strong>Report preview</strong>
        <button onClick={handlePrint} className="text-sm px-4 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
          Print / Export PDF
        </button>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="text-sm space-y-3">
        <h1 className="text-lg font-bold text-red-700">{job.site_name || job.client || 'Untitled site'}</h1>
        <div className="text-gray-500 text-xs">{job.address}</div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold badge-${riskBadge}`}>Risk: {job.risk || 'LOW'}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-ok">Outlets: {(job.outlets || []).length}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${fails ? 'badge-warn' : 'badge-ok'}`}>Temp flags: {fails}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-ok">Actions: {(job.actions || []).length}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-ok">Photos: {(job.photos || []).length}</span>
          {job.cqc_mode && <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-high">CQC support mode</span>}
        </div>

        <hr />
        <div><strong>Dates</strong></div>
        <div className="text-xs text-gray-600">Assessment: {job.assessment_date} &nbsp;|&nbsp; Review due: {job.review_due || '—'} &nbsp;|&nbsp; Visit(s): {job.visit_dates || '—'} &nbsp;|&nbsp; Ref: {job.report_ref || '—'}</div>

        <hr />
        <div><strong>Management structure</strong></div>
        <table className="w-full border-collapse text-xs mt-1">
          <tbody>
            {[['Duty Holder', job.duty_holder, job.duty_holder_role],['Responsible Person', job.responsible_person, job.responsible_role],['Deputy', job.deputy_person, job.deputy_role],['Assessor', job.assessor, ''],['Reviewer', job.reviewer, '']].filter(r => r[1]).map(([role, name, r]) => (
              <tr key={role}>
                <td className="border border-gray-200 p-1.5 font-medium w-40">{role}</td>
                <td className="border border-gray-200 p-1.5">{name}</td>
                <td className="border border-gray-200 p-1.5 text-gray-500">{r}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {job.summary && (
          <>
            <hr />
            <div><strong>Executive summary</strong></div>
            <div className="text-xs text-gray-700 whitespace-pre-line">{job.summary}</div>
          </>
        )}

        {job.issues_text && (
          <>
            <hr />
            <div><strong>Issues / findings</strong></div>
            <div className="text-xs text-gray-700 whitespace-pre-line">{job.issues_text}</div>
          </>
        )}

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

        {(job.outlets || []).length > 0 && (
          <>
            <hr />
            <div><strong>Outlet temperature readings ({(job.outlets || []).length} outlets)</strong></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs mt-1">
                <thead><tr className="bg-red-50">{['Location','Type','Hot °C','Cold °C','Designation','Infrequent','Status','Notes'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>{(job.outlets || []).map(o => {
                  const st = outletStatus(o, job.cqc_mode);
                  return (
                    <tr key={o.id}>
                      <td className="border border-gray-200 p-1.5">{o.location}</td>
                      <td className="border border-gray-200 p-1.5">{o.type}</td>
                      <td className="border border-gray-200 p-1.5">{o.hot}</td>
                      <td className="border border-gray-200 p-1.5">{o.cold}</td>
                      <td className="border border-gray-200 p-1.5">{o.designation}</td>
                      <td className="border border-gray-200 p-1.5">{o.infrequent ? 'Yes' : 'No'}</td>
                      <td className="border border-gray-200 p-1.5"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold badge-${st.cls}`}>{st.text}</span></td>
                      <td className="border border-gray-200 p-1.5">{o.notes}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </>
        )}

        {(job.actions || []).length > 0 && (
          <>
            <hr />
            <div><strong>Improvement actions ({(job.actions || []).length})</strong></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs mt-1">
                <thead><tr className="bg-red-50">{['Ref','System','Priority','Observation','Action','Status'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>{(job.actions || []).map(a => (
                  <tr key={a.id}>
                    <td className="border border-gray-200 p-1.5">{a.ref}</td>
                    <td className="border border-gray-200 p-1.5">{a.system}</td>
                    <td className="border border-gray-200 p-1.5 font-bold">{a.priority}</td>
                    <td className="border border-gray-200 p-1.5">{a.observation}</td>
                    <td className="border border-gray-200 p-1.5">{a.action}</td>
                    <td className="border border-gray-200 p-1.5">{a.status}</td>
                  </tr>
                ))}</tbody>
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

        {(job.photos || []).filter(p => p.kind && p.location && p.caption).length > 0 && (
          <>
            <hr />
            <div><strong>Photographic evidence</strong></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              {(job.photos || []).filter(p => p.kind && p.location && p.caption).map(p => (
                <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="aspect-video bg-gray-100">
                    <img src={p.file_url} alt={p.caption} className="w-full h-full object-contain" />
                  </div>
                  <div className="p-2 text-xs">
                    <div className="font-medium">{p.kind} — {p.location}</div>
                    <div className="text-gray-500">{p.caption}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}