import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fileToDataUrl } from '@/lib/photoUpload';

async function resizeAndUpload(file) {
  const dataUrl = await fileToDataUrl(file);
  const resized = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
  const blob = await (await fetch(resized)).blob();
  const { file_url } = await base44.integrations.Core.UploadFile({
    file: new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  });
  return { dataUrl: resized, cdnUrl: file_url };
}

export default function AiDirectReportTab({ job }) {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [reportHtml, setReportHtml] = useState('');
  const inputRef = useRef();

  const addFiles = useCallback(async (newFiles) => {
    const images = [...newFiles].filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    const previews = await Promise.all(images.map(async (f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      dataUrl: await fileToDataUrl(f),
    })));
    setFiles(prev => [...prev, ...previews]);
    setDone(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleGenerate = async () => {
    if (!notes.trim() && files.length === 0) return;
    setBusy(true);
    setError('');
    setDone(false);

    try {
      // 1. Upload photos
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${files.length}…`);
        const result = await resizeAndUpload(files[i].file);
        uploaded.push(result);
      }

      // 2. Call Claude
      setProgress('Claude is writing the report — please wait 60–90 seconds…');

      const siteName = job.site_name || job.client || 'Site';
      const notesBlock = notes.trim() ? `\n\nENGINEER NOTES:\n${notes.trim()}` : '';

      const raw = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert Legionella risk assessor for Dorset Plumbing Ltd (UK). Write a full professional ACoP L8 / HSG274 risk assessment report.

Site: ${siteName} | Address: ${job.address || ''} | Type: ${job.property_type || 'Commercial'} | Date: ${job.assessment_date || new Date().toISOString().slice(0,10)}
Assessor: ${job.assessor || 'Dorset Plumbing Ltd'} | Responsible Person: ${job.responsible_person || ''} | Duty Holder: ${job.duty_holder || ''}${notesBlock}

Examine every photo carefully and extract ALL temperature readings, outlet details, defects, and observations.

Return ONLY a JSON object (no markdown fences, no explanation) with these exact keys:
{
  "report_ref": "DLL-2026-001",
  "risk": "MEDIUM",
  "scope": "2-3 sentence paragraph on methodology and standards used",
  "site_description": "detailed paragraph about the building and water systems",
  "population": "paragraph about who uses the building",
  "summary": "4-6 sentence executive summary covering findings and risk level",
  "outlets": [{"ref":"W01","location":"","type":"","tmv":"YES/NO/N/A","hot":"","cold":"","status":"PASS/FAIL/ADVISORY/N/A","notes":""}],
  "temp_notes": ["footnote explaining any advisory or fail readings"],
  "findings": [{"ref":"F01","title":"","location":"","risk":"HIGH/MEDIUM/LOW","timeframe":"IMMEDIATE/14 DAYS/1 MONTH/ROUTINE","detail":"2-4 sentence explanation"}],
  "actions": [{"ref":"F01","summary":"","risk":"HIGH/MEDIUM/LOW","action":"","priority":"1/2/3","by_whom":"Responsible Person"}],
  "monthly": ["bullet point monitoring task"],
  "quarterly": ["bullet point monitoring task"],
  "annually": ["bullet point monitoring task"],
  "limitations": [{"ref":"L01","limitation":"","action":"","target":""}],
  "photos": [{"idx":0,"fig":1,"caption":"what the photo shows"}]
}`,
        file_urls: uploaded.length > 0 ? uploaded.map(u => u.cdnUrl) : undefined,
        model: 'claude_sonnet_4_6',
        response_json_schema: null,
      });

      // 3. Parse JSON
      setProgress('Building report…');
      let text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('AI did not return valid JSON — please try again');
      const data = JSON.parse(text.slice(start, end + 1));

      // 4. Store HTML in state so user can open it via a button click (iframe-safe)
      const html = buildReport(data, job, uploaded);
      setReportHtml(html);

      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div>
        <strong className="text-base block">📄 AI Direct Report</strong>
        <p className="text-xs text-gray-500 mt-0.5">Drop photos and/or paste engineer notes — Claude writes the full professional report and downloads it as an HTML file you can open and print to PDF.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
      >
        <div className="text-3xl mb-1">📸</div>
        <div className="text-sm font-bold text-gray-700">
          {files.length > 0 ? `${files.length} photo${files.length !== 1 ? 's' : ''} selected — click to add more` : 'Drop photos here or click to browse'}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">Optional — notes alone also work</div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {files.map(f => (
            <div key={f.id} className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-100">
              <img src={f.dataUrl} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setFiles(p => p.filter(x => x.id !== f.id))}
                className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 text-xs font-bold text-red-600 flex items-center justify-center shadow">✕</button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          📝 Engineer's notes <span className="text-gray-400 font-normal">(temperatures, observations, names, defects)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setDone(false); }}
          placeholder="e.g. Burridge Church Hall, 129 Alder Road. RP: Rebecca Bertrand. 2x unvented cylinders (Cordivari + Latetti) heat pump fed, 60°C. 6x mixed toilet cubicles TMVs blended 37.4°C. Disabled WC thermo tap no TMV 37.4°C. Kitchen 5x sinks pillar taps H:43°C C:18°C FAIL. Hose union tap yellow connector — backflow risk. TMV service overdue. No written scheme..."
          rows={6}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 resize-y"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={busy || (files.length === 0 && !notes.trim())}
        className="w-full py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-50"
        style={{ background: busy ? '#888' : '#d71920' }}
      >
        {busy
          ? <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {progress}
            </span>
          : '🤖 Generate Full Professional Report'}
      </button>

      {done && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 font-semibold text-center">
          ✅ Report ready! Click the button below to open it
        </div>
      )}

      {reportHtml && (
        <button
          onClick={() => {
            const win = window.open('', '_blank');
            if (win) {
              win.document.open();
              win.document.write(reportHtml);
              win.document.close();
            }
          }}
          className="w-full py-3 rounded-2xl font-bold text-white text-sm"
          style={{ background: '#16a34a' }}
        >
          📄 Open Report in New Tab → Print / Save as PDF
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}
    </div>
  );
}

// ─── HTML Report Builder ───────────────────────────────────────────────────

function fmt(date) {
  if (!date) return '';
  try { return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return date; }
}

const RISK_STYLES = {
  PASS:      { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  FAIL:      { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  ADVISORY:  { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  HIGH:      { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  MEDIUM:    { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  LOW:       { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  IMMEDIATE: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  DEFAULT:   { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
};

function pill(text) {
  const s = RISK_STYLES[text] || RISK_STYLES.DEFAULT;
  return `<span style="background:${s.bg};color:${s.color};border:1px solid ${s.border};padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;display:inline-block;white-space:nowrap">${text}</span>`;
}

function riskBadgeLarge(risk) {
  const s = RISK_STYLES[risk] || RISK_STYLES.DEFAULT;
  return `<div style="display:inline-flex;align-items:center;gap:10px;background:${s.bg};border:2px solid ${s.border};border-radius:8px;padding:12px 24px">
    <span style="width:14px;height:14px;border-radius:50%;background:${s.color};display:inline-block;flex-shrink:0"></span>
    <span style="font-size:18px;font-weight:800;color:${s.color};letter-spacing:1px">${risk} RISK</span>
  </div>`;
}

function buildReport(d, job, uploaded) {
  const siteName = job.site_name || job.client || 'Site';
  const address = job.address || '';
  const propertyType = job.property_type || 'Commercial';
  const assessDate = fmt(job.assessment_date) || fmt(new Date().toISOString().slice(0,10));
  const reviewDate = fmt(job.review_due) || (() => { const x = new Date(); x.setFullYear(x.getFullYear()+1); return fmt(x.toISOString().slice(0,10)); })();
  const ref = d.report_ref || job.report_ref || `DLL-${new Date().getFullYear()}-001`;
  const risk = (d.risk || 'MEDIUM').toUpperCase();
  const riskStyle = RISK_STYLES[risk] || RISK_STYLES.DEFAULT;
  const assessor = job.assessor || 'Dorset Plumbing Ltd';
  const rp = d.responsible_person || job.responsible_person || '—';
  const dh = d.duty_holder || job.duty_holder || rp;

  // Map photo index → dataUrl & caption
  const photoData = {};
  (d.photos || []).forEach(p => {
    if (uploaded[p.idx]) photoData[p.fig] = { src: uploaded[p.idx].dataUrl, caption: p.caption };
  });
  const allFigs = Object.keys(photoData).map(Number).sort((a,b)=>a-b);

  const photoGrid = () => {
    if (!allFigs.length) return '';
    let out = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0">';
    allFigs.forEach(n => {
      const p = photoData[n];
      out += `<div style="break-inside:avoid">
        <img src="${p.src}" style="width:100%;height:180px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;display:block"/>
        <p style="margin:5px 0 0;font-size:10px;color:#6b7280;font-style:italic;text-align:center">Fig. ${n} — ${p.caption}</p>
      </div>`;
    });
    out += '</div>';
    return out;
  };

  const coverImg = allFigs.length > 0 && photoData[allFigs[0]]
    ? `<img src="${photoData[allFigs[0]].src}" style="width:100%;height:280px;object-fit:cover;display:block"/>`
    : `<div style="width:100%;height:160px;background:linear-gradient(135deg,#1e3a5f 0%,#2d6a9f 100%);display:flex;align-items:center;justify-content:center">
        <span style="font-size:48px;opacity:0.4">💧</span>
      </div>`;

  // Outlet rows
  const outletRows = (d.outlets||[]).map((o, i) =>
    `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
      <td style="font-weight:600;color:#374151">${o.ref||''}</td>
      <td>${o.location||''}</td>
      <td>${o.type||''}</td>
      <td style="text-align:center">${o.tmv==='YES'?'<span style="color:#059669;font-weight:700">✓</span>':o.tmv==='NO'?'<span style="color:#dc2626">✗</span>':'—'}</td>
      <td style="text-align:center;font-weight:600">${o.hot||'—'}</td>
      <td style="text-align:center;font-weight:600">${o.cold||'—'}</td>
      <td style="text-align:center">${pill(o.status||'N/A')}</td>
      <td style="color:#6b7280;font-size:10px">${o.notes||''}</td>
    </tr>`
  ).join('');

  // Finding cards with left-border colour coding
  const findingCards = (d.findings||[]).map(f => {
    const rs = RISK_STYLES[f.risk] || RISK_STYLES.DEFAULT;
    const urgMap = { IMMEDIATE: '#dc2626', '14 DAYS': '#ea580c', '1 MONTH': '#d97706', ROUTINE: '#16a34a' };
    const urgCol = urgMap[f.timeframe] || '#6b7280';
    return `<div style="border-left:4px solid ${rs.color};background:#fff;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.07)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="background:#1e3a5f;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px">${f.ref}</span>
        <span style="font-size:12px;font-weight:700;color:#111827;flex:1">${f.title}${f.location?` <span style="font-weight:400;color:#6b7280">· ${f.location}</span>`:''}</span>
        ${pill(f.risk||'MEDIUM')}
        <span style="background:${urgCol}22;color:${urgCol};border:1px solid ${urgCol}55;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">${f.timeframe||'ROUTINE'}</span>
      </div>
      <p style="margin:0;font-size:11px;line-height:1.75;color:#374151">${f.detail||''}</p>
    </div>`;
  }).join('');

  // Action table rows
  const actionRows = (d.actions||[]).map((a, i) => {
    const pBg = a.priority==='1' ? '#fee2e2' : a.priority==='2' ? '#fef3c7' : '#f0fdf4';
    const pCol = a.priority==='1' ? '#991b1b' : a.priority==='2' ? '#92400e' : '#166534';
    return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
      <td style="font-weight:700;color:#1e3a5f">${a.ref}</td>
      <td style="font-weight:600">${a.summary||''}</td>
      <td style="text-align:center">${pill(a.risk||'MEDIUM')}</td>
      <td>${a.action||''}</td>
      <td style="text-align:center"><span style="background:${pBg};color:${pCol};font-weight:800;font-size:13px;padding:4px 10px;border-radius:6px;display:inline-block">${a.priority||''}</span></td>
      <td style="color:#6b7280">${a.by_whom||''}</td>
    </tr>`;
  }).join('');

  const limitRows = (d.limitations||[]).map((l,i) =>
    `<tr style="background:${i%2===0?'#fff':'#f9fafb'}"><td>${l.ref}</td><td>${l.limitation}</td><td>${l.action}</td><td>${l.target}</td></tr>`
  ).join('');

  const list = (arr, colour='#1e3a5f') => arr&&arr.length
    ? `<ul style="margin:8px 0 12px;padding-left:20px">${arr.map(x=>`<li style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:2px">${x}</li>`).join('')}</ul>`
    : '<p style="font-size:11px;color:#9ca3af;margin:4px 0 12px">None specified.</p>';

  const thStyle = 'background:#1e3a5f;color:#fff;padding:9px 12px;font-size:10px;font-weight:700;text-align:left;border:none';
  const tdStyle = 'padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;vertical-align:top';

  const section = (num, title) =>
    `<div style="display:flex;align-items:center;gap:12px;margin:28px 0 14px">
      <span style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;flex-shrink:0">${num}</span>
      <span style="font-size:16px;font-weight:700;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:3px;flex:1">${title}</span>
    </div>`;

  const subsection = (title) =>
    `<div style="font-size:12px;font-weight:700;color:#374151;margin:16px 0 6px;padding-left:12px;border-left:3px solid #dc2626">${title}</div>`;

  const page = (content) =>
    `<div style="page-break-before:always;padding:0 40px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #e5e7eb;margin-bottom:4px">
        <span style="font-size:10px;font-weight:700;color:#1e3a5f;letter-spacing:0.5px">DORSET PLUMBING LTD — LEGIONELLA RISK ASSESSMENT</span>
        <span style="font-size:9px;color:#9ca3af">${siteName} · ${ref}</span>
      </div>
      ${content}
      <div style="border-top:1px solid #e5e7eb;margin-top:28px;padding-top:8px;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af">
        <span>Dorset Plumbing Ltd · 01202 668822 · dorsetplumbing.com · Bayside Business Centre, 48 Willis Way, Poole BH15 3TB</span>
        <span>CONFIDENTIAL</span>
      </div>
    </div>`;

  // ── Cover Page ──────────────────────────────────────────────────────────
  const cover = `<div style="min-height:100vh;display:flex;flex-direction:column;background:#fff">
    ${coverImg}
    <div style="background:#1e3a5f;padding:32px 40px 24px">
      <div style="font-size:11px;font-weight:600;color:#93c5fd;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Legionella Risk Assessment</div>
      <div style="font-size:28px;font-weight:800;color:#fff;margin-bottom:6px;line-height:1.2">${siteName}</div>
      <div style="font-size:13px;color:#93c5fd">${address}</div>
    </div>
    <div style="padding:24px 40px;flex:1;background:#fff">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
        ${[
          ['Report Reference', ref],
          ['Property Type', propertyType],
          ['Assessment Date', assessDate],
          ['Next Review Due', reviewDate],
          ['Assessed By', assessor],
          ['Prepared By', 'Dorset Plumbing Ltd'],
          ['Responsible Person', rp],
          ['Duty Holder', dh],
          ['Standard', 'HSE ACOP L8 (4th Ed.) / HSG274 / BS 8580-1:2019'],
          ['Site Address', address||siteName],
        ].map(([k,v],i) => `
          <div style="padding:10px 14px;background:${i%2===0?'#f9fafb':'#fff'};border-bottom:1px solid #e5e7eb">
            <div style="font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${k}</div>
            <div style="font-size:11px;font-weight:600;color:#111827">${v||'—'}</div>
          </div>`
        ).join('')}
      </div>
      <div style="text-align:center;margin:20px 0">
        ${riskBadgeLarge(risk)}
      </div>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:12px 40px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:9px;color:#9ca3af">Dorset Plumbing Ltd · 01202 668822 · dorsetplumbing.com</span>
      <span style="font-size:9px;color:#9ca3af">PRIVATE &amp; CONFIDENTIAL</span>
    </div>
  </div>`;

  // ── Page 2: Scope, Site, Summary, Outlet Register ───────────────────────
  const p2 = page(`
    ${section('1', 'Scope and Methodology')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">${d.scope||'This Legionella Risk Assessment has been carried out in accordance with HSE Approved Code of Practice L8 (4th Edition), HSG 274 Parts 1–3, and BS 8580-1:2019.'}</p>

    ${subsection('1.1 Site Description')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">${d.site_description||''}</p>

    ${subsection('1.2 Population at Risk')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">${d.population||''}</p>

    ${subsection('1.3 Executive Summary')}
    <div style="background:#eff6ff;border-left:4px solid #1e3a5f;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:16px">
      <p style="font-size:11px;line-height:1.8;color:#1e3a5f;margin:0">${d.summary||''}</p>
    </div>

    ${subsection('1.4 Water Outlet Register')}
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <thead><tr>
        <th style="${thStyle}">Ref.</th><th style="${thStyle}">Location</th><th style="${thStyle}">Type</th>
        <th style="${thStyle};text-align:center">TMV</th><th style="${thStyle};text-align:center">Hot °C</th>
        <th style="${thStyle};text-align:center">Cold °C</th><th style="${thStyle};text-align:center">Status</th>
        <th style="${thStyle}">Notes</th>
      </tr></thead>
      <tbody>${outletRows}</tbody>
    </table>
  `);

  // ── Page 3: Temperature Results + Photos ─────────────────────────────────
  const p3 = page(`
    ${section('2', 'Temperature Monitoring Results')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">Temperatures were measured at all accessible outlets using a calibrated digital thermometer after allowing water to run for one minute or until stable. Compliance thresholds: hot water ≥50°C at non-blended outlets; cold water ≤20°C; TMV blended 38–43°C; cylinders ≥60°C storage.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr>
        <th style="${thStyle}">Ref.</th><th style="${thStyle}">Location / Outlet</th>
        <th style="${thStyle};text-align:center">Cold °C</th><th style="${thStyle};text-align:center">Hot / Blended °C</th>
        <th style="${thStyle}">Target</th><th style="${thStyle};text-align:center">Status</th>
      </tr></thead>
      <tbody>${(d.outlets||[]).filter(o=>o.hot||o.cold).map((o,i) => {
        const target = (o.tmv||'').includes('YES') ? '38–43°C blended' : (o.type||'').toLowerCase().includes('cylinder') ? '≥60°C store' : '≥50°C';
        return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
          <td style="${tdStyle};font-weight:600;color:#1e3a5f">${o.ref}</td>
          <td style="${tdStyle}">${o.location}</td>
          <td style="${tdStyle};text-align:center;font-weight:600;color:#2563eb">${o.cold||'—'}</td>
          <td style="${tdStyle};text-align:center;font-weight:600;color:#dc2626">${o.hot||'—'}</td>
          <td style="${tdStyle};color:#6b7280">${target}</td>
          <td style="${tdStyle};text-align:center">${pill(o.status||'N/A')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    ${(d.temp_notes||[]).map(n=>`<p style="font-size:10px;color:#6b7280;font-style:italic;margin-bottom:4px">* ${n}</p>`).join('')}
    ${allFigs.length > 0 ? `${subsection('2.1 Site Photographs')}${photoGrid()}` : ''}
  `);

  // ── Page 4: Findings ────────────────────────────────────────────────────
  const p4 = page(`
    ${section('3', 'Findings and Identified Hazards')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:16px">The following hazards were identified during the survey. Risk is classified using the BS 8580-1:2019 risk matrix. Each finding is assigned an action timeframe based on severity.</p>
    ${findingCards || '<p style="font-size:11px;color:#9ca3af">No specific hazards identified.</p>'}
  `);

  // ── Page 5: Actions + Monitoring ────────────────────────────────────────
  const p5 = page(`
    ${section('4', 'Risk Summary and Action Plan')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">The table below summarises all findings and required corrective actions. Priority 1 = Immediate; Priority 2 = Within 1 month; Priority 3 = Within 3 months. Progress should be recorded by the Responsible Person and reviewed at each subsequent visit.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr>
        <th style="${thStyle}">Ref.</th><th style="${thStyle}">Finding</th><th style="${thStyle};text-align:center">Risk</th>
        <th style="${thStyle}">Action Required</th><th style="${thStyle};text-align:center">Priority</th>
        <th style="${thStyle}">By Whom</th>
      </tr></thead>
      <tbody>${actionRows}</tbody>
    </table>

    ${section('5', 'Ongoing Monitoring Programme')}
    ${subsection('5.1 Monthly Tasks')}${list(d.monthly)}
    ${subsection('5.2 Quarterly Tasks')}${list(d.quarterly)}
    ${subsection('5.3 Annual Tasks')}${list(d.annually)}
  `);

  // ── Page 6: Limitations, Legislation, Declaration ────────────────────────
  const p6 = page(`
    ${limitRows ? `${section('6', 'Assessment Limitations')}
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr>
        <th style="${thStyle}">Ref.</th><th style="${thStyle}">Limitation</th>
        <th style="${thStyle}">Action Required</th><th style="${thStyle}">Target Date</th>
      </tr></thead>
      <tbody>${limitRows}</tbody>
    </table>` : ''}

    ${section('7', 'Legislative Framework')}
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:20px">
      ${[
        'Health and Safety at Work etc. Act 1974',
        'Control of Substances Hazardous to Health Regulations 2002 (COSHH) — Regulation 12 and Schedule 3',
        'Management of Health and Safety at Work Regulations 1999',
        'HSE Approved Code of Practice L8 (4th Edition): Legionnaires\' disease — The control of legionella bacteria in water systems',
        'HSG 274: Legionnaires\' disease — Technical guidance (Parts 1, 2 and 3)',
        'BS 8580-1:2019: Water quality — Risk assessments for Legionella control — Code of practice',
      ].map(l => `<div style="display:flex;gap:8px;margin-bottom:6px"><span style="color:#1e3a5f;font-weight:700;flex-shrink:0">▸</span><span style="font-size:11px;color:#374151;line-height:1.6">${l}</span></div>`).join('')}
    </div>

    ${section('8', 'Declaration and Sign-off')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:16px">This risk assessment has been carried out by a competent person on behalf of Dorset Plumbing Ltd in accordance with the HSE ACOP L8 guidance. The findings and recommendations are based on conditions observed at the time of the survey. This report should be reviewed following any significant changes to the water system, occupancy, or at a minimum annually.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;max-width:480px">
      ${[
        ['Assessed by', assessor],
        ['On behalf of', 'Dorset Plumbing Ltd'],
        ['Assessment date', assessDate],
        ['Next review due', reviewDate],
      ].map(([k,v],i) => `<tr style="background:${i%2===0?'#f9fafb':'#fff'}">
        <td style="padding:10px 14px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px;width:40%;border-bottom:1px solid #e5e7eb">${k}</td>
        <td style="padding:10px 14px;font-size:11px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">${v}</td>
      </tr>`).join('')}
      <tr style="background:#fff">
        <td style="padding:10px 14px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px">Signature</td>
        <td style="padding:28px 14px"></td>
      </tr>
    </table>

    <div style="background:#1e3a5f;color:#fff;border-radius:8px;padding:16px 20px;text-align:center">
      <div style="font-weight:800;font-size:13px;margin-bottom:4px">Dorset Plumbing Ltd</div>
      <div style="font-size:10px;opacity:0.8;line-height:1.8">Bayside Business Centre, 48 Willis Way, Poole, Dorset BH15 3TB<br/>
      Tel: 01202 668822 &nbsp;·&nbsp; Web: dorsetplumbing.com</div>
    </div>
  `);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Legionella Risk Assessment — ${siteName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',Arial,sans-serif;background:#fff;color:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @media print{
      body{margin:0}
      .no-print{display:none!important}
      @page{margin:0;size:A4}
    }
    @media screen{
      body{background:#e5e7eb;padding:20px 0}
      .page-wrap{max-width:860px;margin:0 auto 32px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,0.12);border-radius:4px;overflow:hidden}
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;padding:16px;background:#1e3a5f;color:#fff;font-family:Inter,sans-serif;font-size:13px;font-weight:600;position:sticky;top:0;z-index:100">
    📄 Legionella Risk Assessment — ${siteName} &nbsp;·&nbsp;
    <button onclick="window.print()" style="background:#dc2626;color:#fff;border:none;padding:6px 18px;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px">🖨 Print / Save as PDF</button>
  </div>
  <div class="page-wrap">
    ${cover}
  </div>
  <div class="page-wrap" style="padding:0">
    ${p2}
  </div>
  <div class="page-wrap" style="padding:0">
    ${p3}
  </div>
  <div class="page-wrap" style="padding:0">
    ${p4}
  </div>
  <div class="page-wrap" style="padding:0">
    ${p5}
  </div>
  <div class="page-wrap" style="padding:0">
    ${p6}
  </div>
</body>
</html>`;
}