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

    // Build outlets rows HTML
    const outletRows = (job.outlets || []).map(o => {
      const st = outletStatus(o, job.cqc_mode);
      const badgeColor = st.cls === 'ok' ? '#dcfce7;color:#166534' : st.cls === 'warn' ? '#fef3c7;color:#92400e' : '#fee2e2;color:#991b1b';
      return `<tr>
        <td>${o.location || ''}</td><td>${o.type || ''}</td><td>${o.hot || ''}</td><td>${o.cold || ''}</td>
        <td>${o.designation || ''}</td><td>${o.infrequent ? 'Yes' : 'No'}</td>
        <td><span style="background:${badgeColor};padding:2px 7px;border-radius:99px;font-weight:bold;font-size:10px">${st.text}</span></td>
        <td>${o.notes || ''}</td>
      </tr>`;
    }).join('');

    const actionRows = (job.actions || []).map(a => {
      const pColor = a.priority === '1' ? '#fee2e2;color:#991b1b' : a.priority === '2' ? '#fef3c7;color:#92400e' : '#f5f5f5;color:#333';
      return `<tr>
        <td>${a.ref || ''}</td><td>${a.system || ''}</td>
        <td><span style="background:${pColor};padding:2px 6px;border-radius:4px;font-weight:bold">${a.priority || ''}</span></td>
        <td>${a.responsible_person || ''}</td><td>${a.deadline || ''}</td>
        <td>${a.observation || ''}</td><td>${a.action || ''}</td><td>${a.status || ''}</td>
      </tr>`;
    }).join('');

    const schemeRows = scheme.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');

    const schemaBoxes = areas.map(a => `
      <div style="border:2px solid ${a.issue ? '#d71920' : '#ccc'};border-radius:8px;padding:8px 10px;min-width:100px;text-align:center;background:${a.issue ? '#fff5f5' : '#fff'}">
        <div style="font-weight:bold;color:${a.issue ? '#991b1b' : '#111'}">${a.name}</div>
        <div style="font-size:10px;color:#666">${a.types}</div>
        <div style="font-size:10px;color:#666">${a.count} outlet${a.count !== 1 ? 's' : ''}</div>
        ${a.issue ? '<div style="font-weight:bold;color:#d71920;font-size:10px">⚠ Issue flagged</div>' : ''}
      </div>`).join('');

    const allPhotos = (job.photos || []).filter(p => p.file_url);
    const photoGrid = allPhotos.map(p => `
      <div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;break-inside:avoid">
        <img src="${p.file_url}" style="width:100%;height:160px;object-fit:contain;background:#f5f5f5;display:block" crossorigin="anonymous" />
        <div style="padding:6px 8px;font-size:10px">
          <div style="font-weight:bold">${p.kind || ''} — ${p.location || ''}</div>
          <div style="color:#666">${p.caption || ''}</div>
        </div>
      </div>`).join('');

    const deadLegRows = (job.dead_legs || []).map(d => `
      <tr>
        <td>${d.location || ''}</td>
        <td>${d.description || ''}</td>
        <td>${d.action || ''}</td>
        <td>${d.photo_url ? `<img src="${d.photo_url}" style="width:60px;height:45px;object-fit:cover;border-radius:4px" crossorigin="anonymous"/>` : '—'}</td>
      </tr>`).join('');

    const showerRows = (job.showers || []).map(s => `
      <tr>
        <td>${s.location || ''}</td>
        <td>${s.last_descale || ''}</td>
        <td>${s.condition || ''}</td>
        <td>${s.notes || ''}</td>
        <td>${s.photo_url ? `<img src="${s.photo_url}" style="width:60px;height:45px;object-fit:cover;border-radius:4px" crossorigin="anonymous"/>` : '—'}</td>
      </tr>`).join('');

    const logRows = (job.logs || []).map(l => `
      <tr>
        <td>${l.date || ''}</td>
        <td>${l.category || ''}</td>
        <td>${l.location || ''}</td>
        <td>${l.detail || ''}</td>
        <td>${l.completed_by || ''}</td>
        <td>${l.status || ''}</td>
      </tr>`).join('');

    const riskColor = riskBadge === 'high' ? '#fee2e2;color:#991b1b' : riskBadge === 'medium' ? '#fef3c7;color:#92400e' : '#dcfce7;color:#166534';

    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Legionella Risk Assessment – ${job.site_name || job.client || 'Report'}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { padding: 15mm 15mm 10mm; }
  h1 { font-size: 22px; color: #d71920; margin: 0 0 4px; }
  h2 { font-size: 13px; border-bottom: 3px solid #d71920; padding-bottom: 4px; margin: 18px 0 8px; color: #111; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10.5px; }
  th { background: #f5e6e6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; text-align: left; padding: 5px 6px; border: 1px solid #ccc; font-weight: bold; }
  td { padding: 4px 6px; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .cover { background: #111 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: white; padding: 30mm 15mm 20mm; border-bottom: 8px solid #d71920; }
  .cover h1 { color: #d71920 !important; font-size: 28px; }
  .cover-img { width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; margin: 16px 0; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-weight: bold; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .schema-wrap { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 8px; }
  @media print {
    body { margin: 0; }
    .no-print { display: none !important; }
    th { background: #f5e6e6 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head><body>

<!-- COVER PAGE -->
<div class="cover">
  <div style="font-size:13px;color:#ccc;margin-bottom:8px">Legionella Risk Assessment Report</div>
  <h1>${job.site_name || job.client || 'Untitled Site'}</h1>
  <div style="color:#ddd;margin-top:4px;font-size:12px">${job.address || ''}</div>
  ${job.cover_photo_url ? `<img src="${job.cover_photo_url}" class="cover-img" crossorigin="anonymous" />` : ''}
  <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px">
    <span class="badge" style="background:${riskColor}">Risk: ${job.risk || 'LOW'}</span>
    ${job.cqc_mode ? '<span class="badge" style="background:#fee2e2;color:#991b1b">CQC Support Mode</span>' : ''}
    ${job.vulnerable_users ? '<span class="badge" style="background:#fef3c7;color:#92400e">Vulnerable Users</span>' : ''}
  </div>
  <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;color:#ccc">
    <div>Assessment date: <strong style="color:#fff">${job.assessment_date || '—'}</strong></div>
    <div>Review due: <strong style="color:#fff">${job.review_due || '—'}</strong></div>
    <div>Assessor: <strong style="color:#fff">${job.assessor || '—'}</strong></div>
    <div>Report ref: <strong style="color:#fff">${job.report_ref || '—'}</strong></div>
    <div>Responsible person: <strong style="color:#fff">${job.responsible_person || '—'}</strong></div>
    <div>Visit date(s): <strong style="color:#fff">${job.visit_dates || '—'}</strong></div>
  </div>
</div>

<div class="page">

<!-- MANAGEMENT -->
<h2>Management structure</h2>
<table>
  <tbody>
    ${[['Duty Holder', job.duty_holder, job.duty_holder_role], ['Responsible Person', job.responsible_person, job.responsible_role], ['Deputy', job.deputy_person, job.deputy_role], ['Assessor', job.assessor, ''], ['Reviewer', job.reviewer, '']].filter(r => r[1]).map(([role, name, r]) => `<tr><td style="font-weight:bold;width:160px">${role}</td><td>${name}</td><td style="color:#555">${r || ''}</td></tr>`).join('')}
  </tbody>
</table>

${job.summary ? `<h2>Executive summary</h2><div style="white-space:pre-line;line-height:1.6">${job.summary}</div>` : ''}

${job.issues_text ? `<h2>Issues / findings</h2><div style="white-space:pre-line;line-height:1.6">${job.issues_text}</div>` : ''}

<!-- SYSTEMS -->
<h2>Water systems overview</h2>
<table>
  <tbody>
    <tr><td style="font-weight:bold;width:200px">Cold water supply</td><td>${job.cold_source || 'Mains'}</td><td style="font-weight:bold;width:200px">Hot water system</td><td>${job.hot_system || '—'}</td></tr>
    <tr><td style="font-weight:bold">CWST present</td><td>${job.cwst_present ? 'Yes' : 'No'}</td><td style="font-weight:bold">CWST location</td><td>${job.cwst_location || '—'}</td></tr>
    <tr><td style="font-weight:bold">CWST temperature °C</td><td>${job.cwst_temp || '—'}</td><td style="font-weight:bold">TMVs installed</td><td>${job.tmvs_installed ? 'Yes' : 'No'}</td></tr>
    <tr><td style="font-weight:bold">Cylinder/calorifier temp °C</td><td>${job.cylinder_temp || '—'}</td><td style="font-weight:bold">Air conditioning</td><td>${job.air_con ? 'Yes' : 'No'}</td></tr>
    <tr><td style="font-weight:bold">Last full flush date</td><td>${job.last_flush_date || '—'}</td><td style="font-weight:bold">Vulnerable users</td><td>${job.vulnerable_users ? 'Yes' : 'No'}</td></tr>
  </tbody>
</table>

<!-- SCHEMATIC -->
${areas.length > 0 ? `
<h2>Indicative schematic</h2>
<div class="schema-wrap">${schemaBoxes}</div>
` : ''}

<!-- CONTROL SCHEME -->
${scheme.length > 0 ? `
<h2>Control scheme (${scheme.length} tasks)</h2>
<table>
  <thead><tr><th>Task</th><th>Frequency</th><th>Requirement</th><th>Responsible</th><th>Record</th></tr></thead>
  <tbody>${schemeRows}</tbody>
</table>` : ''}

<!-- OUTLETS -->
${(job.outlets || []).length > 0 ? `
<h2>Outlet temperature readings (${(job.outlets || []).length} outlets)</h2>
<table>
  <thead><tr><th>Location</th><th>Type</th><th>Hot °C</th><th>Cold °C</th><th>Designation</th><th>Infrequent</th><th>Status</th><th>Notes</th></tr></thead>
  <tbody>${outletRows}</tbody>
</table>` : ''}

<!-- ACTIONS -->
${(job.actions || []).length > 0 ? `
<h2>Improvement actions (${(job.actions || []).length})</h2>
<table>
  <thead><tr><th>Ref</th><th>System</th><th>Priority</th><th>Responsible</th><th>Deadline</th><th>Observation</th><th>Action</th><th>Status</th></tr></thead>
  <tbody>${actionRows}</tbody>
</table>
<div style="font-size:10px;color:#666;margin-top:4px">Priority key: 1 Immediate, 2 As soon as practicable, 3 Planned remedial works, 4 Future maintenance/capital, O Observation</div>` : ''}

<!-- DEAD LEGS -->
${(job.dead_legs || []).length > 0 ? `
<h2>Dead legs / blind ends (${(job.dead_legs || []).length})</h2>
<table>
  <thead><tr><th>Location</th><th>Description</th><th>Recommended action</th><th>Photo</th></tr></thead>
  <tbody>${deadLegRows}</tbody>
</table>` : ''}

<!-- SHOWERS -->
${(job.showers || []).length > 0 ? `
<h2>Shower head register (${(job.showers || []).length})</h2>
<table>
  <thead><tr><th>Location</th><th>Last descale</th><th>Condition</th><th>Notes</th><th>Photo</th></tr></thead>
  <tbody>${showerRows}</tbody>
</table>` : ''}

<!-- LOGBOOK -->
${(job.logs || []).length > 0 ? `
<h2>Site logbook (${(job.logs || []).length} entries)</h2>
<table>
  <thead><tr><th>Date</th><th>Category</th><th>Location</th><th>Detail</th><th>Completed by</th><th>Status</th></tr></thead>
  <tbody>${logRows}</tbody>
</table>` : ''}

<!-- PHOTOS -->
${allPhotos.length > 0 ? `
<h2>Photographic evidence (${allPhotos.length} photos)</h2>
<div class="photo-grid">${photoGrid}</div>` : ''}

<div style="margin-top:30px;padding-top:10px;border-top:2px solid #d71920;font-size:10px;color:#888;text-align:center">
  Dorset Plumbing — Legionella Risk Assessment Report &nbsp;|&nbsp; ${job.site_name || job.client || ''} &nbsp;|&nbsp; ${job.assessment_date || ''} &nbsp;|&nbsp; Ref: ${job.report_ref || '—'}
</div>

</div>
</body></html>`);

    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 800);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <strong>Report preview</strong>
        <button onClick={handlePrint} className="text-sm px-4 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
          Export PDF / Print
        </button>
      </div>

      {/* Printable preview */}
      <div ref={printRef} className="text-sm space-y-3">
        {/* Cover */}
        <div className="rounded-xl p-5 text-white" style={{ background: 'linear-gradient(180deg,#111 0%,#1d1d1d 100%)', borderBottom: '6px solid #d71920' }}>
          <div className="text-xs text-gray-400 mb-1">Legionella Risk Assessment Report</div>
          <h1 className="text-2xl font-bold" style={{ color: '#d71920' }}>{job.site_name || job.client || 'Untitled Site'}</h1>
          <div className="text-gray-300 text-xs mt-1">{job.address}</div>
          {job.cover_photo_url && <img src={job.cover_photo_url} alt="Cover" className="w-full h-40 object-cover rounded-xl mt-3" />}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold badge-${riskBadge}`}>Risk: {job.risk || 'LOW'}</span>
            {job.cqc_mode && <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-high">CQC Mode</span>}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-3 text-xs text-gray-300">
            <div>Assessment: <strong className="text-white">{job.assessment_date || '—'}</strong></div>
            <div>Review due: <strong className="text-white">{job.review_due || '—'}</strong></div>
            <div>Assessor: <strong className="text-white">{job.assessor || '—'}</strong></div>
            <div>Ref: <strong className="text-white">{job.report_ref || '—'}</strong></div>
          </div>
        </div>

        {/* Summary */}
        {job.summary && <><hr /><div><strong>Executive summary</strong></div><div className="text-xs text-gray-700 whitespace-pre-line">{job.summary}</div></>}
        {job.issues_text && <><hr /><div><strong>Issues / findings</strong></div><div className="text-xs text-gray-700 whitespace-pre-line">{job.issues_text}</div></>}

        {/* Schematic */}
        {areas.length > 0 && (
          <>
            <hr />
            <div><strong>Indicative schematic</strong></div>
            <div className="flex flex-wrap gap-2 mt-2">
              {areas.map((a, i) => (
                <div key={i} className={`border-2 rounded-xl p-2 text-xs text-center min-w-[90px] ${a.issue ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 bg-white'}`}>
                  <div className="font-bold">{a.name}</div>
                  <div className="text-gray-500 text-[10px]">{a.types}</div>
                  <div className="text-gray-500 text-[10px]">{a.count} outlet{a.count !== 1 ? 's' : ''}</div>
                  {a.issue && <div className="font-bold text-red-600 text-[10px]">⚠ Issue</div>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Control scheme */}
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

        {/* Outlets */}
        {(job.outlets || []).length > 0 && (
          <>
            <hr />
            <div><strong>Outlets ({(job.outlets || []).length})</strong></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs mt-1">
                <thead><tr className="bg-red-50">{['Location','Type','Hot °C','Cold °C','Status','Notes'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>{(job.outlets || []).map(o => {
                  const st = outletStatus(o, job.cqc_mode);
                  return <tr key={o.id}>
                    <td className="border border-gray-200 p-1.5">{o.location}</td>
                    <td className="border border-gray-200 p-1.5">{o.type}</td>
                    <td className="border border-gray-200 p-1.5">{o.hot}</td>
                    <td className="border border-gray-200 p-1.5">{o.cold}</td>
                    <td className="border border-gray-200 p-1.5"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold badge-${st.cls}`}>{st.text}</span></td>
                    <td className="border border-gray-200 p-1.5">{o.notes}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </>
        )}

        {/* Actions */}
        {(job.actions || []).length > 0 && (
          <>
            <hr />
            <div><strong>Improvement actions ({(job.actions || []).length})</strong></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs mt-1">
                <thead><tr className="bg-red-50">{['Ref','System','Pri','Responsible','Deadline','Observation','Action','Status'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>{(job.actions || []).map(a => <tr key={a.id}>
                  <td className="border border-gray-200 p-1.5">{a.ref}</td>
                  <td className="border border-gray-200 p-1.5">{a.system}</td>
                  <td className="border border-gray-200 p-1.5 font-bold">{a.priority}</td>
                  <td className="border border-gray-200 p-1.5">{a.responsible_person}</td>
                  <td className="border border-gray-200 p-1.5">{a.deadline}</td>
                  <td className="border border-gray-200 p-1.5">{a.observation}</td>
                  <td className="border border-gray-200 p-1.5">{a.action}</td>
                  <td className="border border-gray-200 p-1.5">{a.status}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </>
        )}

        {/* Dead legs */}
        {(job.dead_legs || []).length > 0 && (
          <>
            <hr />
            <div><strong>Dead legs ({(job.dead_legs || []).length})</strong></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs mt-1">
                <thead><tr className="bg-red-50">{['Location','Description','Action','Photo'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>{(job.dead_legs || []).map(d => <tr key={d.id}>
                  <td className="border border-gray-200 p-1.5">{d.location}</td>
                  <td className="border border-gray-200 p-1.5">{d.description}</td>
                  <td className="border border-gray-200 p-1.5">{d.action}</td>
                  <td className="border border-gray-200 p-1.5">{d.photo_url && <img src={d.photo_url} alt="" className="w-16 h-12 object-cover rounded" />}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </>
        )}

        {/* Showers */}
        {(job.showers || []).length > 0 && (
          <>
            <hr />
            <div><strong>Shower head register ({(job.showers || []).length})</strong></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs mt-1">
                <thead><tr className="bg-red-50">{['Location','Last descale','Condition','Notes','Photo'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>{(job.showers || []).map(s => <tr key={s.id}>
                  <td className="border border-gray-200 p-1.5">{s.location}</td>
                  <td className="border border-gray-200 p-1.5">{s.last_descale}</td>
                  <td className="border border-gray-200 p-1.5">{s.condition}</td>
                  <td className="border border-gray-200 p-1.5">{s.notes}</td>
                  <td className="border border-gray-200 p-1.5">{s.photo_url && <img src={s.photo_url} alt="" className="w-16 h-12 object-cover rounded" />}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </>
        )}

        {/* Photos */}
        {(job.photos || []).filter(p => p.file_url).length > 0 && (
          <>
            <hr />
            <div><strong>Photographic evidence ({(job.photos || []).filter(p => p.file_url).length} photos)</strong></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              {(job.photos || []).filter(p => p.file_url).map(p => (
                <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="h-32 bg-gray-100"><img src={p.file_url} alt={p.caption} className="w-full h-full object-contain" /></div>
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