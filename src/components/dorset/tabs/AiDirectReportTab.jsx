import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fileToDataUrl } from '@/lib/photoUpload';

async function resizeAndUpload(file) {
  const dataUrl = await fileToDataUrl(file);
  const resized = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1200;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.70));
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
        prompt: `You are an expert Legionella risk assessor acting on behalf of Dorset Plumbing Ltd (UK). Produce a full, professional, legally compliant Legionella Risk Assessment report.

COMPANY DETAILS:
Dorset Plumbing Ltd | Gas Safe No. 943146 | Company Reg. 14237190 | VAT 429486262
Competency: Cert-ain Certification Ltd | Cert No. 95252/39577/58 (Valid to 13/06/2030)
Bayside Business Centre, 48 Willis Way, Poole, Dorset BH15 3TB | Tel: 01202 668822 | dorsetplumbing.com

SITE: ${siteName} | Address: ${job.address || ''} | Type: ${job.property_type || 'Commercial'} | Survey date: ${job.assessment_date || new Date().toISOString().slice(0,10)}
Assessor: ${job.assessor || 'Dorset Plumbing Ltd'} | Responsible Person: ${job.responsible_person || ''} | Duty Holder: ${job.duty_holder || ''}${notesBlock}

REGULATORY FRAMEWORK:
This document constitutes a Legionella Risk Assessment as defined by BS 8580-1:2019: Water quality — Risk assessments for Legionella control — Code of practice. It has been carried out in accordance with the HSE Approved Code of Practice L8 (4th Edition) and HSG 274 Parts 1–3. The assessment was conducted by a competent person acting on behalf of Dorset Plumbing Ltd and included a visual inspection of all accessible water systems, temperature monitoring at all outlets, and a review of system condition and asset details.

ACOP L8 TEMPERATURE COMPLIANCE TARGETS (apply these strictly when assessing outlet status):
- Hot water at non-TMV outlets: must reach ≥50°C within 1 minute of running — FAIL if below
- Cold water: must remain ≤20°C — FAIL if above
- TMV blended outlets: must deliver 38–43°C — FAIL if outside this range
- Hot water storage cylinders / calorifiers: must store at ≥60°C — FAIL if below
- Point-of-use electric water heaters (under-sink, wall-mounted): must store at ≥60°C and deliver ≥50°C at outlet — FAIL if below
- Water in the range 20–45°C is in the Legionella proliferation zone — always flag this

MANDATORY DISCLAIMER (use this exact wording in the scope section):
"Findings reflect conditions at the time and date of survey only. Dorset Plumbing Ltd accepts no liability for changes in system condition occurring after the date of this assessment. This document does not constitute legal advice."

Examine every photo carefully. Extract ALL temperature readings (read gauge values precisely), outlet details, asset makes/models/serial numbers, defects, and observations.

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "report_ref": "DLL-2026-001",
  "risk": "HIGH/MEDIUM/LOW",
  "scope": "Full paragraph including BS 8580-1:2019 reference, ACOP L8, HSG274, methodology, and the mandatory disclaimer verbatim",
  "site_description": "Detailed paragraph about the building, age, use, water systems and infrastructure",
  "population": "Paragraph about occupants, visitors, vulnerability",
  "summary": "4-6 sentence executive summary covering what was inspected, key findings, risk level, and main actions required",
  "outlets": [{"ref":"W01","location":"","type":"","tmv":"YES/NO/N/A","hot":"","cold":"","status":"PASS/FAIL/ADVISORY/HIGH RISK/N/A","notes":""}],
  "assets": [{"ref":"HW1","type":"","make":"","model":"","serial":"","location":"","last_service":"","stat_temp":"","notes":""}],
  "temp_notes": ["footnote explaining any advisory or fail readings"],
  "findings": [{"ref":"F01","title":"","location":"","risk":"HIGH/MEDIUM/LOW","timeframe":"IMMEDIATE/14 DAYS/1 MONTH/ROUTINE","detail":"2-4 sentence detailed professional explanation referencing ACOP L8 / HSG274 where relevant"}],
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
  const DP_RED = '#C0392B';
  const DP_NAVY = '#2C3E50';

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

  // Cover photo — full-width hero spanning the red banner area
  const coverImgSrc = allFigs.length > 0 && photoData[allFigs[0]] ? photoData[allFigs[0]].src : null;
  const coverImg = coverImgSrc
    ? `<div style="width:100%;height:260px;overflow:hidden;position:relative">
        <img src="${coverImgSrc}" style="width:100%;height:100%;object-fit:cover;display:block"/>
        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.5));padding:8px 16px">
          <span style="font-size:9px;color:#fff;font-style:italic">Fig. 1 — ${photoData[allFigs[0]].caption}</span>
        </div>
      </div>`
    : `<div style="width:100%;height:120px;background:linear-gradient(135deg,${DP_NAVY} 0%,#3d5a73 100%);display:flex;align-items:center;justify-content:center">
        <span style="font-size:40px;opacity:0.3">💧</span>
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
        <span style="background:${DP_NAVY};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px">${f.ref}</span>
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
      <td style="font-weight:700;color:${DP_NAVY}">${a.ref}</td>
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

  const list = (arr) => arr&&arr.length
    ? `<ul style="margin:8px 0 12px;padding-left:20px">${arr.map(x=>`<li style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:2px">${x}</li>`).join('')}</ul>`
    : '<p style="font-size:11px;color:#9ca3af;margin:4px 0 12px">None specified.</p>';

  const thStyle = `background:${DP_NAVY};color:#fff;padding:9px 12px;font-size:10px;font-weight:700;text-align:left;border:none`;
  const tdStyle = 'padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;vertical-align:top';

  const section = (num, title) =>
    `<div style="display:flex;align-items:center;gap:12px;margin:28px 0 14px">
      <span style="background:${DP_RED};color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;flex-shrink:0">${num}</span>
      <span style="font-size:16px;font-weight:700;color:${DP_RED};border-bottom:2px solid ${DP_RED};padding-bottom:3px;flex:1">${title}</span>
    </div>`;

  const subsection = (title) =>
    `<div style="font-size:12px;font-weight:700;color:#374151;margin:16px 0 6px;padding-left:12px;border-left:3px solid ${DP_RED}">${title}</div>`;

  const footerLine = `Dorset Plumbing Ltd · Gas Safe 943146 · Co. Reg. 14237190 · VAT 429486262 · 01202 668822 · dorsetplumbing.com · Bayside Business Centre, 48 Willis Way, Poole BH15 3TB`;

  const page = (content, pageNum) =>
    `<div style="page-break-before:always;padding:0 40px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 6px;border-bottom:2px solid ${DP_RED};margin-bottom:4px">
        <span style="font-size:10px;font-weight:700;color:${DP_NAVY};letter-spacing:0.5px">DORSET PLUMBING LTD</span>
        <span style="font-size:9px;color:#6b7280">Legionella Risk Assessment &nbsp;|&nbsp; ${siteName}${address ? ', ' + address.split(',').slice(-1)[0].trim() : ''}</span>
      </div>
      ${content}
      <div style="border-top:1px solid #e5e7eb;margin-top:28px;padding-top:6px;display:flex;justify-content:space-between;font-size:8px;color:#9ca3af">
        <span>${footerLine}</span>
        <span>Page ${pageNum||''}</span>
      </div>
    </div>`;

  const riskBg = risk === 'HIGH' ? '#C0392B' : risk === 'MEDIUM' ? '#d4770a' : '#1a6e1a';

  // ── Cover Page ──────────────────────────────────────────────────────────
  const cover = `<div style="display:flex;flex-direction:column;background:#fff">
    <div style="background:${DP_RED};padding:8px 20px;display:flex;justify-content:space-between;align-items:center">
      <span style="color:#fff;font-weight:700;font-size:11px;letter-spacing:0.4px">DORSET PLUMBING LTD</span>
      <span style="color:#fff;font-size:9px;opacity:0.9">Legionella Risk Assessment &nbsp;|&nbsp; ${siteName}${address ? ', ' + address.split(',').slice(-1)[0].trim() : ''}</span>
    </div>
    <div style="background:${DP_RED};padding:20px 40px 16px;color:#fff">
      <div style="font-size:22px;font-weight:700;margin-bottom:4px">LEGIONELLA RISK ASSESSMENT</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:2px">${siteName}</div>
      <div style="font-size:11px;opacity:0.9">${address}</div>
    </div>
    ${coverImg}
    <div style="padding:0 40px 16px">
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin:12px 0 8px">
        ${[
          ['Client', job.client||siteName],
          ['Site Address', address||siteName],
          ['Responsible Person', rp],
          ['Duty Holder', dh],
          ['Assessment Date', assessDate],
          ['Report Reference', ref],
          ['Assessed By', assessor],
          ['Competency', 'Cert-ain Certification Ltd | Cert No. 95252/39577/58 (Valid to 13/06/2030)'],
          ['Valid To', reviewDate + ' (annual review recommended)'],
          ['Prepared By', 'Dorset Plumbing Ltd'],
          ['Standard', 'HSE ACOP L8 (4th Ed.) | HSG 274 Parts 1-3 | BS 8580-1:2019'],
        ].map(([k,v]) => `<tr>
          <td style="font-weight:700;padding:6px 10px;background:#f5f5f5;border:1px solid #ddd;width:38%">${k}:</td>
          <td style="padding:6px 10px;border:1px solid #ddd">${v||'—'}</td>
        </tr>`).join('')}
      </table>
      <div style="display:flex;border:1px solid #ddd;overflow:hidden;margin-top:6px">
        <div style="background:${DP_NAVY};color:#fff;padding:10px 16px;font-weight:700;font-size:11px;flex:1">OVERALL RISK RATING</div>
        <div style="background:${riskBg};color:#fff;padding:10px 20px;font-weight:700;font-size:13px">${risk}</div>
      </div>
    </div>
    <div style="border-top:1px solid #ddd;padding:6px 20px;display:flex;justify-content:space-between;font-size:8px;color:#9ca3af">
      <span>Dorset Plumbing Ltd · Gas Safe 943146 · Co. Reg. 14237190 · VAT 429486262 · 01202 668822 · dorsetplumbing.com · Bayside Business Centre, 48 Willis Way, Poole BH15 3TB</span>
      <span>Page 1</span>
    </div>
  </div>`;

  // Assets table
  const assetRows = (d.assets||[]).map((a,i) =>
    `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
      <td style="${tdStyle};font-weight:600">${a.ref||''}</td>
      <td style="${tdStyle}">${a.type||''}</td>
      <td style="${tdStyle}">${a.make||''}${a.model?' '+a.model:''}</td>
      <td style="${tdStyle}">${a.serial||'—'}</td>
      <td style="${tdStyle}">${a.location||''}</td>
      <td style="${tdStyle}">${a.last_service||'—'}</td>
      <td style="${tdStyle};text-align:center;font-weight:600">${a.stat_temp||'—'}</td>
      <td style="${tdStyle};color:#6b7280;font-size:10px">${a.notes||''}</td>
    </tr>`
  ).join('');

  // ── Page 2: Scope, Site, Summary, Outlet Register ───────────────────────
  const p2 = page(`
    ${section('1', 'Scope and Methodology')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">${d.scope||'This Legionella Risk Assessment has been carried out in accordance with HSE Approved Code of Practice L8 (4th Edition), HSG 274 Parts 1–3, and BS 8580-1:2019. Findings reflect conditions at the time and date of survey only. Dorset Plumbing Ltd accepts no liability for changes in system condition occurring after the date of this assessment. This document does not constitute legal advice.'}</p>

    ${subsection('1.1 Site Description')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">${d.site_description||''}</p>

    ${subsection('1.2 Population at Risk')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">${d.population||''}</p>

    ${subsection('1.3 Executive Summary')}
    <div style="background:#fef2f2;border-left:4px solid ${DP_RED};padding:14px 16px;margin-bottom:16px">
      <p style="font-size:11px;line-height:1.8;color:${DP_NAVY};margin:0">${d.summary||''}</p>
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
  `, 2);

  // ── Page 3: Temperature Results + Photos ─────────────────────────────────
  const p3 = page(`
    ${section('2', 'Temperature Monitoring Results')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">Temperatures were measured at all accessible outlets using a calibrated digital thermometer after allowing water to run for one minute or until stable. ACOP L8 requires hot water to reach 50°C or above at outlets within one minute of running. Cold water must remain below 20°C. Under-sink and wall-mounted water heaters must store at a minimum of 60°C. TMV blended outlets must deliver 38–43°C.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr>
        <th style="${thStyle}">Ref.</th><th style="${thStyle}">Location / Outlet</th>
        <th style="${thStyle};text-align:center">Cold °C</th><th style="${thStyle};text-align:center">Hot / Blended °C</th>
        <th style="${thStyle}">Target</th><th style="${thStyle};text-align:center">Status</th>
      </tr></thead>
      <tbody>${(d.outlets||[]).filter(o=>o.hot||o.cold).map((o,i) => {
        const target = (o.tmv||'').includes('YES') ? '38–43°C blended' : (o.type||'').toLowerCase().includes('cylinder') ? '≥60°C store' : '≥50°C';
        return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
          <td style="${tdStyle};font-weight:600;color:${DP_NAVY}">${o.ref}</td>
          <td style="${tdStyle}">${o.location}</td>
          <td style="${tdStyle};text-align:center;font-weight:600;color:#2563eb">${o.cold||'—'}</td>
          <td style="${tdStyle};text-align:center;font-weight:600;color:${DP_RED}">${o.hot||'—'}</td>
          <td style="${tdStyle};color:#6b7280">${target}</td>
          <td style="${tdStyle};text-align:center">${pill(o.status||'N/A')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    ${(d.temp_notes||[]).map(n=>`<p style="font-size:10px;color:#6b7280;font-style:italic;margin-bottom:4px">• ${n}</p>`).join('')}
    ${allFigs.length > 0 ? `${subsection('2.1 Site Photographs')}${photoGrid()}` : ''}
  `, 3);

  // ── Schematic Page ───────────────────────────────────────────────────────
  const buildSchematic = () => {
    const outlets = d.outlets || [];
    const assets = d.assets || [];
    const hasCwst = job.cwst_present || assets.some(a => (a.type||'').toLowerCase().includes('tank') || (a.type||'').toLowerCase().includes('cwst'));
    const hwAssets = assets.filter(a => (a.type||'').toLowerCase().includes('cylinder') || (a.type||'').toLowerCase().includes('calorifier') || (a.type||'').toLowerCase().includes('boiler') || (a.type||'').toLowerCase().includes('unvented'));
    const hasTmvs = outlets.some(o => o.tmv === 'YES') || job.tmvs_installed;

    const passCount = outlets.filter(o => o.status === 'PASS').length;
    const failCount = outlets.filter(o => o.status === 'FAIL' || o.status === 'HIGH RISK').length;
    const advCount = outlets.filter(o => o.status === 'ADVISORY').length;

    // SVG system schematic
    const SVG_W = 740, SVG_H = 340;
    // Node positions
    const mains  = { x: 40,  y: 170, label: 'Mains\nSupply' };
    const cwst   = { x: 160, y: 80,  label: 'CWST' };
    const hw     = { x: 300, y: 170, label: hwAssets.length > 0 ? (hwAssets[0].make||'HW') + '\nCylinder' : 'HW\nCylinder' };
    const tmv    = { x: 460, y: 170, label: 'TMV\nBlending' };
    const cold   = { x: 460, y: 280, label: 'Cold\nDistrib.' };
    const hotOut = { x: 600, y: 120, label: 'Hot\nOutlets' };
    const tmvOut = { x: 600, y: 200, label: 'Blended\nOutlets' };
    const coldOut= { x: 600, y: 280, label: 'Cold\nOutlets' };

    const node = (pos, colour, icon) =>
      `<circle cx="${pos.x}" cy="${pos.y}" r="26" fill="${colour}" stroke="#fff" stroke-width="2"/>
       <text x="${pos.x}" y="${pos.y-4}" text-anchor="middle" font-size="14" fill="#fff">${icon}</text>
       ${pos.label.split('\n').map((l,i) => `<text x="${pos.x}" y="${pos.y+42+(i*13)}" text-anchor="middle" font-size="9" fill="#374151" font-family="Arial">${l}</text>`).join('')}`;

    const line = (a, b, colour='#94a3b8', dash='') =>
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${colour}" stroke-width="2" ${dash?`stroke-dasharray="${dash}"`:''} marker-end="url(#arrow)"/>`;

    const statusBar = (label, count, colour) => count > 0
      ? `<span style="display:inline-flex;align-items:center;gap:5px;background:${colour}22;border:1px solid ${colour}55;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;color:${colour}">${label}: ${count}</span>`
      : '';

    const svg = `<svg width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}" style="max-width:100%;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#94a3b8"/>
        </marker>
      </defs>
      <!-- Cold supply lines -->
      ${line(mains, hasCwst ? cwst : hw, '#3b82f6')}
      ${hasCwst ? line(cwst, hw, '#3b82f6') : ''}
      ${line(hw, tmv, '#ef4444')}
      ${line(mains, cold, '#3b82f6')}
      ${line(cold, coldOut, '#3b82f6', '4 2')}
      <!-- Hot lines -->
      ${line(hw, hotOut, '#ef4444', '4 2')}
      <!-- TMV lines -->
      ${hasTmvs ? line(tmv, tmvOut, '#f59e0b', '4 2') : ''}
      <!-- Nodes -->
      ${node(mains, '#2C3E50', '🏙')}
      ${hasCwst ? node(cwst, '#3b82f6', '🗳') : ''}
      ${node(hw, '#ef4444', '🔥')}
      ${hasTmvs ? node(tmv, '#f59e0b', '⚙') : ''}
      ${node(cold, '#3b82f6', '❄')}
      ${node(hotOut, '#ef4444', '🚿')}
      ${hasTmvs ? node(tmvOut, '#f59e0b', '🚿') : ''}
      ${node(coldOut, '#3b82f6', '🚿')}
      <!-- Legend -->
      <line x1="20" y1="320" x2="50" y2="320" stroke="#ef4444" stroke-width="2"/>
      <text x="55" y="324" font-size="9" fill="#374151" font-family="Arial">Hot water</text>
      <line x1="110" y1="320" x2="140" y2="320" stroke="#3b82f6" stroke-width="2"/>
      <text x="145" y="324" font-size="9" fill="#374151" font-family="Arial">Cold water</text>
      ${hasTmvs ? `<line x1="200" y1="320" x2="230" y2="320" stroke="#f59e0b" stroke-width="2"/><text x="235" y="324" font-size="9" fill="#374151" font-family="Arial">TMV blended</text>` : ''}
    </svg>`;

    const hwTemp = hwAssets.length > 0 && hwAssets[0].stat_temp ? `<br/><small style="color:#6b7280">Stat: ${hwAssets[0].stat_temp}°C</small>` : (job.cylinder_temp ? `<br/><small style="color:#6b7280">Stat: ${job.cylinder_temp}°C</small>` : '');

    return `
      ${svg}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 8px">
        ${statusBar('PASS', passCount, '#059669')}
        ${statusBar('FAIL', failCount, '#dc2626')}
        ${statusBar('ADVISORY', advCount, '#d97706')}
        ${hasCwst ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;color:#1d4ed8">CWST: Present</span>` : ''}
        ${hasTmvs ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#fffbeb;border:1px solid #fde68a;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;color:#92400e">TMVs: Installed</span>` : ''}
        ${hwAssets.length > 0 ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#fef2f2;border:1px solid #fecaca;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;color:#991b1b">HW Assets: ${hwAssets.length}</span>` : ''}
      </div>
      <p style="font-size:10px;color:#6b7280;margin:4px 0 0;font-style:italic">Schematic is indicative only and based on information gathered during the survey. Dashed lines indicate distribution branches.</p>
    `;
  };

  const pSchematic = page(`
    ${section('S', 'Water System Schematic')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">The diagram below shows the indicative water system layout identified during the survey, including cold water supply, hot water storage, TMV blending valves, and outlet distribution branches.</p>
    ${buildSchematic()}
  `, '3a');

  // ── Page 4: Findings ────────────────────────────────────────────────────
  const p4 = page(`
    ${section('3', 'Findings and Identified Hazards')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:16px">The following hazards were identified during the survey. Risk is scored per BS 8580-1:2019.</p>
    ${findingCards || '<p style="font-size:11px;color:#9ca3af">No specific hazards identified.</p>'}
  `, 4);

  // ── Page 5: Actions + Assets + Monitoring ───────────────────────────────
  const p5 = page(`
    ${section('4', 'Risk Summary and Action Plan')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">The table below summarises all findings and required corrective actions. Progress must be formally recorded by the Responsible Person. Priority 1 = Immediate; Priority 2 = Within 1 month; Priority 3 = Within 3 months.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr>
        <th style="${thStyle}">Ref.</th><th style="${thStyle}">Finding</th><th style="${thStyle};text-align:center">Risk</th>
        <th style="${thStyle}">Action Required</th><th style="${thStyle};text-align:center">Priority</th>
        <th style="${thStyle}">By Whom</th>
      </tr></thead>
      <tbody>${actionRows}</tbody>
    </table>

    ${assetRows ? `${section('5', 'Water System Asset Register')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:12px">The following water heating and treatment assets were identified at the time of survey.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr>
        <th style="${thStyle}">Ref.</th><th style="${thStyle}">Type</th><th style="${thStyle}">Make / Model</th>
        <th style="${thStyle}">Serial No.</th><th style="${thStyle}">Location</th>
        <th style="${thStyle}">Last Service</th><th style="${thStyle};text-align:center">Stat °C</th>
        <th style="${thStyle}">Notes</th>
      </tr></thead>
      <tbody>${assetRows}</tbody>
    </table>` : ''}

    ${section(assetRows ? '6' : '5', 'Ongoing Monitoring Programme')}
    ${subsection('Monthly Tasks')}${list(d.monthly)}
    ${subsection('Quarterly Tasks')}${list(d.quarterly)}
    ${subsection('Annual Tasks')}${list(d.annually)}
  `, 5);

  // ── Page 6: Limitations, Legislation, Declaration ────────────────────────
  const p6 = page(`
    ${limitRows ? `${section('7', 'Assessment Limitations')}
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr>
        <th style="${thStyle}">Ref.</th><th style="${thStyle}">Limitation</th>
        <th style="${thStyle}">Action Required</th><th style="${thStyle}">Target</th>
      </tr></thead>
      <tbody>${limitRows}</tbody>
    </table>` : ''}

    ${section('8', 'Legislative Framework')}
    <ul style="margin:8px 0 16px;padding-left:18px">
      ${[
        'Health and Safety at Work etc. Act 1974',
        'Control of Substances Hazardous to Health Regulations 2002 (COSHH) — Regulation 12 and Schedule 3',
        'Management of Health and Safety at Work Regulations 1999',
        'HSE Approved Code of Practice L8 (4th Edition): Legionnaires\' disease — The control of legionella bacteria in water systems',
        'HSG 274: Legionnaires\' disease — Technical guidance (Parts 1, 2 and 3)',
        'BS 8580-1:2019: Water quality — Risk assessments for Legionella control — Code of practice',
      ].map(l => `<li style="font-size:11px;color:#374151;line-height:1.8;margin-bottom:2px">${l}</li>`).join('')}
    </ul>

    ${section('9', 'Declaration')}
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:16px">This risk assessment has been carried out by a competent person on behalf of Dorset Plumbing Ltd. The findings and recommendations are based on conditions observed at the time and date of survey only. Dorset Plumbing Ltd accepts no liability for changes in system condition, temperature, or microbiological status occurring after the date of this assessment. This report should be reviewed following any significant changes to the water system or occupancy, and at a minimum annually in accordance with ACOP L8. This document does not constitute legal advice; the duty holder should seek independent legal advice if required.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;max-width:480px">
      ${[
        ['Assessed by', assessor],
        ['On behalf of', 'Dorset Plumbing Ltd'],
        ['Competency ref.', 'Cert-ain Certification Ltd — Cert No. 95252/39577/58 (Valid to 13/06/2030)'],
        ['Assessment date', assessDate],
        ['Report date', assessDate],
        ['Next review due', reviewDate],
      ].map(([k,v],i) => `<tr style="background:${i%2===0?'#f9fafb':'#fff'}">
        <td style="padding:8px 12px;font-weight:700;font-size:10px;color:#374151;width:38%;border:1px solid #ddd">${k}</td>
        <td style="padding:8px 12px;font-size:11px;color:#111827;border:1px solid #ddd">${v}</td>
      </tr>`).join('')}
      <tr style="background:#fff">
        <td style="padding:8px 12px;font-weight:700;font-size:10px;color:#374151;border:1px solid #ddd">Signature</td>
        <td style="padding:28px 12px;border:1px solid #ddd"></td>
      </tr>
    </table>

    <div style="background:${DP_NAVY};color:#fff;padding:14px 18px;text-align:center">
      <div style="font-weight:700;font-size:12px;margin-bottom:3px">Dorset Plumbing Ltd &nbsp;|&nbsp; Gas Safe No. 943146 &nbsp;|&nbsp; Company Reg. 14237190</div>
      <div style="font-size:10px;opacity:0.85;line-height:1.8">Bayside Business Centre, 48 Willis Way, Poole, Dorset BH15 3TB<br/>
      Tel: 01202 668822 &nbsp;|&nbsp; Web: dorsetplumbing.com</div>
    </div>
  `, 6);

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
  <div class="no-print" style="text-align:center;padding:16px;background:#2C3E50;color:#fff;font-family:Arial,sans-serif;font-size:13px;font-weight:600;position:sticky;top:0;z-index:100">
    📄 Legionella Risk Assessment — ${siteName} &nbsp;·&nbsp;
    <button onclick="window.print()" style="background:#C0392B;color:#fff;border:none;padding:6px 18px;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px">🖨 Print / Save as PDF</button>
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
    ${pSchematic}
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