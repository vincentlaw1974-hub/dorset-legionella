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

      // 2. Single LLM call
      setProgress('Claude is writing the report — please wait 30–60 seconds…');

      const siteName = job.site_name || job.client || 'the site';
      const notesBlock = notes.trim() ? `\n\nENGINEER NOTES:\n${notes.trim()}` : '';

      const raw = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert Legionella risk assessor for Dorset Plumbing Ltd (UK). Write a full professional ACoP L8 / HSG274 risk assessment report.

Site: ${siteName} | Address: ${job.address || ''} | Type: ${job.property_type || 'Commercial'} | Date: ${job.assessment_date || new Date().toISOString().slice(0,10)}
Assessor: ${job.assessor || ''} | Responsible Person: ${job.responsible_person || ''} | Duty Holder: ${job.duty_holder || ''}${notesBlock}

Examine every photo and read every word of the notes. Extract ALL details.

Return ONLY a JSON object (no markdown fences) with these exact keys:
{
  "report_ref": "DLL-2026-XXX-001",
  "risk": "MEDIUM",
  "scope": "2-3 sentence paragraph on methodology and standards",
  "site_description": "detailed paragraph about the building and water systems",
  "population": "paragraph about who uses the building",
  "summary": "4-6 sentence executive summary",
  "outlets": [{"ref":"W01","location":"","type":"","tmv":"YES/NO/N/A","hot":"","cold":"","status":"PASS/FAIL/ADVISORY/N/A","notes":""}],
  "temp_notes": ["footnote explaining any advisory or fail"],
  "findings": [{"ref":"F01","title":"","location":"","risk":"HIGH/MEDIUM/LOW","timeframe":"IMMEDIATE/14 DAYS/1 MONTH/ROUTINE","detail":"2-4 sentence explanation of finding, why it matters under ACOP L8, and what must be done"}],
  "actions": [{"ref":"F01","summary":"","risk":"","action":"","priority":"","by_whom":""}],
  "monthly": ["bullet"],
  "quarterly": ["bullet"],
  "annually": ["bullet"],
  "limitations": [{"ref":"L01","limitation":"","action":"","target":""}],
  "photos": [{"idx":0,"fig":1,"caption":"what the photo shows"}]
}`,
        file_urls: uploaded.length > 0 ? uploaded.map(u => u.cdnUrl) : undefined,
        model: 'claude_sonnet_4_6',
      });

      // 3. Parse JSON
      setProgress('Building PDF…');
      let text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      // Strip any markdown fences just in case
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      // Find the JSON object
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('AI did not return valid JSON — try again');
      const data = JSON.parse(text.slice(start, end + 1));

      // 4. Build HTML and trigger download
      const html = buildReport(data, job, uploaded);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${siteName.replace(/\s+/g, '_')}_LRA.html`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 5000);

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
          ✅ Report downloaded — open the .html file in your browser, then File → Print → Save as PDF
        </div>
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

function badge(text, type) {
  const styles = {
    PASS: 'background:#dcfce7;color:#166534',
    FAIL: 'background:#fee2e2;color:#991b1b',
    ADVISORY: 'background:#fef3c7;color:#92400e',
    HIGH: 'background:#fee2e2;color:#991b1b',
    MEDIUM: 'background:#fef3c7;color:#92400e',
    LOW: 'background:#dcfce7;color:#166534',
    IMMEDIATE: 'background:#fee2e2;color:#991b1b',
    DEFAULT: 'background:#f3f4f6;color:#374151',
  };
  const s = styles[text] || styles[type] || styles.DEFAULT;
  return `<span style="${s};padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;display:inline-block">${text}</span>`;
}

function buildReport(d, job, uploaded) {
  const siteName = job.site_name || job.client || 'Site';
  const address = job.address || '';
  const assessDate = fmt(job.assessment_date) || fmt(new Date().toISOString().slice(0,10));
  const reviewDate = fmt(job.review_due) || (() => { const x = new Date(); x.setFullYear(x.getFullYear()+1); return fmt(x.toISOString().slice(0,10)); })();
  const ref = d.report_ref || job.report_ref || `DLL-${new Date().getFullYear()}-001`;
  const risk = (d.risk || 'MEDIUM').toUpperCase();
  const riskCol = risk === 'HIGH' ? '#c0392b' : risk === 'MEDIUM' ? '#d4770a' : '#1a6e1a';
  const assessor = job.assessor || 'Dorset Plumbing Ltd';
  const rp = d.responsible_person || job.responsible_person || '';
  const dh = d.duty_holder || job.duty_holder || rp;

  // Map photo index to dataUrl
  const photoData = {};
  (d.photos || []).forEach(p => {
    if (uploaded[p.idx]) photoData[p.fig] = { src: uploaded[p.idx].dataUrl, caption: p.caption };
  });

  const fig = (n) => photoData[n]
    ? `<div style="text-align:center;margin:12px 0"><img src="${photoData[n].src}" style="max-height:220px;max-width:100%;border:1px solid #ddd;border-radius:4px;display:inline-block"/><div style="font-size:9px;color:#666;margin-top:3px;font-style:italic">Fig. ${n} – ${photoData[n].caption}</div></div>`
    : '';

  const allFigs = Object.keys(photoData).map(Number).sort((a,b)=>a-b);

  const photoPairs = () => {
    let out = '';
    for (let i = 0; i < allFigs.length; i += 2) {
      const a = photoData[allFigs[i]], b = photoData[allFigs[i+1]];
      if (b) {
        out += `<table style="width:100%;border-collapse:collapse;margin:8px 0"><tr>
          <td style="width:50%;padding:4px;text-align:center;vertical-align:top"><img src="${a.src}" style="max-height:180px;max-width:100%;border:1px solid #ddd;border-radius:3px"/><div style="font-size:8.5px;color:#666;font-style:italic;margin-top:2px">Fig. ${allFigs[i]} – ${a.caption}</div></td>
          <td style="width:50%;padding:4px;text-align:center;vertical-align:top"><img src="${b.src}" style="max-height:180px;max-width:100%;border:1px solid #ddd;border-radius:3px"/><div style="font-size:8.5px;color:#666;font-style:italic;margin-top:2px">Fig. ${allFigs[i+1]} – ${b.caption}</div></td>
        </tr></table>`;
      } else {
        out += fig(allFigs[i]);
      }
    }
    return out;
  };

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#222;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .wrap{max-width:820px;margin:0 auto}
    .hdr{background:#b71c1c;padding:8px 20px;display:flex;justify-content:space-between;align-items:center}
    .hdr-l{color:#fff;font-weight:700;font-size:11px;letter-spacing:.4px}
    .hdr-r{color:#fff;font-size:9px;opacity:.9}
    .ftr{background:#f4f4f4;border-top:1px solid #ddd;padding:5px 20px;display:flex;justify-content:space-between;font-size:8.5px;color:#777;margin-top:20px}
    .body{padding:0 20px}
    .sec{color:#b71c1c;font-size:14px;font-weight:700;border-bottom:2px solid #b71c1c;padding-bottom:4px;margin:18px 0 10px}
    .sub{font-size:11px;font-weight:700;margin:12px 0 5px;color:#333}
    p{font-size:10.5px;line-height:1.7;margin-bottom:7px}
    table.t{width:100%;border-collapse:collapse;font-size:10px;margin:6px 0 10px}
    table.t th{background:#f5e6e6;padding:5px 7px;border:1px solid #ccc;font-weight:700;text-align:left}
    table.t td{padding:4px 7px;border:1px solid #ddd;vertical-align:top}
    table.t tr:nth-child(even) td{background:#fafafa}
    .fc{border:1px solid #e0e0e0;border-radius:4px;margin:8px 0;overflow:hidden}
    .fch{display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f9f9f9;border-bottom:1px solid #e0e0e0}
    .fref{background:#222;color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:2px}
    .ftitle{font-size:10.5px;font-weight:700;flex:1}
    .fcb{padding:9px 11px;font-size:10px;line-height:1.7;color:#333}
    ul.bl{padding-left:15px;margin:3px 0 7px}
    ul.bl li{font-size:10px;line-height:1.7;margin-bottom:1px}
    .pb{page-break-before:always}
    @media print{body{margin:0}.wrap{max-width:none}}
  `;

  const hdr = `<div class="hdr"><div class="hdr-l">DORSET LEGIONELLA LTD</div><div class="hdr-r">Legionella Risk Assessment &nbsp;|&nbsp; ${siteName}${address ? ', ' + address.split(',').slice(-1)[0].trim() : ''}</div></div>`;
  const ftr = (n) => `<div class="ftr"><span>Dorset Plumbing Ltd &nbsp;|&nbsp; 01202 668822 &nbsp;|&nbsp; dorsetplumbing.com &nbsp;|&nbsp; Bayside Business Centre, 48 Willis Way, Poole BH15 3TB</span><span>Page ${n}</span></div>`;

  // Cover photo
  const firstFig = allFigs[0];
  const coverPhoto = firstFig && photoData[firstFig]
    ? `<div style="text-align:center;padding:16px 20px 8px"><img src="${photoData[firstFig].src}" style="max-height:200px;max-width:95%;border:1px solid #ddd;border-radius:4px"/><div style="font-size:9px;color:#666;margin-top:3px;font-style:italic">Fig. 1 – ${photoData[firstFig].caption}</div></div>`
    : '';

  const outletRows = (d.outlets || []).map(o =>
    `<tr><td>${o.ref||''}</td><td>${o.location||''}</td><td>${o.type||''}</td><td>${o.tmv||''}</td><td>${o.hot||'—'}</td><td>${o.cold||'—'}</td><td>${badge(o.status||'N/A', o.status)}</td><td>${o.notes||''}</td></tr>`
  ).join('');

  const tempRows = (d.outlets||[]).filter(o=>o.hot||o.cold).map(o => {
    const target = (o.tmv||'').includes('YES') ? '38-43°C blended' : (o.type||'').toLowerCase().includes('cylinder') ? '>60°C store' : '>50°C';
    return `<tr><td>${o.ref}</td><td>${o.location}</td><td>${o.cold||'—'}</td><td>${o.hot||'—'}</td><td>${target}</td><td>${badge(o.status||'N/A', o.status)}</td></tr>`;
  }).join('');

  const findingCards = (d.findings||[]).map(f =>
    `<div class="fc"><div class="fch"><span class="fref">${f.ref}</span><span class="ftitle">${f.title}${f.location?` (${f.location})`:''}</span>${badge(f.risk||'MEDIUM', f.risk)} <span style="background:#fff3e0;color:#7c4000;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700">Action: ${f.timeframe||'ROUTINE'}</span></div><div class="fcb">${f.detail||''}</div></div>`
  ).join('');

  const actionRows = (d.actions||[]).map(a =>
    `<tr><td><b>${a.ref}</b></td><td>${a.summary||''}</td><td>${badge(a.risk||'MEDIUM', a.risk)}</td><td>${a.action||''}</td><td><b>${a.priority||''}</b></td><td>${a.by_whom||''}</td></tr>`
  ).join('');

  const limitRows = (d.limitations||[]).map(l =>
    `<tr><td>${l.ref}</td><td>${l.limitation}</td><td>${l.action}</td><td>${l.target}</td></tr>`
  ).join('');

  const list = (arr) => arr&&arr.length ? `<ul class="bl">${arr.map(x=>`<li>${x}</li>`).join('')}</ul>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Legionella Risk Assessment – ${siteName}</title><style>${css}</style></head><body><div class="wrap">

${hdr}
<div style="background:#c62828;padding:24px 20px 18px;color:#fff">
  <div style="font-size:20px;font-weight:700;margin-bottom:5px">LEGIONELLA RISK ASSESSMENT</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:3px">${siteName}</div>
  <div style="font-size:11px;opacity:.9">${address}</div>
</div>

${coverPhoto}

<div style="padding:0 20px 12px">
  <table class="t">
    <tr><td style="font-weight:700;width:38%;background:#fafafa">Client:</td><td>${job.client||siteName}</td></tr>
    ${rp?`<tr><td style="font-weight:700;background:#fafafa">Responsible Person:</td><td>${rp}</td></tr>`:''}
    ${dh?`<tr><td style="font-weight:700;background:#fafafa">Duty Holder:</td><td>${dh}</td></tr>`:''}
    <tr><td style="font-weight:700;background:#fafafa">Site Address:</td><td>${address||siteName}</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">Assessment Date:</td><td>${assessDate}</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">Report Reference:</td><td>${ref}</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">Assessed By:</td><td>${assessor}</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">Valid To:</td><td>${reviewDate} (annual review recommended)</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">Prepared By:</td><td>Dorset Plumbing Ltd</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">Standard:</td><td>HSE ACOP L8 (4th Ed.) | HSG 274 Parts 1-3 | BS 8580-1:2019</td></tr>
  </table>
  <div style="display:flex;border:1px solid #ddd;border-radius:4px;overflow:hidden;margin-top:4px">
    <div style="background:#222;color:#fff;padding:10px 16px;font-weight:700;font-size:11px;flex:1">OVERALL RISK RATING</div>
    <div style="background:${riskCol};color:#fff;padding:10px 20px;font-weight:700;font-size:13px">${risk}</div>
  </div>
</div>
${ftr(1)}

<div class="pb">${hdr}</div>
<div class="body">
  <div class="sec">1. Scope and Methodology</div>
  <p>${d.scope||'This Legionella Risk Assessment has been carried out in accordance with HSE Approved Code of Practice L8 (4th Edition), HSG 274 Parts 1-3, and BS 8580-1:2019.'}</p>
  <div class="sub">1.1 Site Description</div>
  <p>${d.site_description||''}</p>
  <div class="sub">1.2 Population at Risk</div>
  <p>${d.population||''}</p>
  <div class="sub">1.3 Executive Summary</div>
  <p>${d.summary||''}</p>
  <div class="sub">1.4 Water Outlet Register</div>
  <table class="t"><thead><tr><th>Ref.</th><th>Location</th><th>Outlet Type</th><th>TMV</th><th>Hot °C</th><th>Cold °C</th><th>Status</th><th>Notes</th></tr></thead><tbody>${outletRows}</tbody></table>
</div>
${ftr(2)}

<div class="pb">${hdr}</div>
<div class="body">
  <div class="sec">2. Temperature Monitoring Results</div>
  <p>Temperatures were measured at all accessible outlets using a calibrated digital thermometer after running water for one minute or until stable. Hot water at non-TMV outlets must reach ≥50°C. Cold water must remain ≤20°C. TMV blended outlets must deliver 38–43°C. Cylinders must store at ≥60°C.</p>
  <table class="t"><thead><tr><th>Ref.</th><th>Location / Outlet</th><th>Cold °C</th><th>Hot / Blended °C</th><th>Target</th><th>Status</th></tr></thead><tbody>${tempRows}</tbody></table>
  ${(d.temp_notes||[]).map(n=>`<p style="font-size:9.5px;color:#555">${n}</p>`).join('')}
  ${photoPairs()}
</div>
${ftr(3)}

<div class="pb">${hdr}</div>
<div class="body">
  <div class="sec">3. Findings and Identified Hazards</div>
  <p>The following hazards were identified during the survey. Risk is scored using the BS 8580-1:2019 matrix (Likelihood × Severity × Susceptibility).</p>
  ${findingCards}
</div>
${ftr(4)}

<div class="pb">${hdr}</div>
<div class="body">
  <div class="sec">4. Risk Summary and Action Plan</div>
  <p>The table below summarises all findings and required corrective actions. Progress should be recorded by the nominated Responsible Person.</p>
  <table class="t"><thead><tr><th>Ref.</th><th>Finding Summary</th><th>Risk</th><th>Action Required</th><th>Priority</th><th>By Whom</th></tr></thead><tbody>${actionRows}</tbody></table>

  <div class="sec">5. Ongoing Monitoring Recommendations</div>
  <div class="sub">5.1 Monthly</div>${list(d.monthly)}
  <div class="sub">5.2 Quarterly</div>${list(d.quarterly)}
  <div class="sub">5.3 Annually</div>${list(d.annually)}
</div>
${ftr(5)}

<div class="pb">${hdr}</div>
<div class="body">
  ${limitRows?`<div class="sec">6. Assessment Limitations</div><table class="t"><thead><tr><th>Ref.</th><th>Limitation</th><th>Action Required</th><th>Target</th></tr></thead><tbody>${limitRows}</tbody></table>`:''}

  <div class="sec">7. Legislative Framework</div>
  <ul class="bl">
    <li>Health and Safety at Work etc. Act 1974</li>
    <li>Control of Substances Hazardous to Health Regulations 2002 (COSHH) — Regulation 12 and Schedule 3</li>
    <li>Management of Health and Safety at Work Regulations 1999</li>
    <li>HSE Approved Code of Practice L8 (4th Edition): Legionnaires' disease — The control of legionella bacteria in water systems</li>
    <li>HSG 274: Legionnaires' disease — Technical guidance (Parts 1, 2 and 3)</li>
    <li>BS 8580-1:2019: Water quality — Risk assessments for Legionella control — Code of practice</li>
  </ul>

  <div class="sec">8. Declaration</div>
  <p>This risk assessment has been carried out by a competent person on behalf of Dorset Plumbing Ltd. The findings and recommendations are based on conditions observed at the time of survey. This report should be reviewed following any significant changes to the water system or occupancy, and at a minimum annually in accordance with ACOP L8.</p>
  <table class="t" style="max-width:380px;margin-top:10px">
    <tr><td style="font-weight:700;width:40%;background:#fafafa">Assessed by:</td><td>${assessor}</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">On behalf of:</td><td>Dorset Plumbing Ltd</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">Assessment date:</td><td>${assessDate}</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">Next review due:</td><td>${reviewDate}</td></tr>
    <tr><td style="font-weight:700;background:#fafafa">Signature:</td><td style="padding:22px 7px"></td></tr>
  </table>
  <div style="margin-top:18px;background:#2d3748;color:#fff;padding:11px 14px;border-radius:4px;text-align:center;font-size:10px;line-height:1.8">
    <strong>Dorset Plumbing Ltd</strong><br/>
    Bayside Business Centre, 48 Willis Way, Poole, Dorset BH15 3TB<br/>
    Tel: 01202 668822 &nbsp;|&nbsp; Web: dorsetplumbing.com
  </div>
</div>
${ftr(6)}

</div></body></html>`;
}