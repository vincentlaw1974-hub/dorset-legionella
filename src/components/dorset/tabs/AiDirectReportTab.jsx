import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fileToDataUrl } from '@/lib/photoUpload';

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function resizeImage(dataUrl) {
  return new Promise((resolve) => {
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
}

async function uploadResized(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const uploaded = await base44.integrations.Core.UploadFile({ file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }) });
  return uploaded.file_url;
}

export default function AiDirectReportTab({ job }) {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const addFiles = useCallback(async (newFiles) => {
    const images = [...newFiles].filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    const items = await Promise.all(images.map(async (f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      dataUrl: await fileToDataUrl(f),
    })));
    setFiles(prev => [...prev, ...items]);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleGenerate = async () => {
    if (!notes.trim() && files.length === 0) return;
    setStatus('uploading');
    setError('');

    try {
      // Upload all images
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${files.length}…`);
        const resized = await resizeImage(files[i].dataUrl);
        const url = await uploadResized(resized);
        uploadedUrls.push(url);
      }

      setStatus('analysing');
      setProgress('Analysing with Claude — this takes 20–40 seconds…');

      const siteName = job.site_name || job.client || 'the site';
      const propType = job.property_type || 'Commercial';
      const notesSection = notes.trim() ? `\n\n=== ENGINEER'S SITE NOTES ===\n${notes.trim()}\n=== END NOTES ===\n` : '';

      const prompt = `You are an expert Legionella risk assessor writing a full professional ACoP L8 / HSG274 Part 2 risk assessment report for Dorset Plumbing Ltd (UK).
Site: ${siteName} | Type: ${propType}${notesSection}

Read every word of the engineer's notes and examine every photo carefully. Produce a COMPLETE, DETAILED, PROFESSIONAL report as if you personally surveyed the site. Be thorough — write full paragraphs, not bullet summaries.

Return ONLY valid JSON with this EXACT structure:

{
  "report_ref": "DLL-${new Date().getFullYear()}-XXX-001",
  "risk": "LOW|MEDIUM|HIGH",
  "responsible_person": "name from notes or ''",
  "duty_holder": "name from notes or ''",
  "assessor": "name from notes or assessor from job",
  "scope_methodology": "Full professional paragraph describing how the assessment was carried out, what was inspected, standards followed (ACOP L8 4th Ed, HSG274 Parts 1-3, BS 8580-1:2019)",
  "site_description": "Detailed professional paragraph about the property — building type, age, condition, water system overview, hot and cold infrastructure, key observations",
  "population_at_risk": "Paragraph describing who uses the building and susceptibility rating",
  "summary": "4-6 sentence professional executive summary covering what was inspected, key findings, overall risk, and main actions",
  "monitoring_monthly": ["bullet 1", "bullet 2"],
  "monitoring_quarterly": ["bullet 1", "bullet 2"],
  "monitoring_annually": ["bullet 1", "bullet 2"],
  "outlets": [
    {
      "ref": "W01",
      "location": "exact location",
      "type": "outlet type e.g. Monobloc mixer tap — wall-hung basin",
      "tmv": "YES — confirmed | NO | N/A",
      "hot": "temperature number or —",
      "cold": "temperature number or —",
      "status": "PASS|FAIL|ADVISORY|N/A",
      "notes": "detailed notes"
    }
  ],
  "temperature_intro": "Professional paragraph explaining temperature monitoring methodology and pass/fail criteria",
  "temperature_notes": ["footnote 1 explaining any advisories or failures"],
  "findings": [
    {
      "ref": "F01",
      "title": "Short finding title",
      "location": "location reference e.g. W04",
      "risk": "LOW|MEDIUM|HIGH",
      "action_timeframe": "IMMEDIATE|14 DAYS|1 MONTH|ROUTINE",
      "detail": "Full 2-4 sentence professional explanation of the finding, why it matters under ACOP L8/HSG274, and what must be done"
    }
  ],
  "action_plan": [
    {
      "ref": "F01",
      "summary": "one-line finding summary",
      "risk": "LOW|MEDIUM|HIGH",
      "action": "specific action required",
      "priority": "IMMEDIATE|14 DAYS|1 MONTH|ROUTINE",
      "by_whom": "e.g. Competent Plumber"
    }
  ],
  "limitations": [
    {
      "ref": "L01",
      "limitation": "what was not verified",
      "action": "what should be done",
      "target": "timeframe or RESOLVED"
    }
  ],
  "photos": [
    {
      "url_index": 0,
      "fig_num": 1,
      "caption": "descriptive caption of what the photo shows"
    }
  ]
}

CRITICAL INSTRUCTIONS:
- findings must be DETAILED — each finding needs a full explanation paragraph (2-4 sentences minimum), not just a single sentence
- outlets must include EVERY outlet mentioned or visible — use W01, W02 refs
- action_plan must mirror findings (one row per finding)
- monitoring sections should be specific to this site and property type
- photos array: assign each uploaded photo a fig_num and write a specific caption based on what you actually see in each image
- report_ref: generate a realistic ref like DLL-${new Date().getFullYear()}-${(siteName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3))}-001`;

      const llmResult = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        model: 'claude_sonnet_4_6',
      });

      const str = typeof llmResult === 'string' ? llmResult : JSON.stringify(llmResult);
      const match = str.match(/```(?:json)?\s*([\s\S]*?)```/) || str.match(/(\{[\s\S]*\})/);
      if (!match) throw new Error('AI did not return valid JSON');
      const data = JSON.parse(match[1]);

      setProgress('Building report…');
      const html = buildHtmlReport(data, job, uploadedUrls, files);
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      setStatus('done');
      setProgress('');
    } catch (err) {
      setStatus('error');
      setError('Report generation failed: ' + err.message);
      setProgress('');
    }
  };

  const busy = status === 'uploading' || status === 'analysing';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div>
        <strong className="text-base block">📄 AI Direct Report</strong>
        <p className="text-xs text-gray-500 mt-0.5">Claude analyses your photos and notes and generates a complete professional PDF report — numbered sections, findings cards, action plan, monitoring schedule and declaration.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
      >
        <div className="text-3xl mb-1">📸</div>
        <div className="text-sm font-bold text-gray-700">Drop site photos here</div>
        <div className="text-xs text-gray-400 mt-0.5">{files.length > 0 ? `${files.length} photo${files.length !== 1 ? 's' : ''} selected` : 'or click to browse'}</div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {files.map(f => (
            <div key={f.id} className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-100">
              <img src={f.dataUrl} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))}
                className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 text-xs font-bold text-red-600 flex items-center justify-center shadow"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">📝 Engineer's notes <span className="text-gray-400 font-normal">(paste full site notes, temperature readings, observations)</span></label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Burridge Church Hall, 129 Alder Road, Poole. Responsible Person: Rebecca Bertrand. 2x unvented cylinders in plant room (Cordivari + Latetti), heat pump fed, both at 60°C. 6x mixed toilet cubicles all with TMVs — blended 37.4°C. Disabled WC thermostatic tap no TMV — 37.4°C. Gents' 2x WHB with TMVs — 37.4°C. Kitchen 5x sinks pillar taps hot 43°C cold 18°C FAIL. Kitchen handwash sensor tap 43°C. Hose union tap yellow connector under kitchen sink — backflow risk. TMV annual service overdue. No written scheme."
          rows={6}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 resize-y"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={busy || (files.length === 0 && !notes.trim())}
        className="w-full py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-50 transition-all"
        style={{ background: busy ? '#888' : '#d71920' }}
      >
        {busy
          ? <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              {progress || 'Working…'}
            </span>
          : `🤖 Generate Full Report${files.length > 0 ? ` from ${files.length} photo${files.length !== 1 ? 's' : ''}${notes.trim() ? ' + notes' : ''}` : notes.trim() ? ' from notes' : ''}`
        }
      </button>

      {status === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 font-semibold text-center">
          ✅ Report generated — check the new browser tab (use File → Print → Save as PDF)
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}

function buildHtmlReport(data, job, uploadedUrls, localFiles) {
  const siteName = job.site_name || job.client || 'Site';
  const address = job.address || '';
  const assessmentDate = job.assessment_date
    ? new Date(job.assessment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const reviewDate = job.review_due
    ? new Date(job.review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); })();
  const reportRef = data.report_ref || job.report_ref || `DLL-${new Date().getFullYear()}-001`;
  const risk = (data.risk || 'MEDIUM').toUpperCase();
  const riskColor = risk === 'HIGH' ? '#c0392b' : risk === 'MEDIUM' ? '#e67e22' : '#1a6e1a';
  const assessorName = data.assessor || job.assessor || 'Dorset Plumbing Ltd';
  const responsiblePerson = data.responsible_person || job.responsible_person || '';
  const dutyHolder = data.duty_holder || job.duty_holder || responsiblePerson;

  // Build photo map: index -> dataUrl (use local preview if available, fallback to uploaded URL)
  const photoMap = {};
  (uploadedUrls || []).forEach((url, i) => {
    photoMap[i] = (localFiles && localFiles[i]) ? localFiles[i].dataUrl : url;
  });

  // Photo lookup by fig_num
  const photosByFig = {};
  (data.photos || []).forEach(p => {
    if (p.url_index !== undefined && photoMap[p.url_index]) {
      photosByFig[p.fig_num] = { dataUrl: photoMap[p.url_index], caption: p.caption };
    }
  });

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Open Sans',Arial,sans-serif;font-size:10.5px;color:#222;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page-wrap{max-width:800px;margin:0 auto}
    /* Header bar */
    .hdr{background:#b71c1c;padding:8px 24px;display:flex;justify-content:space-between;align-items:center}
    .hdr-brand{color:#fff;font-size:11px;font-weight:700;letter-spacing:0.5px}
    .hdr-right{color:#fff;font-size:9px;text-align:right;opacity:0.9}
    /* Footer */
    .ftr{background:#f5f5f5;border-top:1px solid #ddd;padding:5px 24px;display:flex;justify-content:space-between;font-size:8.5px;color:#777;margin-top:24px}
    /* Cover */
    .cover-hero{background:#c62828;padding:28px 24px 20px;color:#fff}
    .cover-hero h1{font-size:22px;font-weight:700;margin-bottom:6px}
    .cover-hero h2{font-size:16px;font-weight:600;margin-bottom:4px}
    .cover-hero p{font-size:11px;opacity:0.9}
    .cover-photo{text-align:center;padding:16px 24px}
    .cover-photo img{max-height:200px;max-width:100%;border:1px solid #ddd;border-radius:4px}
    .cover-photo .fig-caption{font-size:9px;color:#666;margin-top:4px;font-style:italic}
    .cover-table{padding:0 24px 16px}
    .cover-table table{width:100%;border-collapse:collapse;font-size:10px}
    .cover-table td{padding:5px 8px;border:1px solid #e0e0e0}
    .cover-table td:first-child{font-weight:600;width:38%;background:#fafafa;color:#444}
    .risk-bar{margin:0 24px 0;display:flex;align-items:stretch;border:1px solid #ddd;border-radius:4px;overflow:hidden}
    .risk-bar-label{background:#2d2d2d;color:#fff;font-size:11px;font-weight:700;padding:10px 16px;display:flex;align-items:center;flex:1}
    .risk-bar-value{font-size:13px;font-weight:700;padding:10px 20px;display:flex;align-items:center;color:#fff}
    /* Body */
    .body{padding:0 24px}
    /* Section headings */
    .sec-h{color:#b71c1c;font-size:14px;font-weight:700;border-bottom:2px solid #b71c1c;padding-bottom:4px;margin:20px 0 10px}
    .sub-h{font-size:11px;font-weight:700;margin:12px 0 6px;color:#333}
    p{font-size:10.5px;line-height:1.7;margin-bottom:8px}
    /* Tables */
    table.data{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0 12px}
    table.data th{background:#f5e6e6;text-align:left;padding:6px 8px;border:1px solid #ccc;font-weight:700;color:#333}
    table.data td{padding:5px 8px;border:1px solid #ddd;vertical-align:top}
    table.data tr:nth-child(even) td{background:#fafafa}
    /* Status badges */
    .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;white-space:nowrap}
    .badge-pass{background:#dcfce7;color:#166534}
    .badge-fail{background:#fee2e2;color:#991b1b}
    .badge-advisory{background:#fef3c7;color:#92400e}
    .badge-na{background:#f5f5f5;color:#555}
    .badge-high{background:#fee2e2;color:#991b1b}
    .badge-medium{background:#fef3c7;color:#92400e}
    .badge-low{background:#dcfce7;color:#166534}
    /* Finding cards */
    .finding{border:1px solid #e0e0e0;border-radius:4px;margin:10px 0;overflow:hidden}
    .finding-hdr{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f9f9f9;border-bottom:1px solid #e0e0e0}
    .finding-ref{background:#2d2d2d;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:2px}
    .finding-title{font-size:10.5px;font-weight:700;flex:1}
    .finding-body{padding:10px 12px;font-size:10px;line-height:1.7;color:#333}
    /* Photo grids */
    .photo-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
    .photo-1col{text-align:center;margin:12px 0}
    .photo-box img{width:100%;max-height:180px;object-fit:cover;border:1px solid #ddd;border-radius:3px;display:block}
    .photo-box .fig-caption{font-size:8.5px;color:#666;margin-top:3px;font-style:italic;text-align:center}
    /* Lists */
    ul.bullets{padding-left:16px;margin:4px 0 8px}
    ul.bullets li{font-size:10px;line-height:1.7;margin-bottom:2px}
    /* Page breaks */
    .page-break{page-break-before:always}
    @media print{body{margin:0}.page-wrap{max-width:none}}
  `;

  const hdr = `<div class="hdr"><div class="hdr-brand">DORSET LEGIONELLA LTD</div><div class="hdr-right">Legionella Risk Assessment &nbsp;|&nbsp; ${siteName}${address ? ', ' + address.split(',').pop().trim() : ''}</div></div>`;
  const ftr = (pg) => `<div class="ftr"><span>Dorset Plumbing Ltd &nbsp;|&nbsp; 01202 668822 &nbsp;|&nbsp; dorsetplumbing.com &nbsp;|&nbsp; Bayside Business Centre, 48 Willis Way, Poole BH15 3TB</span><span>Page ${pg}</span></div>`;

  const photoFig = (figNum, width = '2col') => {
    const p = photosByFig[figNum];
    if (!p) return '';
    return `<div class="photo-box"><img src="${p.dataUrl}" alt="Fig. ${figNum}"/><div class="fig-caption">Fig. ${figNum} – ${p.caption}</div></div>`;
  };

  // Render all photos in pairs
  const renderPhotoPairs = () => {
    const figs = Object.keys(photosByFig).map(Number).sort((a, b) => a - b);
    if (!figs.length) return '';
    let html = '';
    for (let i = 0; i < figs.length; i += 2) {
      const a = photosByFig[figs[i]];
      const b = photosByFig[figs[i + 1]];
      if (b) {
        html += `<div class="photo-2col">${photoFig(figs[i])}${photoFig(figs[i + 1])}</div>`;
      } else {
        html += `<div class="photo-1col">${photoFig(figs[i])}</div>`;
      }
    }
    return html;
  };

  // Outlet status badge
  const statusBadge = (s) => {
    const cls = s === 'PASS' ? 'badge-pass' : s === 'FAIL' ? 'badge-fail' : s === 'ADVISORY' ? 'badge-advisory' : 'badge-na';
    return `<span class="badge ${cls}">${s}</span>`;
  };

  const riskBadge = (r) => {
    const cls = r === 'HIGH' ? 'badge-high' : r === 'MEDIUM' ? 'badge-medium' : 'badge-low';
    return `<span class="badge ${cls}">${r}</span>`;
  };

  // Outlet rows
  const outletRows = (data.outlets || []).map(o =>
    `<tr><td>${o.ref || ''}</td><td>${o.location || ''}</td><td>${o.type || ''}</td><td>${o.tmv || 'N/A'}</td><td>${o.hot || '—'}</td><td>${o.cold || '—'}</td><td>${statusBadge(o.status || 'N/A')}</td><td>${o.notes || '—'}</td></tr>`
  ).join('');

  // Temperature table notes
  const tempNotes = (data.temperature_notes || []).map((n, i) => `<p style="font-size:9.5px;color:#555;margin-top:4px">${n}</p>`).join('');

  // Findings
  const findingsHtml = (data.findings || []).map(f => `
    <div class="finding">
      <div class="finding-hdr">
        <span class="finding-ref">${f.ref}</span>
        <span class="finding-title">${f.title}${f.location ? ` (${f.location})` : ''}</span>
        ${riskBadge(f.risk || 'MEDIUM')}
        <span class="badge badge-na" style="background:#ffe8d6;color:#7c3c00">Action: ${f.action_timeframe || 'ROUTINE'}</span>
      </div>
      <div class="finding-body">${f.detail || ''}</div>
    </div>`).join('');

  // Action plan rows
  const actionRows = (data.action_plan || []).map(a =>
    `<tr><td><strong>${a.ref}</strong></td><td>${a.summary || ''}</td><td>${riskBadge(a.risk || 'MEDIUM')}</td><td>${a.action || ''}</td><td><strong>${a.priority || ''}</strong></td><td>${a.by_whom || ''}</td></tr>`
  ).join('');

  // Limitations
  const limitRows = (data.limitations || []).map(l =>
    `<tr><td>${l.ref}</td><td>${l.limitation}</td><td>${l.action}</td><td>${l.target}</td></tr>`
  ).join('');

  // Monitoring
  const monList = (arr) => arr && arr.length ? `<ul class="bullets">${arr.map(b => `<li>${b}</li>`).join('')}</ul>` : '';

  // Cover photo: first photo
  const firstFig = Object.keys(photosByFig).map(Number).sort((a, b) => a - b)[0];
  const coverPhotoHtml = firstFig ? `
    <div class="cover-photo">
      <img src="${photosByFig[firstFig].dataUrl}" alt="Site photo"/>
      <div class="fig-caption">Fig. 1 – ${photosByFig[firstFig].caption}</div>
    </div>` : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Legionella Risk Assessment – ${siteName}</title><style>${CSS}</style></head>
<body><div class="page-wrap">

${hdr}
<div class="cover-hero">
  <h1>LEGIONELLA RISK ASSESSMENT</h1>
  <h2>${siteName}</h2>
  <p>${address}</p>
</div>

${coverPhotoHtml}

<div class="cover-table">
  <table>
    <tr><td>Client:</td><td>${job.client || siteName}</td></tr>
    ${responsiblePerson ? `<tr><td>Responsible Person:</td><td>${responsiblePerson}</td></tr>` : ''}
    ${dutyHolder ? `<tr><td>Duty Holder:</td><td>${dutyHolder}</td></tr>` : ''}
    <tr><td>Site Address:</td><td>${address || siteName}</td></tr>
    <tr><td>Assessment Date:</td><td>${assessmentDate}</td></tr>
    <tr><td>Report Reference:</td><td>${reportRef}</td></tr>
    <tr><td>Assessed By:</td><td>${assessorName}</td></tr>
    <tr><td>Valid To:</td><td>${reviewDate} (annual review recommended)</td></tr>
    <tr><td>Prepared By:</td><td>Dorset Plumbing Ltd</td></tr>
    <tr><td>Standard:</td><td>HSE ACOP L8 (4th Ed.) | HSG 274 Parts 1-3 | BS 8580-1:2019</td></tr>
  </table>
</div>

<div class="risk-bar" style="margin:0 24px 20px">
  <div class="risk-bar-label">OVERALL RISK RATING</div>
  <div class="risk-bar-value" style="background:${riskColor}">${risk}</div>
</div>

${ftr(1)}

<!-- PAGE 2 — Scope & Outlets -->
<div class="page-break">${hdr}</div>
<div class="body">
  <div class="sec-h">1. Scope and Methodology</div>
  <p>${data.scope_methodology || `This Legionella Risk Assessment has been carried out in accordance with HSE Approved Code of Practice L8 (4th Edition), HSG 274 Parts 1-3, and BS 8580-1:2019. The survey was conducted by a competent person acting on behalf of Dorset Plumbing Ltd and included a visual inspection of all accessible water systems, temperature monitoring at all outlets, and a review of system condition and maintenance arrangements.`}</p>

  <div class="sub-h">1.1 Site Description</div>
  <p>${data.site_description || ''}</p>

  <div class="sub-h">1.2 Population at Risk</div>
  <p>${data.population_at_risk || ''}</p>

  <div class="sub-h">1.3 Water Outlet Register</div>
  <table class="data">
    <thead><tr><th>Ref.</th><th>Location</th><th>Outlet Type</th><th>TMV Fitted</th><th>Hot °C</th><th>Cold °C</th><th>Status</th><th>Notes</th></tr></thead>
    <tbody>${outletRows}</tbody>
  </table>
</div>
${ftr(2)}

<!-- PAGE 3 — Temperature -->
<div class="page-break">${hdr}</div>
<div class="body">
  <div class="sec-h">2. Temperature Monitoring Results</div>
  <p>${data.temperature_intro || 'Temperatures were measured at all accessible outlets using a calibrated digital thermometer after running water for one minute or until stable. Hot water at non-TMV outlets must reach 50°C or above within one minute. Cold water must remain below 20°C. TMV blended outlets should deliver 38–43°C. Cylinders must store at a minimum of 60°C.'}</p>

  <table class="data">
    <thead><tr><th>Ref.</th><th>Location / Outlet</th><th>Cold °C</th><th>Hot / Blended °C</th><th>Target</th><th>Status</th></tr></thead>
    <tbody>
      ${(data.outlets || []).filter(o => o.hot !== '—' || o.cold !== '—').map(o => {
        const target = o.tmv && o.tmv.includes('YES') ? '38-43°C blended' : o.type?.toLowerCase().includes('cylinder') ? '>60°C store' : '>50°C';
        return `<tr><td>${o.ref}</td><td>${o.location}</td><td>${o.cold || '—'}</td><td>${o.hot || '—'}</td><td>${target}</td><td>${statusBadge(o.status || 'N/A')}</td></tr>`;
      }).join('')}
    </tbody>
  </table>
  ${tempNotes}

  ${renderPhotoPairs()}
</div>
${ftr(3)}

<!-- PAGE 4 — Findings -->
<div class="page-break">${hdr}</div>
<div class="body">
  <div class="sec-h">3. Findings and Identified Hazards</div>
  <p>The following hazards were identified during the survey. Risk is scored using the BS 8580-1:2019 matrix (Likelihood × Severity × Susceptibility).</p>
  ${findingsHtml}
</div>
${ftr(4)}

<!-- PAGE 5 — Action Plan -->
<div class="page-break">${hdr}</div>
<div class="body">
  <div class="sec-h">4. Risk Summary and Action Plan</div>
  <p>The table below summarises all findings and required corrective actions. Progress should be recorded by the nominated Responsible Person.</p>
  <table class="data">
    <thead><tr><th>Ref.</th><th>Finding Summary</th><th>Risk</th><th>Action Required</th><th>Priority</th><th>By Whom</th></tr></thead>
    <tbody>${actionRows}</tbody>
  </table>

  <div class="sec-h">5. Ongoing Monitoring Recommendations</div>
  <div class="sub-h">5.1 Monthly</div>${monList(data.monitoring_monthly)}
  <div class="sub-h">5.2 Quarterly</div>${monList(data.monitoring_quarterly)}
  <div class="sub-h">5.3 Annually</div>${monList(data.monitoring_annually)}
</div>
${ftr(5)}

<!-- PAGE 6 — Limitations, Legislation, Declaration -->
<div class="page-break">${hdr}</div>
<div class="body">
  ${limitRows ? `
  <div class="sec-h">6. Assessment Limitations</div>
  <table class="data">
    <thead><tr><th>Ref.</th><th>Limitation</th><th>Action Required</th><th>Target</th></tr></thead>
    <tbody>${limitRows}</tbody>
  </table>` : ''}

  <div class="sec-h">7. Legislative Framework</div>
  <ul class="bullets">
    <li>Health and Safety at Work etc. Act 1974</li>
    <li>Control of Substances Hazardous to Health Regulations 2002 (COSHH) — Regulation 12 and Schedule 3</li>
    <li>Management of Health and Safety at Work Regulations 1999</li>
    <li>HSE Approved Code of Practice L8 (4th Edition): Legionnaires' disease — The control of legionella bacteria in water systems</li>
    <li>HSG 274: Legionnaires' disease — Technical guidance (Parts 1, 2 and 3)</li>
    <li>BS 8580-1:2019: Water quality — Risk assessments for Legionella control — Code of practice</li>
  </ul>

  <div class="sec-h">8. Declaration</div>
  <p>This risk assessment has been carried out by a competent person on behalf of Dorset Plumbing Ltd. The findings and recommendations are based on conditions observed at the time of survey. This report should be reviewed following any significant changes to the water system or occupancy, and at a minimum annually in accordance with ACOP L8.</p>

  <table class="data" style="margin-top:12px;max-width:400px">
    <tr><td style="font-weight:600;width:40%">Assessed by:</td><td>${assessorName}</td></tr>
    <tr><td style="font-weight:600">On behalf of:</td><td>Dorset Plumbing Ltd</td></tr>
    <tr><td style="font-weight:600">Assessment date:</td><td>${assessmentDate}</td></tr>
    <tr><td style="font-weight:600">Report date:</td><td>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
    <tr><td style="font-weight:600">Next review due:</td><td>${reviewDate}</td></tr>
    <tr><td style="font-weight:600">Signature:</td><td style="padding:20px 8px"></td></tr>
  </table>

  <div style="margin-top:20px;background:#2d3748;color:#fff;padding:12px 16px;border-radius:4px;text-align:center;font-size:10px">
    <strong>Dorset Plumbing Ltd</strong><br/>
    Bayside Business Centre, 48 Willis Way, Poole, Dorset BH15 3TB<br/>
    Tel: 01202 668822 &nbsp;|&nbsp; Web: dorsetplumbing.com
  </div>
</div>
${ftr(6)}

</div></body></html>`;
}