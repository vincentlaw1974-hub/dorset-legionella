import React, { useRef, useEffect } from 'react';

async function compressImage(url, maxWidth = 500, quality = 0.3) {
  if (!url) return url;
  try {
    const resp = await fetch(url, { mode: 'cors' });
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(blobUrl);
        resolve(dataUrl);
      };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(url); };
      img.src = blobUrl;
    });
  } catch {
    return url;
  }
}
import { buildControlScheme, outletStatus } from '@/lib/jobUtils';

function buildSchematic(job) {
  const groups = {};
  (job.outlets || []).forEach(o => {
    const key = o.location || 'Area';
    const { cls } = outletStatus(o, job.cqc_mode);
    groups[key] = groups[key] || { count: 0, issue: false, types: new Set() };
    groups[key].count++;
    groups[key].types.add(o.type || 'Outlet');
    if (cls !== 'ok') groups[key].issue = true;
  });
  return Object.entries(groups).map(([name, info]) => ({ name, count: info.count, issue: info.issue, types: [...info.types].join(', ') }));
}

export default function ReportTab({ job, onPrint }) {
  const printRef = useRef();
  const handlePrintRef = useRef(null);

  useEffect(() => {
    const handler = () => handlePrintRef.current && handlePrintRef.current();
    window.addEventListener('dorset:export', handler);
    return () => window.removeEventListener('dorset:export', handler);
  }, []);

  const scheme = buildControlScheme(job);
  const riskBadge = (job.risk || 'LOW').toLowerCase();
  const areas = buildSchematic(job);

  const buildReportHtml = (ci = (u) => u) => {
    const roomGroups = {};
    (job.outlets || []).forEach(o => {
      const key = o.location || 'Unspecified';
      if (!roomGroups[key]) roomGroups[key] = [];
      roomGroups[key].push(o);
    });

    const outletTypeIcon = (type) => {
      const map = { 'WHB': '🚿', 'Shower': '🚿', 'Bath': '🛁', 'Kitchen Sink': '🍽️', 'Cleaner Sink': '🪣', 'Outside Tap': '🌿', 'Pot Wash': '🍽️', 'TMV': '🔧' };
      return map[type] || '💧';
    };

    const statusColor = (o) => {
      const st = outletStatus(o, job.cqc_mode);
      return st.cls === 'ok' ? '#27ae60' : st.cls === 'warn' ? '#e67e22' : '#c0392b';
    };

    const flowNodes = [
      { label: 'Cold Mains', sub: job.cold_source || 'Mains', color: '#3b82f6', bg: '#eff6ff', icon: '🌊' },
      job.cwst_present ? { label: 'CWST', sub: job.cwst_location || 'Storage tank', color: '#8b5cf6', bg: '#f5f3ff', icon: '🏗️' } : null,
      job.hw_not_stored ? null : { label: 'HW Cylinder', sub: job.cylinder_temp ? job.cylinder_temp + '°C' : 'Storage', color: '#f97316', bg: '#fff7ed', icon: '♨️' },
      job.tmvs_installed ? { label: 'TMVs', sub: 'Blended outlets', color: '#8b5cf6', bg: '#f5f3ff', icon: '🔧' } : null,
      { label: 'Outlets', sub: `${(job.outlets||[]).length} total`, color: '#10b981', bg: '#ecfdf5', icon: '🚿' },
    ].filter(Boolean);

    const flowHtml = flowNodes.map((n, i) =>
      `<div style="display:inline-flex;align-items:center;gap:6px">
        <div style="border:2px solid ${n.color};background:${n.bg};border-radius:10px;padding:8px 12px;text-align:center;min-width:80px">
          <div style="font-size:18px">${n.icon}</div>
          <div style="font-weight:bold;font-size:10px;color:${n.color}">${n.label}</div>
          <div style="font-size:9px;color:#666">${n.sub}</div>
        </div>
        ${i < flowNodes.length - 1 ? '<span style="font-size:16px;color:#999">→</span>' : ''}
      </div>`
    ).join('');

    const passCount = (job.outlets||[]).filter(o => outletStatus(o, job.cqc_mode).cls === 'ok').length;
    const warnCount = (job.outlets||[]).filter(o => outletStatus(o, job.cqc_mode).cls === 'warn').length;
    const failCount = (job.outlets||[]).filter(o => outletStatus(o, job.cqc_mode).cls === 'fail').length;

    const roomCardsHtml = Object.entries(roomGroups).map(([room, outlets]) => {
      const roomFail = outlets.some(o => outletStatus(o, job.cqc_mode).cls === 'fail');
      const roomWarn = outlets.some(o => outletStatus(o, job.cqc_mode).cls === 'warn');
      const borderCol = roomFail ? '#c0392b' : roomWarn ? '#e67e22' : '#10b981';
      const bgCol = roomFail ? '#fff5f5' : roomWarn ? '#fffbeb' : '#f0fdf4';
      const chips = outlets.map(o => {
        const st = outletStatus(o, job.cqc_mode);
        const col = statusColor(o);
        return `<div style="border:2px solid ${col};border-radius:8px;padding:5px 8px;background:#fff;text-align:center;min-width:70px">
          <div style="font-size:14px">${outletTypeIcon(o.type)}</div>
          <div style="font-size:9px;font-weight:bold">${o.type||'Outlet'}</div>
          <div style="font-size:9px;font-weight:bold;color:${col}">${st.text.toUpperCase()}</div>
          ${o.hot ? `<div style="font-size:8px;color:#555">${o.hot}°C H</div>` : ''}
          ${o.cold ? `<div style="font-size:8px;color:#555">${o.cold}°C C</div>` : ''}
        </div>`;
      }).join('');
      return `<div style="border:2px solid ${borderCol};background:${bgCol};border-radius:10px;padding:10px;margin-bottom:10px;break-inside:avoid">
        <div style="font-weight:bold;font-size:11px;margin-bottom:6px;color:${borderCol}">● ${room} &nbsp;<span style="font-weight:normal;color:#666;font-size:9px">${outlets.length} outlet${outlets.length!==1?'s':''}</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${chips}</div>
      </div>`;
    }).join('');

    const outletRows = (job.outlets || []).map(o => {
      const st = outletStatus(o, job.cqc_mode);
      const badgeColor = st.cls === 'ok' ? '#dcfce7;color:#166534' : st.cls === 'warn' ? '#fef3c7;color:#92400e' : '#fee2e2;color:#991b1b';
      const isOutsideTap = o.type === 'Outside Tap';
      const hotCell = isOutsideTap ? '<em style="color:#888">cold only</em>' : (o.hot || '—');
      const extraNote = isOutsideTap ? (o.check_valve ? 'Check valve: ✓' : 'Check valve: not recorded') : (o.infrequent ? 'Infrequent use' : '');
      const noteText = [o.notes, extraNote].filter(Boolean).join(' | ');
      const photoCell = o.photo_url ? `<img src="${ci(o.photo_url)}" style="width:60px;height:45px;object-fit:cover;border-radius:4px" />` : '—';
      return `<tr><td>${o.location||''}</td><td>${o.type||''}</td><td>${hotCell}</td><td>${o.cold||'—'}</td><td><span style="background:${badgeColor};padding:2px 7px;border-radius:99px;font-weight:bold;font-size:10px">${st.text}</span></td><td>${noteText}</td><td>${photoCell}</td></tr>`;
    }).join('');

    const actionRows = (job.actions || []).map(a => {
      const pColor = a.priority === '1' ? '#fee2e2;color:#991b1b' : a.priority === '2' ? '#fef3c7;color:#92400e' : '#f5f5f5;color:#333';
      return `<tr><td>${a.ref||''}</td><td>${a.system||''}</td><td><span style="background:${pColor};padding:2px 6px;border-radius:4px;font-weight:bold">${a.priority||''}</span></td><td>${a.responsible_person||''}</td><td>${a.deadline||''}</td><td>${a.observation||''}</td><td>${a.action||''}</td><td>${a.status||''}</td></tr>`;
    }).join('');

    const schemeRows = scheme.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');

    const allPhotos = (job.photos || []).filter(p => p.file_url);
    const photoGrid = allPhotos.map(p => `<div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;break-inside:avoid"><img src="${ci(p.file_url)}" style="width:100%;height:160px;object-fit:contain;background:#f5f5f5;display:block" /><div style="padding:6px 8px;font-size:10px"><div style="font-weight:bold">${p.kind||''} — ${p.location||''}</div><div style="color:#666">${p.caption||''}</div></div></div>`).join('');

    const deadLegRows = (job.dead_legs || []).map(d => `<div style="margin-bottom:16px"><div style="background:#d71920;color:#fff;padding:5px 10px;font-weight:bold;font-size:10px;border-radius:4px 4px 0 0">Dead Leg: ${d.location||'Unknown'}</div><div style="border:1px solid #ddd;border-top:none;padding:8px 10px;font-size:10px;border-radius:0 0 4px 4px"><div>Location: ${d.location||'—'} | Pipe Material: ${d.pipe_material||'Not recorded'} | Last Actioned: ${d.last_actioned||'Not recorded'}</div><div>Description: ${d.description||'—'}</div>${d.photo_url?`<div><img src="${ci(d.photo_url)}" style="max-width:220px;max-height:160px;object-fit:contain;border-radius:4px"/></div>`:''}</div></div>`).join('');

    const showerRows = (job.showers || []).map(s => `<tr><td>${s.location||''}</td><td>${s.last_descale||''}</td><td>${s.condition||''}</td><td>${s.notes||''}</td><td>${s.photo_url?`<img src="${ci(s.photo_url)}" style="width:60px;height:45px;object-fit:cover;border-radius:4px"/>`:'-'}</td></tr>`).join('');

    const logRows = (job.logs || []).map(l => `<tr><td>${l.date||''}</td><td>${l.category||''}</td><td>${l.location||''}</td><td>${l.detail||''}</td><td>${l.completed_by||''}</td><td>${l.status||''}</td></tr>`).join('');

    const hasDeadLegs = (job.dead_legs || []).length > 0;
    const hasBuildings = (job.buildings || []).length > 0;
    const cylTemp = parseFloat(job.hw_not_stored ? job.hw_boiler_set_temp : job.cylinder_temp);
    const hwTempFail = !isNaN(cylTemp) && cylTemp < 60;
    const targetHot = job.cqc_mode ? 55 : 50;

    const checks = [
      { label: 'Temp Monitoring', pass: !!job.monthly_temp_log || !!job.log_temps_na },
      { label: 'Flushing Log', pass: !!job.flushing_log || !!job.log_flush_na },
      { label: 'Shower Cleaning', pass: !!job.shower_cleaning_log || !!job.log_shower_na },
      { label: 'TMV Records', pass: !job.tmvs_installed || !!job.tmv_service_records || !!job.log_tmv_na },
      { label: 'HW Temp >=60C', pass: isNaN(cylTemp) || !hwTempFail },
      { label: 'No Dead Legs', pass: !hasDeadLegs },
    ];

    const riskPos = { 'LOW': [2,0], 'MEDIUM': [1,1], 'HIGH': [0,2] }[job.risk || 'LOW'];
    let matrixHtml = '';
    for (let r = 0; r < 3; r++) {
      let cols = '';
      for (let c = 0; c < 3; c++) {
        const isMarked = riskPos[0] === r && riskPos[1] === c;
        const bg = r === 0 ? (c === 2 ? '#c0392b' : '#e67e22') : r === 1 ? (c === 0 ? '#27ae60' : '#e67e22') : '#27ae60';
        cols += `<td style="width:33%;height:36px;background:${bg};border:2px solid #fff;text-align:center;vertical-align:middle;font-size:18px;font-weight:bold;color:#fff">${isMarked ? 'O' : ''}</td>`;
      }
      matrixHtml += `<tr>${cols}</tr>`;
    }

    const tempBars = (job.outlets || []).map(o => {
      const hot = parseFloat(o.hot), cold = parseFloat(o.cold);
      const st = outletStatus(o, job.cqc_mode);
      const color = st.cls === 'ok' ? '#27ae60' : st.cls === 'warn' ? '#e67e22' : '#c0392b';
      const hotWidth = !isNaN(hot) && o.type !== 'Outside Tap' ? Math.min((hot / 70) * 100, 100) : 0;
      const coldWidth = !isNaN(cold) ? Math.min((cold / 70) * 100, 100) : 0;
      const hotLabel = !isNaN(hot) && o.type !== 'Outside Tap' ? `${hot}°C` : '';
      const coldLabel = !isNaN(cold) ? `${cold}°C` : '';
      return `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:bold;margin-bottom:3px">${o.location||''} (${o.type||''})</div><div style="display:flex;align-items:center;gap:6px"><div style="width:${hotWidth}%;max-width:60%;height:18px;background:${color};border-radius:3px;display:inline-block"></div><span style="font-size:10px;font-weight:bold">${hotLabel}</span><div style="width:${coldWidth}%;max-width:20%;height:18px;background:${color};border-radius:3px;display:inline-block"></div><span style="font-size:10px">${coldLabel}</span></div></div>`;
    }).join('');

    const compNotes = [];
    if (!job.log_temps_na && !job.monthly_temp_log) compNotes.push('COMPLIANCE ISSUE — No monthly temperature monitoring records were found.');
    if (!job.log_flush_na && !job.flushing_log) compNotes.push('COMPLIANCE ISSUE — No flushing log was found for infrequently used outlets.');
    if (!job.log_shower_na && !job.shower_cleaning_log && (job.showers||[]).length > 0) compNotes.push('COMPLIANCE ISSUE — No shower head descaling or cleaning records were found.');
    if (!job.log_tmv_na && job.tmvs_installed && !job.tmv_service_records) compNotes.push('COMPLIANCE ISSUE — TMVs are installed but no service or maintenance records were found.');
    if (hwTempFail) compNotes.push(`COMPLIANCE ISSUE — Hot water storage temperature was recorded at ${job.cylinder_temp}°C, which is BELOW the HSG274 requirement of >=60°C.`);
    if (hasDeadLegs) compNotes.push(`${(job.dead_legs||[]).length} dead leg(s) identified. Dead legs allow water to stagnate in the Legionella growth range (20-45°C).`);
    if (job.cqc_mode) compNotes.push('For care and nursing homes, this report supports CQC Regulation 15 and Regulation 12, but does not on its own guarantee CQC compliance.');
    compNotes.push('Providers should ensure all remedial actions are acted upon within stated timescales and that records are maintained.');
    const compNotesBenchmark = `Temperature benchmark: hot water stored at 60°C, hot outlets at least ${targetHot}°C within 1 minute, cold outlets at or below 20°C.`;

    // Buildings page HTML
    const buildingPageHtml = !hasBuildings ? '' : (() => {
      const buildingCards = (job.buildings || []).map(b => {
        const bOutlets = b.outlets || [];
        const bRooms = b.rooms || [];
        const bFail = bOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'fail').length;
        const bWarn = bOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'warn').length;
        const borderCol = bFail > 0 ? '#c0392b' : bWarn > 0 ? '#e67e22' : bOutlets.length > 0 ? '#27ae60' : '#ccc';
        const bgCol = bFail > 0 ? '#fff5f5' : bWarn > 0 ? '#fffbeb' : '#f0fdf4';
        const systemInfo = [
          b.has_boiler ? `🔥 ${b.boiler_count || 1} boiler${b.boiler_set_temp ? ' @ '+b.boiler_set_temp+'°C' : ''}` : null,
          b.has_hw_storage ? `♨️ HW cyl${b.hw_cylinder_temp ? ' '+b.hw_cylinder_temp+'°C' : ''}` : null,
          parseInt(b.cwst_count) > 0 ? `🏗️ ${b.cwst_count} CWST` : null,
          b.has_tmvs ? '🔧 TMVs' : null,
          b.has_outside_tap ? '🌿 Outside tap' : null,
        ].filter(Boolean).join(' &nbsp;&bull;&nbsp; ');
        const outletsByRoom = {};
        bOutlets.forEach(o => {
          const key = o.location || 'General';
          outletsByRoom[key] = outletsByRoom[key] || [];
          outletsByRoom[key].push(o);
        });
        const outletHtml = Object.entries(outletsByRoom).map(([room, outs]) =>
          `<div style="margin-bottom:6px"><div style="font-size:9px;font-weight:bold;color:#555;margin-bottom:3px">${room}</div><div style="display:flex;flex-wrap:wrap;gap:4px">${outs.map(o => {
            const col = statusColor(o);
            const st = outletStatus(o, job.cqc_mode);
            return `<div style="border:2px solid ${col};border-radius:6px;padding:3px 6px;background:#fff;text-align:center;min-width:55px"><div style="font-size:12px">${outletTypeIcon(o.type)}</div><div style="font-size:8px;font-weight:bold">${o.type}</div><div style="font-size:8px;color:${col};font-weight:bold">${st.text.toUpperCase()}</div>${o.hot?`<div style="font-size:7px;color:#555">${o.hot}°C H</div>`:''}</div>`;
          }).join('')}</div></div>`
        ).join('');
        // Building photos
        const bPhotos = (b.photos || []).filter(p => p.file_url);
        const photoHtml = bPhotos.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${bPhotos.map(p => `<div style="text-align:center"><img src="${ci(p.file_url)}" style="width:100px;height:75px;object-fit:cover;border-radius:4px;border:1px solid #ddd"/><div style="font-size:8px;color:#666">${p.kind||''}${p.caption?': '+p.caption:''}</div></div>`).join('')}</div>` : '';
        return `<div style="border:2px solid ${borderCol};background:${bgCol};border-radius:10px;padding:10px;margin-bottom:10px;break-inside:avoid">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
            <div style="font-weight:bold;font-size:12px;color:${borderCol}">${b.name || b.type}</div>
            <div style="font-size:9px;color:#666">${bRooms.length} room${bRooms.length!==1?'s':''} &bull; ${bOutlets.length} outlet${bOutlets.length!==1?'s':''}</div>
          </div>
          ${systemInfo ? `<div style="font-size:9px;color:#555;margin-bottom:6px">${systemInfo}</div>` : ''}
          ${outletHtml || '<div style="font-size:9px;color:#888">No outlets recorded</div>'}
          ${b.notes ? `<div style="font-size:9px;color:#666;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:4px">${b.notes}</div>` : ''}
          ${photoHtml}
        </div>`;
      }).join('');
      return `<div class="page" style="page-break-before:always">
        <div class="page-header"><div class="page-header-brand"><span style="font-size:11px;font-weight:bold">Dorset Plumbing</span></div><div class="ref">Ref: ${job.report_ref||''}</div></div>
        <div class="section-title">🏘️ Buildings Register (${(job.buildings||[]).length} buildings)</div>
        ${buildingCards}
        <div class="footer">Dorset Plumbing — Legionella Risk Assessment | Holiday Park Buildings Register</div>
      </div>`;
    })();

    const CSS = `*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:12mm 15mm 10mm}.page-header{border-bottom:4px solid #d71920;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end}.page-header-brand h1{margin:0;font-size:26px;font-weight:900;color:#111}.page-header-brand p{margin:2px 0 0;font-size:10px;color:#555}.ref{font-size:9px;color:#888;text-align:right}.section-title{background:#1d1d1d !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;color:#fff !important;padding:6px 10px;font-size:11px;font-weight:bold;margin:14px 0 8px;border-left:4px solid #d71920}table{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:4px}th{background:#f5e6e6 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-align:left;padding:5px 6px;border:1px solid #ccc;font-weight:bold}td{padding:4px 6px;border:1px solid #ddd;vertical-align:top}tr:nth-child(even) td{background:#fafafa}.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}.footer{margin-top:20px;padding-top:8px;border-top:2px solid #d71920;font-size:9px;color:#888;text-align:center}@media print{body{margin:0}}`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Legionella Risk Assessment – ${job.site_name||job.client||'Report'}</title><style>${CSS}</style></head><body>
<div class="page">
  <div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered | Legionella Risk Assessment</p><p>Prepared in accordance with HSG274 and ACOP L8</p></div><div class="ref">Ref: ${job.report_ref||(job.site_name||'Report').replace(/\s+/g,'-')+'-'+(job.assessment_date||'')}</div></div>
  ${job.cover_photo_url?`<div style="margin-bottom:14px"><img src="${ci(job.cover_photo_url)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:4px;display:block"/></div>`:''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div style="border:1px solid #ddd;padding:10px;border-radius:4px"><div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:4px">Site Details</div><div style="font-size:15px;font-weight:900">${job.site_name||job.client||'—'}</div><div style="white-space:pre-line;font-size:10px;color:#444;margin-top:2px">${job.address||''}</div><div style="margin-top:6px;font-size:10px">${job.client?`Client: ${job.client}`:''}</div><div style="font-size:10px">${job.assessor?`Assessor: ${job.assessor}`:''}</div><div style="font-size:10px">${job.responsible_person?`Responsible Person: ${job.responsible_person}`:''}</div></div>
    <div style="border:2px solid #d71920;padding:10px;border-radius:4px;background:#fff5f5 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:4px">Overall Risk</div><div style="font-size:36px;font-weight:900;color:${riskBadge==='high'?'#c0392b':riskBadge==='medium'?'#e67e22':'#27ae60'}">${job.risk||'LOW'}</div><div style="font-size:10px;margin-top:4px">Assessment: ${job.assessment_date||'—'}</div><div style="font-size:10px">Next Review: ${job.review_due||'—'}</div><div style="font-size:10px">Property: ${job.property_type||'—'}</div></div>
  </div>
  <div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:6px">Compliance Scorecard</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${checks.map(c=>`<div style="border:1px solid ${c.pass?'#a3d9b1':'#f5c6c6'};background:${c.pass?'#eafaf1':'#fef0f0'} !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-radius:8px;padding:8px 12px;text-align:center;min-width:80px"><div style="font-size:13px;font-weight:900;color:${c.pass?'#27ae60':'#c0392b'}">${c.pass?'PASS':'FAIL'}</div><div style="font-size:9px;color:#444">${c.label}</div></div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div>${job.summary?`<div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:4px">Assessment Summary</div><div style="font-size:10px;line-height:1.6;white-space:pre-line">${job.summary}</div>`:'<div style="font-size:10px;color:#888">No summary entered.</div>'}</div>
    <div><div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:4px">Risk Matrix</div><table style="width:120px;border-collapse:collapse">${matrixHtml}</table><div style="font-size:9px;color:#555;margin-top:2px;text-align:center">Low &nbsp;&nbsp; Med &nbsp;&nbsp; High<br>Likelihood -></div></div>
  </div>
  <div class="footer">Dorset Plumbing — Legionella Risk Assessment | ${job.site_name||job.client||''} — ${job.assessment_date||''} | Page 1</div>
</div>
<div class="page" style="page-break-before:always">
  <div class="page-header"><div class="page-header-brand"><span style="font-size:11px;font-weight:bold">Dorset Plumbing</span></div><div class="ref">Ref: ${job.report_ref||''}</div></div>
  <div class="section-title">System Overview</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:10px">${[['Property Type',job.property_type||'—'],['CWST Present',job.cwst_present?'Yes':'No'],['Building Age',job.building_age||'Not entered'],['Cold Water Supply',job.cold_source||'Mains'],['Hot Water System',job.hot_system||'—'],['HW Storage Temp',job.cylinder_temp?job.cylinder_temp+'°C (target >=60°C)':'—'],['Vulnerable Users',job.vulnerable_users?'Yes':'No'],['TMVs Installed',job.tmvs_installed?'Yes':'No'],['Dead Legs',hasDeadLegs?(job.dead_legs||[]).length+' identified':'None identified'],['Previous Assessment',job.previous_assessment_date||'Not recorded']].map(([k,v])=>`<div style="padding:3px 0;border-bottom:1px solid #f0f0f0">${k}: <strong>${v}</strong></div>`).join('')}</div>
  ${(job.outlets||[]).length>0?`<div class="section-title">Temperature Results</div>${tempBars}<div class="section-title">Outlet Register</div><table><thead><tr><th>Location</th><th>Type</th><th>Hot °C</th><th>Cold °C</th><th>Status</th><th>Notes</th><th>Photo</th></tr></thead><tbody>${outletRows}</tbody></table>`:''}
  <div class="footer">Dorset Plumbing — Legionella Risk Assessment | ${job.site_name||job.client||''} — ${job.assessment_date||''} | Page 2</div>
</div>
<div class="page" style="page-break-before:always">
  <div class="page-header"><div class="page-header-brand"><span style="font-size:11px;font-weight:bold">Dorset Plumbing</span></div><div class="ref">Ref: ${job.report_ref||''}</div></div>
  <div class="section-title">Issues / Findings</div>
  <div style="font-size:10px;line-height:1.6;white-space:pre-line">${job.issues_text||'No issues entered.'}</div>
  ${(job.actions||[]).length>0?`<div class="section-title">Remedial Actions</div><table><thead><tr><th>Ref</th><th>System</th><th>Priority</th><th>Responsible</th><th>Deadline</th><th>Observation</th><th>Action</th><th>Status</th></tr></thead><tbody>${actionRows}</tbody></table>`:'<div style="font-size:10px;color:#888;margin-top:4px">No remedial actions recorded.</div>'}
  ${scheme.length>0?`<div class="section-title">Control Scheme</div><table><thead><tr><th>Task</th><th>Frequency</th><th>Requirement</th><th>Responsible</th><th>Record</th></tr></thead><tbody>${schemeRows}</tbody></table>`:''}
  <div class="footer">Dorset Plumbing — Legionella Risk Assessment | ${job.site_name||job.client||''} — ${job.assessment_date||''} | Page 3</div>
</div>
${hasDeadLegs?`<div class="page" style="page-break-before:always"><div class="page-header"><div class="page-header-brand"><span style="font-size:11px;font-weight:bold">Dorset Plumbing</span></div><div class="ref">Ref: ${job.report_ref||''}</div></div><div class="section-title">Dead Legs / Blind Ends Register</div><p style="font-size:10px">${(job.dead_legs||[]).length} dead leg(s) identified.</p>${deadLegRows}<div class="footer">Dorset Plumbing — Legionella Risk Assessment | Page 4</div></div>`:''}
${(job.showers||[]).length>0?`<div class="page" style="page-break-before:always"><div class="page-header"><div class="page-header-brand"><span style="font-size:11px;font-weight:bold">Dorset Plumbing</span></div><div class="ref">Ref: ${job.report_ref||''}</div></div><div class="section-title">Shower Head Register</div><table><thead><tr><th>Location</th><th>Last Descale</th><th>Condition</th><th>Notes</th><th>Photo</th></tr></thead><tbody>${showerRows}</tbody></table><div class="footer">Dorset Plumbing — Legionella Risk Assessment | Page 5</div></div>`:''}
${buildingPageHtml}
<div class="page" style="page-break-before:always">
  <div class="page-header"><div class="page-header-brand"><span style="font-size:11px;font-weight:bold">Dorset Plumbing</span></div><div class="ref">Ref: ${job.report_ref||''}</div></div>
  <div class="section-title">System Overview &amp; Schematic</div>
  <div style="border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;background:#fafafa">
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:10px">${flowHtml}</div>
    <div style="font-size:10px"><span style="color:#27ae60;font-weight:bold">● ${passCount} Pass</span> &nbsp; <span style="color:#e67e22;font-weight:bold">● ${warnCount} Warning</span> &nbsp; <span style="color:#c0392b;font-weight:bold">● ${failCount} Fail</span> &nbsp;&nbsp; <span style="color:#888">${(job.outlets||[]).length} outlets across ${Object.keys(roomGroups).length} area${Object.keys(roomGroups).length!==1?'s':''}</span></div>
  </div>
  ${roomCardsHtml || '<p style="font-size:10px;color:#888">No outlets recorded.</p>'}
  <div class="section-title">Legal / Compliance Notes</div>
  <p style="font-size:10px">• ${compNotesBenchmark}</p>
  ${compNotes.map(n=>`<p style="font-size:10px;${n.startsWith('COMPLIANCE')?'background:#fff0f0;padding:4px 6px;border-left:3px solid #d71920;':''}margin:4px 0">• ${n}</p>`).join('')}
  <div class="footer">Dorset Plumbing — Legionella Risk Assessment | Page 6</div>
</div>
<div class="page" style="page-break-before:always">
  <div class="page-header"><div class="page-header-brand"><span style="font-size:11px;font-weight:bold">Dorset Plumbing</span></div><div class="ref">Ref: ${job.report_ref||''}</div></div>
  <div class="section-title">Site Logbook</div>
  ${(job.logs||[]).length>0?`<table><thead><tr><th>Date</th><th>Category</th><th>Location</th><th>Detail</th><th>Completed by</th><th>Status</th></tr></thead><tbody>${logRows}</tbody></table>`:'<p style="font-size:10px;color:#888">No log entries.</p>'}
  ${allPhotos.length>0?`<div class="section-title">Photo Evidence</div><div class="photo-grid">${photoGrid}</div>`:''}
  <div class="footer">Dorset Plumbing — Legionella Risk Assessment | Page 7</div>
</div>
</body></html>`;
  };

  const handlePrint = async () => {
    const allUrls = [
      job.cover_photo_url,
      ...(job.outlets || []).map(o => o.photo_url),
      ...(job.dead_legs || []).map(d => d.photo_url),
      ...(job.showers || []).map(s => s.photo_url),
      ...(job.photos || []).map(p => p.file_url),
      ...(job.buildings || []).flatMap(b => [
        ...((b.photos || []).map(p => p.file_url)),
        ...((b.outlets || []).map(o => o.photo_url)),
      ]),
    ].filter(Boolean);

    const compressed = {};
    await Promise.all(allUrls.map(async (url) => {
      compressed[url] = await compressImage(url, 900, 0.55);
    }));

    const ci = (url) => compressed[url] || url;
    const html = buildReportHtml(ci);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        setTimeout(() => { win.focus(); win.print(); URL.revokeObjectURL(url); }, 500);
      });
    } else {
      window.location.href = url;
    }
  };

  handlePrintRef.current = handlePrint;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <strong>Report preview</strong>
        <button onClick={handlePrint} className="text-sm px-4 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
          Export PDF / Print
        </button>
      </div>

      <div ref={printRef} className="text-sm space-y-3">
        <div className="rounded-xl p-5 text-white" style={{ background: 'linear-gradient(180deg,#111 0%,#1d1d1d 100%)', borderBottom: '6px solid #d71920' }}>
          <div className="text-xs text-gray-400 mb-1">Legionella Risk Assessment Report</div>
          <h1 className="text-2xl font-bold" style={{ color: '#d71920' }}>{job.site_name || job.client || 'Untitled Site'}</h1>
          <div className="text-gray-300 text-xs mt-1">{job.address}</div>
          {job.cover_photo_url && <img src={job.cover_photo_url} alt="Cover" className="w-full rounded-xl mt-3" style={{height:'280px',objectFit:'cover',objectPosition:'center'}} />}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold badge-${riskBadge}`}>Risk: {job.risk || 'LOW'}</span>
            {job.cqc_mode && <span className="px-2 py-0.5 rounded-full text-xs font-bold badge-high">CQC Mode</span>}
            {(job.buildings||[]).length > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">🏘️ {job.buildings.length} buildings</span>}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-3 text-xs text-gray-300">
            <div>Assessment: <strong className="text-white">{job.assessment_date || '—'}</strong></div>
            <div>Review due: <strong className="text-white">{job.review_due || '—'}</strong></div>
            <div>Assessor: <strong className="text-white">{job.assessor || '—'}</strong></div>
            <div>Ref: <strong className="text-white">{job.report_ref || '—'}</strong></div>
          </div>
        </div>

        {job.summary && <><hr /><div><strong>Executive summary</strong></div><div className="text-xs text-gray-700 whitespace-pre-line">{job.summary}</div></>}
        {job.issues_text && <><hr /><div><strong>Issues / findings</strong></div><div className="text-xs text-gray-700 whitespace-pre-line">{job.issues_text}</div></>}

        {/* Buildings preview */}
        {(job.buildings||[]).length > 0 && (
          <>
            <hr />
            <div><strong>🏘️ Buildings ({job.buildings.length})</strong></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {(job.buildings||[]).map(b => {
                const bOutlets = b.outlets || [];
                const bFail = bOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'fail').length;
                const bWarn = bOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'warn').length;
                const borderCls = bFail > 0 ? 'border-red-400' : bWarn > 0 ? 'border-yellow-400' : 'border-green-300';
                return (
                  <div key={b.id} className={`border-2 ${borderCls} rounded-xl p-2 text-xs`}>
                    <div className="font-bold">{b.name || b.type}</div>
                    <div className="text-gray-500">{(b.rooms||[]).length} rooms · {bOutlets.length} outlets</div>
                    {bFail > 0 && <div className="text-red-600 font-bold">⚠ {bFail} fail</div>}
                    {bWarn > 0 && <div className="text-yellow-700">⚠ {bWarn} warning</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}

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
            <div><strong>Outlets ({(job.outlets || []).length})</strong></div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs mt-1">
                <thead><tr className="bg-red-50">{['Location','Type','Hot °C','Cold °C','Status','Notes','Photo'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>{(job.outlets || []).map(o => {
                  const st = outletStatus(o, job.cqc_mode);
                  return <tr key={o.id}>
                    <td className="border border-gray-200 p-1.5">{o.location}</td>
                    <td className="border border-gray-200 p-1.5">{o.type}</td>
                    <td className="border border-gray-200 p-1.5">{o.hot}</td>
                    <td className="border border-gray-200 p-1.5">{o.cold}</td>
                    <td className="border border-gray-200 p-1.5"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold badge-${st.cls}`}>{st.text}</span></td>
                    <td className="border border-gray-200 p-1.5">{o.notes}</td>
                    <td className="border border-gray-200 p-1.5">{o.photo_url ? <img src={o.photo_url} alt="" className="w-16 h-12 object-cover rounded" /> : '—'}</td>
                  </tr>;
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
      </div>
    </div>
  );
}