import React, { useRef, useEffect } from 'react';

async function compressImage(url, maxWidth = 500, quality = 0.3) {
  if (!url) return url;
  try {
    // data URLs don't need fetching — use them directly
    const isDataUrl = url.startsWith('data:');
    let objectUrl = null;
    if (!isDataUrl) {
      const resp = await fetch(url, { mode: 'cors' });
      const blob = await resp.blob();
      objectUrl = URL.createObjectURL(blob);
    }
    const src = objectUrl || url;
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
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      };
      img.onerror = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); resolve(url); };
      img.src = src;
    });
  } catch {
    return url;
  }
}
import { buildControlScheme, outletStatus } from '@/lib/jobUtils';

const isDomesticJob = (job) => (job.property_type || '').toLowerCase() === 'domestic';

// Flatten all outlets: top-level + building outlets (with building name prefix)
function getAllOutlets(job) {
  const topLevel = (job.outlets || []).map(o => ({ ...o, displayLocation: o.location || '' }));
  const buildingOuts = (job.buildings || []).flatMap(b =>
    (b.outlets || []).map(o => ({ ...o, displayLocation: `${b.name || b.type} — ${o.location || ''}`.trim().replace(/\s*—\s*$/, '') }))
  );
  return [...topLevel, ...buildingOuts];
}

function buildSchematic(job) {
  const groups = {};
  (job.outlets || []).forEach(o => {
    const key = o.location || 'Area';
    const { cls } = outletStatus(o, job.cqc_mode, isDomesticJob(job));
    groups[key] = groups[key] || { count: 0, issue: false, types: new Set() };
    groups[key].count++;
    groups[key].types.add(o.type || 'Outlet');
    if (cls !== 'ok') groups[key].issue = true;
  });
  return Object.entries(groups).map(([name, info]) => ({ name, count: info.count, issue: info.issue, types: [...info.types].join(', ') }));
}

export default function ReportTab({ job, onPrint, onChange }) {
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

  // Auto-correct common typos in text fields before rendering
  const fixTypos = (str) => {
    if (!str) return str;
    return str
      .replace(/\bPant Room\b/g, 'Plant Room')
      .replace(/\bpant room\b/g, 'plant room')
      .replace(/\bMangement\b/g, 'Management')
      .replace(/\bmangement\b/g, 'management');
  };

  const reportRef = job.report_ref || (job.site_name || 'Report').replace(/\s+/g, '-') + '-' + (job.assessment_date || '');

  const buildReportHtml = (ci = (u) => u) => {
    const allOutlets = getAllOutlets(job);
    const roomGroups = {};
    allOutlets.forEach(o => {
      const key = o.displayLocation || 'Unspecified';
      if (!roomGroups[key]) roomGroups[key] = [];
      roomGroups[key].push(o);
    });

    const outletTypeIcon = (type) => {
      const map = { 'WHB': '🚿', 'Shower': '🚿', 'Bath': '🛁', 'Kitchen Sink': '🍽️', 'Cleaner Sink': '🪣', 'Outside Tap': '🌿', 'Pot Wash': '🍽️', 'TMV': '🔧' };
      return map[type] || '💧';
    };

    const statusColor = (o) => {
      const st = outletStatus(o, job.cqc_mode, isDomesticJob(job));
      return st.cls === 'ok' ? '#27ae60' : st.cls === 'warn' ? '#e67e22' : '#c0392b';
    };

    const flowNodes = [
      { label: 'Cold Mains', sub: job.cold_source || 'Mains' },
      job.cwst_present ? { label: 'CWST', sub: job.cwst_location || 'Storage tank' } : null,
      job.hw_not_stored ? null : { label: 'HW Cylinder', sub: job.cylinder_temp ? job.cylinder_temp + '°C' : 'Storage' },
      job.tmvs_installed ? { label: 'TMVs', sub: 'Blended outlets' } : null,
      { label: 'Outlets', sub: `${(job.outlets||[]).length} total` },
    ].filter(Boolean);

    const flowHtml = flowNodes.map((n, i) =>
      `<div style="display:inline-flex;align-items:center;gap:8px">
        <div style="background:#1d1d1d;color:#fff;border-left:4px solid #d71920;border-radius:6px;padding:8px 12px;text-align:center;min-width:90px;font-size:10px;font-weight:bold;display:inline-block">
          ${n.label}<span style="color:#aaa;font-size:9px;font-weight:normal;display:block;margin-top:2px">${n.sub}</span>
        </div>
        ${i < flowNodes.length - 1 ? '<span style="font-size:14px;color:#999;font-weight:bold">&#8594;</span>' : ''}
      </div>`
    ).join('');

    const passCount = allOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'ok').length;
    const warnCount = allOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'warn').length;
    const failCount = allOutlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'fail').length;

    const roomCardsHtml = Object.entries(roomGroups).map(([room, outlets]) => {
      const roomFail = outlets.some(o => outletStatus(o, job.cqc_mode).cls === 'fail');
      const roomWarn = outlets.some(o => outletStatus(o, job.cqc_mode).cls === 'warn');
      const borderCol = roomFail ? '#c0392b' : roomWarn ? '#e67e22' : '#27ae60';
      const chips = outlets.map(o => {
        const st = outletStatus(o, job.cqc_mode, isDomesticJob(job));
        const col = statusColor(o);
        return `<div style="background:#1d1d1d;color:#fff;border-left:3px solid ${col};border-radius:6px;padding:6px 10px;text-align:center;min-width:80px;font-size:10px">
          <div style="font-weight:bold;margin-bottom:2px">${o.type||'Outlet'}</div>
          <div style="font-size:9px;font-weight:bold;color:${col}">${st.text.toUpperCase()}</div>
          ${o.hot ? `<div style="font-size:8px;color:#aaa">${o.hot}°C H</div>` : ''}
          ${o.cold ? `<div style="font-size:8px;color:#aaa">${o.cold}°C C</div>` : ''}
        </div>`;
      }).join('');
      return `<div style="border:1px solid #333;background:#1a1a1a;border-left:4px solid ${borderCol};border-radius:8px;padding:10px;margin-bottom:8px;break-inside:avoid">
        <div style="font-weight:bold;font-size:10px;margin-bottom:6px;color:${borderCol}">● ${room} &nbsp;<span style="font-weight:normal;color:#888;font-size:9px">${outlets.length} outlet${outlets.length!==1?'s':''}</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${chips}</div>
      </div>`;
    }).join('');

    const outletRows = allOutlets.map(o => {
      const st = outletStatus(o, job.cqc_mode, isDomesticJob(job));
      const badgeColor = st.cls === 'ok' ? '#dcfce7;color:#166534' : st.cls === 'warn' ? '#fef3c7;color:#92400e' : '#fee2e2;color:#991b1b';
      const isOutsideTap = o.type === 'Outside Tap';
      const hotCell = isOutsideTap ? '<em style="color:#888">cold only</em>' : (o.hot || '—');
      const extraNote = isOutsideTap ? (o.check_valve ? 'Check valve: ✓' : 'Check valve: not recorded') : (o.infrequent ? 'Infrequent use' : '');
      const noteText = [o.notes, extraNote].filter(Boolean).join(' | ');
      return `<tr><td>${o.displayLocation||''}</td><td>${o.type||''}</td><td>${hotCell}</td><td>${o.cold||'—'}</td><td><span style="background:${badgeColor};padding:2px 7px;border-radius:99px;font-weight:bold;font-size:10px">${st.text}</span></td><td>${noteText||'—'}</td></tr>`;
    }).join('');

    const actionRows = (job.actions || []).map(a => {
      const pColor = a.priority === '1' ? '#fee2e2;color:#991b1b' : a.priority === '2' ? '#fef3c7;color:#92400e' : '#f5f5f5;color:#333';
      return `<tr><td>${a.ref||''}</td><td>${fixTypos(a.system)||''}</td><td><span style="background:${pColor};padding:2px 6px;border-radius:4px;font-weight:bold">${a.priority||''}</span></td><td>${a.responsible_person||''}</td><td>${a.deadline||''}</td><td>${fixTypos(a.observation)||''}</td><td>${fixTypos(a.action)||''}</td><td>${a.status||''}</td></tr>`;
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
      { label: 'HW Temp >=60°C', pass: isNaN(cylTemp) || !hwTempFail },
      { label: `Hot Outlets >=${targetHot}°C`, pass: allOutlets.filter(o => o.type !== 'Outside Tap' && !o.hasTmv).every(o => isNaN(parseFloat(o.hot)) || parseFloat(o.hot) >= targetHot) },
      { label: 'Cold Outlets <=20°C', pass: allOutlets.every(o => isNaN(parseFloat(o.cold)) || parseFloat(o.cold) <= 20) },
      { label: 'No Dead Legs', pass: !hasDeadLegs },
    ];

    // Priority actions: priority 1 (high) or overdue (deadline < today and not complete)
    const today = new Date().toISOString().slice(0, 10);
    const priorityActions = (job.actions || []).filter(a =>
      a.status !== 'Complete' && a.status !== 'Closed' &&
      (a.priority === '1' || (a.deadline && a.deadline < today))
    );



    const riskPos = { 'LOW': [2,0], 'MEDIUM': [1,1], 'HIGH': [0,2] }[job.risk || 'LOW'];
    let matrixHtml = '';
    for (let r = 0; r < 3; r++) {
      let cols = '';
      for (let c = 0; c < 3; c++) {
        const isMarked = riskPos[0] === r && riskPos[1] === c;
        const bg = r === 0 ? (c === 2 ? '#c0392b' : '#e67e22') : r === 1 ? (c === 0 ? '#27ae60' : '#e67e22') : '#27ae60';
        cols += `<td style="width:33%;height:52px;background:${bg};border:3px solid #fff;text-align:center;vertical-align:middle;font-size:22px;font-weight:900;color:#fff">${isMarked ? '●' : ''}</td>`;
      }
      matrixHtml += `<tr>${cols}</tr>`;
    }

    const tempBars = allOutlets.map(o => {
      const hot = parseFloat(o.hot), cold = parseFloat(o.cold);
      const st = outletStatus(o, job.cqc_mode, isDomesticJob(job));
      const color = st.cls === 'ok' ? '#27ae60' : st.cls === 'warn' ? '#e67e22' : '#c0392b';
      const hotWidth = !isNaN(hot) && o.type !== 'Outside Tap' ? Math.min((hot / 70) * 100, 100) : 0;
      const coldWidth = !isNaN(cold) ? Math.min((cold / 70) * 100, 100) : 0;
      const hotLabel = !isNaN(hot) && o.type !== 'Outside Tap' ? `${hot}°C` : '';
      const coldLabel = !isNaN(cold) ? `${cold}°C` : '';
      return `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:bold;margin-bottom:3px">${o.displayLocation||''} (${o.type||''})</div><div style="display:flex;align-items:center;gap:6px"><div style="width:${hotWidth}%;max-width:60%;height:18px;background:${color};border-radius:3px;display:inline-block"></div><span style="font-size:10px;font-weight:bold">${hotLabel}</span><div style="width:${coldWidth}%;max-width:20%;height:18px;background:${color};border-radius:3px;display:inline-block"></div><span style="font-size:10px">${coldLabel}</span></div></div>`;
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
            const st = outletStatus(o, job.cqc_mode, isDomesticJob(job));
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
        <div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef}</div></div>
        <div class="page-body">
        <div class="section-title">🏘️ Buildings Register (${(job.buildings||[]).length} buildings)</div>
        ${buildingCards}
        </div>
        <div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${job.site_name||job.client||''} · ${job.assessment_date||''}</span><span>Buildings Register</span></div>
      </div>`;
    })();

    const CSS = `*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:0 0 10mm}.page-header{background:#1a1a1a !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:10px 15mm 10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}.page-header-brand h1{margin:0;font-size:22px;font-weight:900;color:#fff}.page-header-brand p{margin:2px 0 0;font-size:9px;color:#c0392b;font-weight:600}.ref{font-size:9px;color:#aaa;text-align:right}.page-body{padding:0 15mm}.section-title{background:#1d1d1d !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;color:#fff !important;padding:6px 10px;font-size:11px;font-weight:bold;margin:14px 0 8px;border-left:4px solid #d71920}table{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:4px}th{background:#f5e6e6 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-align:left;padding:5px 6px;border:1px solid #ccc;font-weight:bold}td{padding:4px 6px;border:1px solid #ddd;vertical-align:top}tr:nth-child(even) td{background:#fafafa}.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}.footer{margin-top:20px;background:#f0f0f0 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:6px 15mm;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#666}.legal-box{background:#f8f8f8 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1px solid #ddd;border-radius:6px;padding:10px 12px;margin-bottom:10px;font-size:9.5px;line-height:1.6}.legal-box h3{margin:0 0 5px;font-size:10.5px;color:#111;border-bottom:1px solid #ddd;padding-bottom:4px}.sig-box{border:1px solid #999;border-radius:4px;padding:10px 12px;margin-bottom:8px;background:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sig-line{border-bottom:1px solid #333;height:28px;margin:6px 0 2px}.sig-label{font-size:8.5px;color:#666}@media print{body{margin:0}}`;

    const riskBgColor = riskBadge==='high'?'#c0392b':riskBadge==='medium'?'#e67e22':'#1a6e1a';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Legionella Risk Assessment – ${job.site_name||job.client||'Report'}</title><style>${CSS}</style></head><body>
<div class="page">
  <div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef}</div></div>
  ${job.cover_photo_url?`<div style="margin:0;padding:0;width:100%"><img src="${ci(job.cover_photo_url)}" style="width:100%;max-height:260px;object-fit:cover;display:block"/></div>`:''}
  <div class="page-body">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div style="border:1px solid #ddd;padding:10px;border-radius:4px"><div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:4px">Site Details</div><div style="font-size:15px;font-weight:900">${job.site_name||job.client||'—'}</div><div style="white-space:pre-line;font-size:10px;color:#444;margin-top:2px">${job.address||''}</div><div style="margin-top:6px;font-size:10px">${job.client?`Client: ${job.client}`:''}</div><div style="font-size:10px">${job.assessor?`Assessor: ${job.assessor}`:''}</div><div style="font-size:10px">${job.responsible_person?`Responsible Person: ${job.responsible_person}`:''}</div></div>
    <div style="border-radius:4px;overflow:hidden;background:${riskBgColor} !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:12px 14px;color:#fff"><div style="font-size:9px;font-weight:bold;text-transform:uppercase;opacity:0.85;margin-bottom:2px">Overall Risk Rating</div><div style="font-size:44px;font-weight:900;letter-spacing:2px;line-height:1">${job.risk||'LOW'}</div><div style="font-size:10px;margin-top:8px;opacity:0.9">Assessment: ${job.assessment_date||'—'}</div><div style="font-size:10px;opacity:0.9">Next Review: ${job.review_due||'—'}</div><div style="font-size:10px;opacity:0.9">Property: ${job.property_type||'—'}</div></div>
  </div>
  <div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:6px">Compliance Scorecard</div>
  <div style="display:flex;gap:6px;flex-wrap:nowrap;margin-bottom:14px">${checks.map(c=>`<div style="background:${c.pass?'#eafaf1':'#fdecea'} !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-radius:8px;padding:6px 8px;text-align:center;min-width:70px;max-width:70px"><div style="font-size:16px;font-weight:900;color:${c.pass?'#1a6e1a':'#c0392b'}">${c.pass?'✓':'✗'}</div><div style="font-size:8px;font-weight:900;color:${c.pass?'#1a6e1a':'#c0392b'};margin:2px 0">${c.pass?'PASS':'FAIL'}</div><div style="font-size:7.5px;color:#444">${c.label}</div></div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div>${job.summary?`<div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:4px">Assessment Summary</div><div style="font-size:10px;line-height:1.7">${fixTypos(job.summary)}</div>`:'<div style="font-size:10px;color:#c0392b;font-weight:bold;background:#fff0f0;padding:6px 8px;border-left:3px solid #d71920;border-radius:4px">⚠ No summary entered — add one in the Overview tab before sending to client.</div>'}</div>
    <div><div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:4px">Risk Matrix</div><div style="display:flex;align-items:center;gap:4px"><div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:8px;color:#555;white-space:nowrap;margin-right:2px">&#8593; Severity</div><table style="width:165px;border-collapse:collapse">${matrixHtml}</table></div><div style="font-size:8.5px;color:#555;margin-top:3px;width:180px;padding-left:18px">Low &nbsp;&middot;&nbsp; Med &nbsp;&middot;&nbsp; High &#8594;<br><span style="color:#888">Likelihood</span></div></div>
  </div>
  </div>
  <div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${job.site_name||job.client||''} · ${job.assessment_date||''}</span><span>Page 1</span></div>
</div>
<div class="page" style="page-break-before:always">
  <div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef}</div></div>
  <div class="page-body">
  <div class="section-title">System Overview</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:10px">${[['Property Type',job.property_type||'—'],['CWST Present',job.cwst_present?'Yes':'No'],['Building Age',job.building_age||'Not entered'],['Cold Water Supply',job.cold_source||'Mains'],['Hot Water System',job.hot_system||'—'],['HW Storage Temp',job.cylinder_temp?job.cylinder_temp+'°C (target >=60°C)':'—'],['Vulnerable Users',job.vulnerable_users?'Yes':'No'],['TMVs Installed',job.tmvs_installed?'Yes':'No'],['Dead Legs',hasDeadLegs?(job.dead_legs||[]).length+' identified':'None identified'],['Previous Assessment',job.previous_assessment_date||'Not recorded']].map(([k,v])=>`<div style="padding:3px 0;border-bottom:1px solid #f0f0f0">${k}: <strong>${v}</strong></div>`).join('')}</div>
  ${allOutlets.length>0?`<div class="section-title">Outlet Temperature Register (${allOutlets.length} outlets)</div><table style="margin-top:10px"><thead><tr><th>Location</th><th>Type</th><th>Hot °C</th><th>Cold °C</th><th>Status</th><th>Notes</th></tr></thead><tbody>${outletRows}</tbody></table>`:''}
  </div>
  <div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${job.site_name||job.client||''} · ${job.assessment_date||''}</span><span>Page 2</span></div>
</div>
<div class="page" style="page-break-before:always">
  <div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef}</div></div>
  <div class="page-body">
  <div class="section-title">Issues / Findings</div>
  ${job.issues_text ? `<div style="font-size:10px;line-height:1.6;white-space:pre-line">${fixTypos(job.issues_text)}</div>` : `<div style="font-size:10px;color:#555">No specific issues were identified during this assessment.</div>`}
  ${(job.actions||[]).length>0?`<div class="section-title">Remedial Actions</div><table><thead><tr><th>Ref</th><th>System</th><th>Priority</th><th>Responsible</th><th>Deadline</th><th>Observation</th><th>Action</th><th>Status</th></tr></thead><tbody>${actionRows}</tbody></table>`:'<div style="font-size:10px;color:#888;margin-top:4px">No remedial actions recorded.</div>'}
  ${scheme.length>0?`<div class="section-title">Control Scheme</div><table><thead><tr><th>Task</th><th>Frequency</th><th>Requirement</th><th>Responsible</th><th>Record</th></tr></thead><tbody>${schemeRows}</tbody></table>`:''}
  </div>
  <div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${job.site_name||job.client||''} · ${job.assessment_date||''}</span><span>Page 3</span></div>
</div>
${hasDeadLegs?`<div class="page" style="page-break-before:always"><div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef}</div></div><div class="page-body"><div class="section-title">Dead Legs / Blind Ends Register</div><p style="font-size:10px">${(job.dead_legs||[]).length} dead leg(s) identified.</p>${deadLegRows}</div><div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${job.site_name||job.client||''} · ${job.assessment_date||''}</span><span>Page 4</span></div></div>`:''}
${(job.showers||[]).length>0?`<div class="page" style="page-break-before:always"><div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef}</div></div><div class="page-body"><div class="section-title">Shower Head Register</div><table><thead><tr><th>Location</th><th>Last Descale</th><th>Condition</th><th>Notes</th><th>Photo</th></tr></thead><tbody>${showerRows}</tbody></table></div><div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${job.site_name||job.client||''} · ${job.assessment_date||''}</span><span>Page 5</span></div></div>`:''}
${buildingPageHtml}
<div class="page" style="page-break-before:always">
  <div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef}</div></div>
  <div class="page-body">
  <div class="section-title">System Overview &amp; Schematic</div>
  <div style="border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;background:#fafafa">
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:10px">${flowHtml}</div>
    <div style="font-size:10px"><span style="color:#27ae60;font-weight:bold">● ${passCount} Pass</span> &nbsp; <span style="color:#e67e22;font-weight:bold">● ${warnCount} Warning</span> &nbsp; <span style="color:#c0392b;font-weight:bold">● ${failCount} Fail</span> &nbsp;&nbsp; <span style="color:#888">${allOutlets.length} outlets across ${Object.keys(roomGroups).length} area${Object.keys(roomGroups).length!==1?'s':''}</span></div>
  </div>
  <div class="section-title">Legal / Compliance Notes</div>
  <p style="font-size:10px">• ${compNotesBenchmark}</p>
  ${compNotes.map(n=>`<p style="font-size:10px;${n.startsWith('COMPLIANCE')?'background:#fff0f0;padding:4px 6px;border-left:3px solid #d71920;':''}margin:4px 0">• ${n}</p>`).join('')}
  ${(() => {
    if (!job.water_samples_taken) {
      return `<div class="section-title">Microbiological Water Sampling</div><p style="font-size:10px;color:#555">No microbiological samples were taken during this assessment. Sampling may be recommended where temperature non-compliance or elevated risk is identified.</p>`;
    }
    const resColor = job.water_samples_results === 'Satisfactory' ? '#27ae60' : job.water_samples_results === 'Pending' ? '#e67e22' : '#c0392b';
    const resBg = job.water_samples_results === 'Satisfactory' ? '#f0fdf4' : job.water_samples_results === 'Pending' ? '#fffbeb' : '#fff5f5';
    return `<div class="section-title">Microbiological Water Sampling</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:10px;margin-bottom:8px">
      <div style="padding:4px 0;border-bottom:1px solid #f0f0f0">Samples Taken: <strong>Yes</strong></div>
      <div style="padding:4px 0;border-bottom:1px solid #f0f0f0">Date Taken: <strong>${job.water_samples_date || '—'}</strong></div>
      <div style="padding:4px 0;border-bottom:1px solid #f0f0f0">Laboratory: <strong>${job.water_samples_lab || '—'}</strong></div>
      <div style="padding:4px 0;border-bottom:1px solid #f0f0f0">Results: <strong style="color:${resColor}">${job.water_samples_results || 'Pending'}</strong></div>
      <div style="padding:4px 0;border-bottom:1px solid #f0f0f0">Client Advised: <strong>${job.water_samples_advised ? 'Yes' : 'Not yet recorded'}</strong></div>
      <div style="padding:4px 0;border-bottom:1px solid #f0f0f0">Date Advised: <strong>${job.water_samples_advised_date || '—'}</strong></div>
      <div style="padding:4px 0;border-bottom:1px solid #f0f0f0">Method: <strong>${job.water_samples_advised_method || '—'}</strong></div>
    </div>
    ${(job.water_samples_results === 'Unsatisfactory' || job.water_samples_results === 'Action Required') ? `<div style="background:#fff0f0 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-left:3px solid #d71920;padding:6px 8px;font-size:10px;font-weight:bold;color:#991b1b;margin-bottom:6px">⚠ ${job.water_samples_results === 'Action Required' ? 'ACTION REQUIRED' : 'UNSATISFACTORY RESULTS'} — The duty holder has ${job.water_samples_advised ? 'been advised' : 'NOT YET been advised'} of these results. Immediate corrective action is required in accordance with HSG274 and ACOP L8.</div>` : ''}
    ${!job.water_samples_advised && job.water_samples_taken ? `<div style="background:#fffbeb !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-left:3px solid #e67e22;padding:6px 8px;font-size:10px;color:#92400e;margin-bottom:6px">ℹ Duty holder notification of sampling results has not yet been recorded. Ensure this is completed and documented.</div>` : ''}
    ${job.water_samples_notes ? `<div style="font-size:10px;margin-top:4px"><strong>Notes:</strong> ${job.water_samples_notes}</div>` : ''}`;
  })()}
  </div>
  <div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${job.site_name||job.client||''} · ${job.assessment_date||''}</span><span>Page 6</span></div>
</div>
<div class="page" style="page-break-before:always">
  <div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef}</div></div>
  <div class="page-body">
  <div class="section-title">Site Logbook</div>
  ${(job.logs||[]).length>0?`<table><thead><tr><th>Date</th><th>Category</th><th>Location</th><th>Detail</th><th>Completed by</th><th>Status</th></tr></thead><tbody>${logRows}</tbody></table>`:'<p style="font-size:10px;color:#888">No log entries.</p>'}
  ${allPhotos.length>0?`<div class="section-title">Photo Evidence</div><div class="photo-grid">${photoGrid}</div>`:''}
  </div>
  <div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${job.site_name||job.client||''} · ${job.assessment_date||''}</span><span>Page 7</span></div>
</div>
<div class="page" style="page-break-before:always">
  <div class="page-header"><div class="page-header-brand"><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef}</div></div>
  <div class="page-body">
  <div class="section-title">Assessor Declaration &amp; Terms of Assessment</div>

  <div class="legal-box">
    <h3>1. Legislative &amp; Regulatory Framework</h3>
    <p>This Legionella Risk Assessment has been prepared in accordance with the following legislation, approved codes of practice and guidance documents:</p>
    <ul style="margin:4px 0 0 14px;padding:0">
      <li><strong>Health and Safety at Work etc. Act 1974</strong> — general duty of care</li>
      <li><strong>Control of Substances Hazardous to Health Regulations 2002 (COSHH)</strong> — risk assessment and control of biological agents including <em>Legionella</em> spp.</li>
      <li><strong>Management of Health and Safety at Work Regulations 1999</strong> — suitable and sufficient risk assessment obligation</li>
      <li><strong>The Approved Code of Practice &amp; Guidance: L8 (Fourth Edition)</strong> — Legionella: Control of Legionella bacteria in water systems</li>
      <li><strong>HSG274 Parts 1, 2 &amp; 3</strong> — Technical guidance on the control of Legionella bacteria in water systems</li>
      <li><strong>BS 8580-1:2019</strong> — Water quality: Risk assessments for Legionella control</li>
      ${job.cqc_mode ? '<li><strong>CQC Regulation 12</strong> (Safe Care and Treatment) &amp; <strong>Regulation 15</strong> (Premises and Equipment) — applicable to registered care and nursing homes</li>' : ''}
      ${job.property_type === 'Dental Surgery' ? '<li><strong>HTM 01-05</strong> — Decontamination in primary care dental practices; <strong>HTM 04-01</strong> — Safe water in healthcare premises</li>' : ''}
    </ul>
  </div>

  <div class="legal-box">
    <h3>2. Scope and Limitations of Assessment</h3>
    <p>This risk assessment represents the findings of a visual, non-intrusive survey conducted on the date(s) stated. The assessment is based on conditions observed and information provided at the time of inspection. The following limitations apply:</p>
    <ul style="margin:4px 0 0 14px;padding:0">
      <li>This assessment is a <strong>point-in-time snapshot</strong>. Conditions may change and the assessment does not guarantee the absence of Legionella bacteria in the water system.</li>
      <li>The assessor has not conducted microbiological sampling unless explicitly stated within this report. Where sampling has not been undertaken, microbiological risk cannot be quantified.</li>
      <li>Areas that were inaccessible, locked, or not made available for inspection have not been assessed. Any such areas are not included within the scope of this report.</li>
      <li>The assessment covers the cold water, hot water, and associated systems only. Dental unit waterlines (DUWL), fire suppression systems, pools, and spa systems require separate specialist assessment unless explicitly included above.</li>
      <li>Temperature readings were taken at the outlet after a maximum of one minute of running. System temperatures may vary under operational conditions.</li>
      <li>This document does not constitute a Written Scheme of Control (unless explicitly titled as such). A separate documented Written Scheme must be prepared and maintained by the duty holder in accordance with ACOP L8 §2.105–2.107.</li>
    </ul>
  </div>

  <div class="legal-box">
    <h3>3. Responsibilities of the Duty Holder / Client</h3>
    <p>Upon receipt of this report, the duty holder (or their authorised representative) must:</p>
    <ul style="margin:4px 0 0 14px;padding:0">
      <li>Review all findings and remedial actions and take prompt, appropriate action within the timescales stated.</li>
      <li>Ensure a suitable <strong>Written Scheme of Control</strong> is in place, implemented, and reviewed at the frequency recommended.</li>
      <li>Appoint a competent <strong>Responsible Person</strong> with sufficient authority, knowledge, skills, and experience to oversee Legionella control, in accordance with ACOP L8 §2.8.</li>
      <li>Ensure all control measures (temperature monitoring, flushing, shower cleaning, TMV servicing) are carried out at the specified frequencies and records maintained.</li>
      <li>Notify Dorset Plumbing of any significant change to the water systems, occupancy, or site use that may affect the validity of this assessment.</li>
      <li>Ensure this assessment is reviewed at least every <strong>${job.reassessment_interval === '12' ? '12 months' : '2 years'}</strong>, or sooner if: a case of Legionnaires' disease is associated with the premises; there is reason to believe the assessment is no longer valid; or there has been a significant change to the water systems or their use.</li>
    </ul>
    <p style="margin-top:6px"><strong>Failure to implement the recommendations in this report may constitute a breach of the duty holder's legal obligations under COSHH Regulation 6 and ACOP L8.</strong></p>
  </div>

  <div class="legal-box">
    <h3>4. Limitation of Liability</h3>
    <p>Dorset Plumbing has prepared this report with reasonable skill and care in accordance with current industry standards and guidance. Our liability is limited as follows:</p>
    <ul style="margin:4px 0 0 14px;padding:0">
      <li>This report is prepared solely for the use of the named client and site identified above. It must not be relied upon by any third party without the prior written consent of Dorset Plumbing.</li>
      <li>Dorset Plumbing accepts no liability for losses arising from the client's failure to implement the recommendations contained in this report within the stated timescales.</li>
      <li>Dorset Plumbing accepts no liability for conditions that could not reasonably have been identified during a visual, non-intrusive survey, including but not limited to: concealed pipework, inaccessible tanks, and buried services.</li>
      <li>Our maximum aggregate liability in connection with this report, whether arising in contract, tort, or otherwise, shall not exceed the fee paid for the preparation of this assessment.</li>
      <li>Nothing in these terms shall exclude or limit liability for death or personal injury caused by negligence, or for fraud or fraudulent misrepresentation.</li>
    </ul>
  </div>

  <div class="section-title">Assessor Declaration</div>
  <p style="font-size:10px;margin-bottom:10px">This risk assessment has been conducted with reasonable skill and care. The findings represent an accurate record of the conditions observed at the time of the survey, and the recommendations made are consistent with current legislative requirements and recognised industry guidance. This report is issued electronically and does not require a wet signature.</p>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
    ${job.assessor ? `<div class="sig-box"><div style="font-size:9px;font-weight:bold;color:#888;margin-bottom:4px">ASSESSOR</div><div style="font-size:11px;font-weight:bold;color:#111">${job.assessor}</div><div style="font-size:9px;color:#666;margin-top:2px">Assessment date: ${job.assessment_date || '—'}</div></div>` : ''}
    ${job.reviewer ? `<div class="sig-box"><div style="font-size:9px;font-weight:bold;color:#888;margin-bottom:4px">PEER REVIEWER / AUTHORISER</div><div style="font-size:11px;font-weight:bold;color:#111">${job.reviewer}</div><div style="font-size:9px;color:#666;margin-top:2px">Report ref: ${reportRef}</div></div>` : ''}
    ${job.duty_holder ? `<div class="sig-box"><div style="font-size:9px;font-weight:bold;color:#888;margin-bottom:4px">DUTY HOLDER / CLIENT</div><div style="font-size:11px;font-weight:bold;color:#111">${job.duty_holder}</div><div style="font-size:9px;color:#666;margin-top:2px">Report issued electronically</div></div>` : ''}
    ${job.responsible_person ? `<div class="sig-box"><div style="font-size:9px;font-weight:bold;color:#888;margin-bottom:4px">RESPONSIBLE PERSON</div><div style="font-size:11px;font-weight:bold;color:#111">${job.responsible_person}</div><div style="font-size:9px;color:#666;margin-top:2px">Appointed under ACOP L8 §2.8</div></div>` : ''}
  </div>

  <div style="margin-top:14px;padding:8px 10px;background:#f0fdf4 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1px solid #86efac;border-radius:6px;font-size:9px;color:#166534">
    <strong>Document Control:</strong> Report Ref: ${reportRef} | Prepared by: Dorset Plumbing | Assessment Date: ${job.assessment_date||'—'} | Review Due: ${job.review_due||'—'} | Issue Status: ${job.status||'—'}
  </div>

  </div>
  <div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${job.site_name||job.client||''} · ${job.assessment_date||''} · CONFIDENTIAL</span><span>Legal &amp; Declaration</span></div>
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
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <strong>Report preview</strong>
          {job.status === 'Completed' || job.status === 'Reviewed'
            ? <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">🔒 Finalised — {job.status}</span>
            : null
          }
        </div>
        <div className="flex gap-2 items-center">
          {job.status !== 'Completed' && job.status !== 'Reviewed' && onChange && (
            <button
              onClick={() => {
                if (window.confirm('Finalise this report? This will lock all data to protect audit integrity. Use the 🔓 Unlock button to make further edits.')) {
                  onChange({ status: 'Completed' });
                }
              }}
              className="text-sm px-4 py-2 rounded-xl font-bold text-white border-2 border-green-700"
              style={{ background: '#16a34a' }}
            >
              ✅ Finalise Report
            </button>
          )}
          <button onClick={handlePrint} className="text-sm px-4 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
            Export PDF / Print
          </button>
        </div>
      </div>

      {/* In-app preview — clean summary card, not a replica of the PDF */}
      <div ref={printRef} className="space-y-3 text-sm">

        {/* Cover card */}
        <div className="rounded-xl overflow-hidden border border-gray-200">
          {job.cover_photo_url && (
            <img src={job.cover_photo_url} alt="Cover" className="w-full" style={{maxHeight:'200px',objectFit:'cover'}} />
          )}
          <div className="p-4" style={{background:'#1d1d1d'}}>
            <div className="text-xs text-gray-400 mb-1">Legionella Risk Assessment</div>
            <div className="text-xl font-bold text-white">{job.site_name || job.client || 'Untitled Site'}</div>
            <div className="text-gray-400 text-xs mt-0.5">{job.address}</div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold badge-${riskBadge}`}>Risk: {job.risk || 'LOW'}</span>
              {job.cqc_mode && <span className="px-3 py-1 rounded-full text-xs font-bold badge-high">CQC Mode</span>}
              {(job.buildings||[]).length > 0 && <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">🏘️ {job.buildings.length} buildings</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-gray-400">
              <div>Date: <span className="text-white">{job.assessment_date || '—'}</span></div>
              <div>Review: <span className="text-white">{job.review_due || '—'}</span></div>
              <div>Assessor: <span className="text-white">{job.assessor || '—'}</span></div>
              <div>Ref: <span className="text-white">{job.report_ref || '—'}</span></div>
            </div>
          </div>
        </div>

        {/* Compliance checks */}
        {(() => {
          const _cylTemp = parseFloat(job.hw_not_stored ? job.hw_boiler_set_temp : job.cylinder_temp);
          const _allOutlets = getAllOutlets(job);
          const _tgt = job.cqc_mode ? 55 : 50;
          const _checks = [
            { label: 'Temp Monitoring', pass: !!job.monthly_temp_log || !!job.log_temps_na },
            { label: 'Flushing Log', pass: !!job.flushing_log || !!job.log_flush_na },
            { label: 'Shower Cleaning', pass: !!job.shower_cleaning_log || !!job.log_shower_na },
            { label: 'TMV Records', pass: !job.tmvs_installed || !!job.tmv_service_records || !!job.log_tmv_na },
            { label: 'HW Temp ≥60°C', pass: isNaN(_cylTemp) || _cylTemp >= 60 },
            { label: `Hot Outlets ≥${_tgt}°C`, pass: _allOutlets.filter(o => o.type !== 'Outside Tap' && !o.hasTmv).every(o => isNaN(parseFloat(o.hot)) || parseFloat(o.hot) >= _tgt) },
            { label: 'Cold Outlets ≤20°C', pass: _allOutlets.every(o => isNaN(parseFloat(o.cold)) || parseFloat(o.cold) <= 20) },
            { label: 'No Dead Legs', pass: (job.dead_legs||[]).length === 0 },
          ];
          const failCount = _checks.filter(c => !c.pass).length;
          return (
            <div className="border border-gray-200 rounded-xl p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <strong className="text-sm">📋 Compliance checks</strong>
                {failCount > 0
                  ? <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">{failCount} FAIL</span>
                  : <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">All PASS</span>
                }
              </div>
              <div className="flex flex-wrap gap-2">
                {_checks.map((c, i) => (
                  <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border ${c.pass ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                    {c.pass ? '✅' : '❌'} {c.label}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Summary */}
        <div className="border border-gray-200 rounded-xl p-3 bg-white">
          <strong className="text-sm block mb-1">Executive summary</strong>
          {job.summary
            ? <div className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{job.summary}</div>
            : <div className="text-xs font-semibold text-red-700 bg-red-50 border-l-4 border-red-500 px-3 py-2 rounded">⚠ No summary — use the AI Generate button in the Overview tab.</div>
          }
        </div>

        {/* Actions */}
        {(job.actions||[]).length > 0 && (
          <div className="border border-gray-200 rounded-xl p-3 bg-white">
            <strong className="text-sm block mb-2">Actions ({(job.actions||[]).length})</strong>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead><tr className="bg-gray-50">{['Ref','System','Pri','Responsible','Deadline','Status'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody>{(job.actions||[]).map(a => {
                  const overdue = a.deadline && a.deadline < new Date().toISOString().slice(0,10) && a.status !== 'Complete';
                  return <tr key={a.id} className={overdue ? 'bg-red-50' : ''}>
                    <td className="border border-gray-200 p-1.5">{a.ref}</td>
                    <td className="border border-gray-200 p-1.5">{a.system}</td>
                    <td className="border border-gray-200 p-1.5 font-bold text-center">{a.priority}</td>
                    <td className="border border-gray-200 p-1.5">{a.responsible_person}</td>
                    <td className={`border border-gray-200 p-1.5 ${overdue ? 'text-red-700 font-bold' : ''}`}>{a.deadline||'—'}</td>
                    <td className="border border-gray-200 p-1.5">{a.status}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* Outlets summary */}
        {getAllOutlets(job).length > 0 && (
          <div className="border border-gray-200 rounded-xl p-3 bg-white">
            <strong className="text-sm block mb-2">Outlets ({getAllOutlets(job).length})</strong>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead><tr className="bg-gray-50">{['Location','Type','Hot °C','Cold °C','Status'].map(h => <th key={h} className="border border-gray-200 p-1.5 text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody>{getAllOutlets(job).map(o => {
                  const st = outletStatus(o, job.cqc_mode, isDomesticJob(job));
                  return <tr key={o.id + (o.displayLocation||'')}>
                    <td className="border border-gray-200 p-1.5">{o.displayLocation}</td>
                    <td className="border border-gray-200 p-1.5">{o.type}</td>
                    <td className="border border-gray-200 p-1.5">{o.hot||'—'}</td>
                    <td className="border border-gray-200 p-1.5">{o.cold||'—'}</td>
                    <td className="border border-gray-200 p-1.5"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold badge-${st.cls}`}>{st.text}</span></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}