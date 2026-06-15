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
  const [status, setStatus] = useState('idle'); // idle | uploading | analysing | done | error
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

      // Split into batches of 8
      const BATCH = 8;
      const batches = [];
      if (uploadedUrls.length === 0) {
        batches.push([]);
      } else {
        for (let i = 0; i < uploadedUrls.length; i += BATCH) {
          batches.push(uploadedUrls.slice(i, i + BATCH));
        }
      }

      const siteName = job.site_name || job.client || 'the site';
      const propType = job.property_type || 'Commercial';
      const notesSection = notes.trim() ? `\n\n=== ENGINEER'S SITE NOTES ===\n${notes.trim()}\n=== END NOTES ===\n` : '';

      const batchPrompt = (batchIdx, total) => `You are an expert Legionella risk assessor writing a full ACoP L8 / HSG274 Part 2 risk assessment report for Dorset Plumbing (UK).
Site: ${siteName} | Type: ${propType}${total > 1 ? ` | Photo batch ${batchIdx + 1} of ${total}` : ''}${notesSection}

Read every word of the engineer's notes and examine every photo carefully. Extract maximum detail:

- OUTLETS: Every outlet visible or mentioned. Location, type (WHB/Shower/Bath/Kitchen Sink/Cleaner Sink/Outside Tap/Pot Wash/TMV), hot temp, cold temp, TMV present (true/false), infrequent use (true/false), notes.
- ROOMS: Every room, floor, ward, area mentioned anywhere.
- SHOWERS: Every shower — location, condition (Good/Fair/Poor/Heavily Scaled), notes.
- TMVs: Every TMV — location, type, condition, ref if visible.
- DEAD LEGS: Any redundant, capped, seldom-used branches.
- ACTIONS: One action per defect, temperature failure, missing record or non-compliance. Priority: 1=immediate, 2=within 1 month, 3=within 3 months.
- SITE DESCRIPTION: A professional paragraph about the property, water infrastructure, and key observations.
- SUMMARY: 4–6 sentence professional executive summary — what was inspected, key findings, risk level, main actions required.
- ISSUES TEXT: Every deficiency — one bullet per line starting with •

Return ONLY valid JSON:
{
  "site_description": "string",
  "summary": "string",
  "risk": "LOW|MEDIUM|HIGH",
  "rooms": [{"name":"string"}],
  "outlets": [{"location":"string","type":"string","hot":"string","cold":"string","notes":"string","hasTmv":false,"infrequent":false}],
  "showers": [{"location":"string","condition":"string","notes":"string"}],
  "tmv_register": [{"ref":"string","location":"string","type":"string","condition":"string","notes":"string"}],
  "dead_legs": [{"location":"string","description":"string","pipe_material":"string"}],
  "issues_text": "string",
  "actions": [{"system":"string","observation":"string","action":"string","priority":"string"}]
}`;

      const batchResults = [];
      for (let i = 0; i < batches.length; i++) {
        setProgress(`Analysing batch ${i + 1} of ${batches.length}…`);
        if (i > 0) await sleep(4000);
        const llmResult = await base44.integrations.Core.InvokeLLM({
          prompt: batchPrompt(i, batches.length),
          file_urls: batches[i].length > 0 ? batches[i] : undefined,
          model: 'claude_sonnet_4_6',
        });
        const str = typeof llmResult === 'string' ? llmResult : JSON.stringify(llmResult);
        const match = str.match(/```(?:json)?\s*([\s\S]*?)```/) || str.match(/(\{[\s\S]*\})/);
        if (match) batchResults.push(JSON.parse(match[1]));
      }

      // Merge all batches
      const merged = { rooms: [], outlets: [], showers: [], tmv_register: [], dead_legs: [], actions: [], issues_text: '', summary: '', site_description: '', risk: 'MEDIUM' };
      for (const r of batchResults) {
        if (!r) continue;
        merged.rooms.push(...(r.rooms || []));
        merged.outlets.push(...(r.outlets || []));
        merged.showers.push(...(r.showers || []));
        merged.tmv_register.push(...(r.tmv_register || []));
        merged.dead_legs.push(...(r.dead_legs || []));
        merged.actions.push(...(r.actions || []));
        if (r.issues_text) merged.issues_text += (merged.issues_text ? '\n' : '') + r.issues_text;
        if (!merged.summary && r.summary) merged.summary = r.summary;
        if (!merged.site_description && r.site_description) merged.site_description = r.site_description;
        if (r.risk) merged.risk = r.risk;
      }

      // Synthesis pass if multiple batches or notes-only
      if (batches.length > 1 || (uploadedUrls.length === 0 && notes.trim())) {
        setProgress('Synthesising full report…');
        await sleep(2000);
        const synthResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an expert Legionella risk assessor. Produce a complete standalone report for Dorset Plumbing.
Site: ${siteName} | Type: ${propType}${notesSection}

Data extracted:
Outlets (${merged.outlets.length}): ${merged.outlets.map(o => `${o.location} ${o.type} H:${o.hot||'?'} C:${o.cold||'?'}`).join(' | ') || 'none'}
Rooms: ${merged.rooms.map(r => r.name).join(', ') || 'none'}
Showers (${merged.showers.length}): ${merged.showers.map(s => `${s.location} ${s.condition}`).join(', ') || 'none'}
TMVs (${merged.tmv_register.length}): ${merged.tmv_register.map(t => t.location).join(', ') || 'none'}
Dead legs (${merged.dead_legs.length}): ${merged.dead_legs.map(d => d.location).join(', ') || 'none'}
Actions (${merged.actions.length}) raised.

Write the definitive consolidated report. Return ONLY valid JSON:
{
  "site_description": "string",
  "summary": "4–6 sentence executive summary",
  "risk": "LOW|MEDIUM|HIGH",
  "issues_text": "all deficiencies, one bullet per line starting with •",
  "compliance_notes": "string",
  "rooms": [{"name":"string"}],
  "outlets": [{"location":"string","type":"string","hot":"string","cold":"string","notes":"string","hasTmv":false,"infrequent":false}],
  "showers": [{"location":"string","condition":"string","notes":"string"}],
  "tmv_register": [{"ref":"string","location":"string","type":"string","condition":"string","notes":"string"}],
  "dead_legs": [{"location":"string","description":"string","pipe_material":"string"}],
  "actions": [{"system":"string","observation":"string","action":"string","priority":"string"}]
}`,
          model: 'claude_sonnet_4_6',
        });
        const synthStr = typeof synthResult === 'string' ? synthResult : JSON.stringify(synthResult);
        const synthMatch = synthStr.match(/```(?:json)?\s*([\s\S]*?)```/) || synthStr.match(/(\{[\s\S]*\})/);
        if (synthMatch) {
          const synth = JSON.parse(synthMatch[1]);
          Object.assign(merged, synth);
        }
      }

      // Build and open the HTML report
      setProgress('Building report…');
      const html = buildHtmlReport(merged, job, uploadedUrls);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
        win.addEventListener('load', () => {
          setTimeout(() => { win.focus(); win.print(); URL.revokeObjectURL(url); }, 600);
        });
      }

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
        <p className="text-xs text-gray-500 mt-0.5">Claude analyses your photos and notes and generates a complete standalone PDF report — no manual data entry needed.</p>
      </div>

      {/* Drop zone */}
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
          placeholder="e.g. 3-storey nursing home. CWST in loft — no insulation. HW cylinder 58°C. Room 1 WHB hot 47°C cold 18°C. TMV in plant room needs service. Shower head room 4 heavily scaled..."
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
          ✅ Report generated — check the new browser tab (print/save as PDF from there)
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}

function buildHtmlReport(data, job, photoUrls) {
  const siteName = job.site_name || job.client || 'Site';
  const assessmentDate = job.assessment_date || new Date().toISOString().slice(0, 10);
  const reportRef = job.report_ref || siteName.replace(/\s+/g, '-') + '-' + assessmentDate;
  const risk = (data.risk || 'MEDIUM').toUpperCase();
  const riskColor = risk === 'HIGH' ? '#c0392b' : risk === 'MEDIUM' ? '#e67e22' : '#1a6e1a';

  const CSS = `*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:0 0 10mm}.header{background:#1a1a1a;padding:10px 20mm;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.header h1{margin:0;font-size:22px;font-weight:900;color:#fff}.header p{margin:2px 0 0;font-size:9px;color:#d71920;font-weight:600}.ref{font-size:9px;color:#aaa}.body{padding:0 20mm}.section{background:#1d1d1d;color:#fff;padding:6px 10px;font-size:11px;font-weight:bold;margin:14px 0 8px;border-left:4px solid #d71920}table{width:100%;border-collapse:collapse;font-size:10px;margin-top:4px}th{background:#f5e6e6;text-align:left;padding:5px 6px;border:1px solid #ccc;font-weight:bold}td{padding:4px 6px;border:1px solid #ddd;vertical-align:top}tr:nth-child(even) td{background:#fafafa}.footer{margin-top:20px;background:#f0f0f0;padding:6px 20mm;display:flex;justify-content:space-between;font-size:9px;color:#666}.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}@media print{body{margin:0}}`;

  const header = (pageLabel) => `<div class="header"><div><h1>Dorset Plumbing</h1><p>Gas Safe Registered · Legionella Risk Assessment</p></div><div class="ref">Ref: ${reportRef} | ${pageLabel}</div></div>`;
  const footer = (label) => `<div class="footer"><span>Dorset Plumbing · Legionella Risk Assessment · ${siteName} · ${assessmentDate}</span><span>${label}</span></div>`;

  // Outlet rows
  const outletRows = (data.outlets || []).map((o, i) => {
    const hot = parseFloat(o.hot), cold = parseFloat(o.cold);
    const hotFail = !isNaN(hot) && o.type !== 'Outside Tap' && !o.hasTmv && hot < 50;
    const coldFail = !isNaN(cold) && cold > 20;
    const status = hotFail || coldFail ? 'FAIL' : (!isNaN(hot) || !isNaN(cold)) ? 'PASS' : '—';
    const statusBg = status === 'FAIL' ? '#fee2e2;color:#991b1b' : status === 'PASS' ? '#dcfce7;color:#166534' : '#f5f5f5;color:#555';
    return `<tr><td>${o.location||''}</td><td>${o.type||''}</td><td>${o.hot||'—'}</td><td>${o.cold||'—'}</td><td>${o.hasTmv?'✓':''}</td><td><span style="background:${statusBg};padding:2px 6px;border-radius:99px;font-weight:bold;font-size:9px">${status}</span></td><td>${o.notes||'—'}</td></tr>`;
  }).join('');

  const actionRows = (data.actions || []).map((a, i) => {
    const pBg = a.priority === '1' ? '#fee2e2;color:#991b1b' : a.priority === '2' ? '#fef3c7;color:#92400e' : '#f5f5f5;color:#333';
    return `<tr><td>A${i + 1}</td><td>${a.system||''}</td><td><span style="background:${pBg};padding:2px 5px;border-radius:4px;font-weight:bold">${a.priority||''}</span></td><td>${a.observation||''}</td><td>${a.action||''}</td></tr>`;
  }).join('');

  const showerRows = (data.showers || []).map(s => `<tr><td>${s.location||''}</td><td>${s.condition||''}</td><td>${s.notes||''}</td></tr>`).join('');
  const tmvRows = (data.tmv_register || []).map(t => `<tr><td>${t.ref||'—'}</td><td>${t.location||''}</td><td>${t.type||''}</td><td>${t.condition||''}</td><td>${t.notes||''}</td></tr>`).join('');
  const deadLegRows = (data.dead_legs || []).map(d => `<tr><td>${d.location||''}</td><td>${d.description||''}</td><td>${d.pipe_material||'—'}</td></tr>`).join('');

  const photoGrid = photoUrls.map(url => `<div style="border:1px solid #ddd;border-radius:6px;overflow:hidden"><img src="${url}" style="width:100%;height:150px;object-fit:contain;background:#f5f5f5;display:block"/></div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Legionella Risk Assessment – ${siteName}</title><style>${CSS}</style></head><body>

<div class="page">
  ${header('Cover')}
  <div class="body">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div style="border:1px solid #ddd;padding:12px;border-radius:6px">
        <div style="font-size:9px;color:#888;font-weight:bold;text-transform:uppercase;margin-bottom:4px">Site Details</div>
        <div style="font-size:18px;font-weight:900">${siteName}</div>
        <div style="font-size:10px;color:#444;margin-top:4px">${job.address || ''}</div>
        <div style="margin-top:8px;font-size:10px">${job.client ? `Client: ${job.client}` : ''}</div>
        <div style="font-size:10px">${job.assessor ? `Assessor: ${job.assessor}` : ''}</div>
        <div style="font-size:10px">Property Type: ${job.property_type || '—'}</div>
        <div style="font-size:10px">Assessment Date: ${assessmentDate}</div>
        <div style="font-size:10px">Report Ref: ${reportRef}</div>
      </div>
      <div style="background:${riskColor};padding:14px;border-radius:6px;color:#fff">
        <div style="font-size:9px;font-weight:bold;text-transform:uppercase;opacity:0.85;margin-bottom:4px">Overall Risk Rating</div>
        <div style="font-size:48px;font-weight:900;line-height:1">${risk}</div>
        <div style="font-size:10px;margin-top:8px;opacity:0.9">${data.outlets.length} outlets inspected</div>
        <div style="font-size:10px;opacity:0.9">${data.actions.length} remedial actions raised</div>
        <div style="font-size:10px;opacity:0.9">Review Due: ${job.review_due || 'See report'}</div>
      </div>
    </div>

    <div class="section">Executive Summary</div>
    <p style="font-size:11px;line-height:1.7">${data.summary || 'See full report.'}</p>

    ${data.site_description ? `<div class="section">Site Description</div><p style="font-size:10.5px;line-height:1.7">${data.site_description}</p>` : ''}

    ${data.issues_text ? `<div class="section">Issues & Findings</div><div style="font-size:10px;line-height:1.7;white-space:pre-line">${data.issues_text}</div>` : ''}
  </div>
  ${footer('Page 1')}
</div>

${outletRows ? `<div class="page" style="page-break-before:always">
  ${header('Outlet Register')}
  <div class="body">
    <div class="section">Outlet Temperature Register (${data.outlets.length} outlets)</div>
    <table><thead><tr><th>Location</th><th>Type</th><th>Hot °C</th><th>Cold °C</th><th>TMV</th><th>Status</th><th>Notes</th></tr></thead><tbody>${outletRows}</tbody></table>
    <p style="font-size:9px;color:#666;margin-top:6px">Temperature benchmarks: hot outlets ≥50°C (≥55°C CQC), cold outlets ≤20°C, hot water storage ≥60°C.</p>
  </div>
  ${footer('Outlet Register')}
</div>` : ''}

${actionRows ? `<div class="page" style="page-break-before:always">
  ${header('Remedial Actions')}
  <div class="body">
    <div class="section">Remedial Actions (${data.actions.length} actions)</div>
    <table><thead><tr><th>Ref</th><th>System</th><th>Priority</th><th>Observation</th><th>Action Required</th></tr></thead><tbody>${actionRows}</tbody></table>
    <p style="font-size:9px;color:#666;margin-top:6px">Priority 1 = Immediate action required. Priority 2 = Within 1 month. Priority 3 = Within 3 months.</p>
  </div>
  ${footer('Remedial Actions')}
</div>` : ''}

${(showerRows || tmvRows || deadLegRows) ? `<div class="page" style="page-break-before:always">
  ${header('Registers')}
  <div class="body">
    ${showerRows ? `<div class="section">Shower Head Register (${data.showers.length})</div><table><thead><tr><th>Location</th><th>Condition</th><th>Notes</th></tr></thead><tbody>${showerRows}</tbody></table>` : ''}
    ${tmvRows ? `<div class="section">TMV Register (${data.tmv_register.length})</div><table><thead><tr><th>Ref</th><th>Location</th><th>Type</th><th>Condition</th><th>Notes</th></tr></thead><tbody>${tmvRows}</tbody></table>` : ''}
    ${deadLegRows ? `<div class="section">Dead Legs Register (${data.dead_legs.length})</div><table><thead><tr><th>Location</th><th>Description</th><th>Pipe Material</th></tr></thead><tbody>${deadLegRows}</tbody></table>` : ''}
  </div>
  ${footer('Registers')}
</div>` : ''}

${photoUrls.length > 0 ? `<div class="page" style="page-break-before:always">
  ${header('Photo Evidence')}
  <div class="body">
    <div class="section">Photo Evidence (${photoUrls.length} photos)</div>
    <div class="photo-grid">${photoGrid}</div>
  </div>
  ${footer('Photos')}
</div>` : ''}

<div class="page" style="page-break-before:always">
  ${header('Declaration')}
  <div class="body">
    <div class="section">Legal Framework & Assessor Declaration</div>
    <p style="font-size:10px;line-height:1.7">This Legionella Risk Assessment has been prepared in accordance with the Health and Safety at Work etc. Act 1974, COSHH Regulations 2002, ACOP L8 (Fourth Edition), HSG274 Parts 1–3, and BS 8580-1:2019. This assessment represents a point-in-time, visual, non-intrusive survey. It does not guarantee the absence of Legionella bacteria and does not constitute a Written Scheme of Control. The duty holder is responsible for implementing all remedial actions within the stated timescales and maintaining all required records.</p>
    <div style="margin-top:14px;padding:8px 10px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;font-size:9px;color:#166534">
      <strong>Document Control:</strong> Ref: ${reportRef} | Prepared by: Dorset Plumbing | Assessment Date: ${assessmentDate} | Generated by AI from engineer photos and notes
    </div>
  </div>
  ${footer('Declaration')}
</div>

</body></html>`;
}