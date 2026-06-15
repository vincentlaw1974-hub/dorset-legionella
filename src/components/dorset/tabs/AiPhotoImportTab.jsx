import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { uid } from '@/lib/jobUtils';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';

export default function AiPhotoImportTab({ job, onChange }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [engineerNotes, setEngineerNotes] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState(false);
  const [processedFiles, setProcessedFiles] = useState([]);
  const inputRef = useRef();

  const addFiles = useCallback(async (newFiles) => {
    const imageFiles = [...newFiles].filter(fileItem => fileItem.type.startsWith('image/'));
    if (!imageFiles.length) return;
    setResult(null);
    setApplied(false);
    setError(null);

    const items = imageFiles.map(fileItem => ({ id: uid(), file: fileItem, dataUrl: null, cdnUrl: null, uploading: true }));
    setFiles(prev => [...prev, ...items]);

    await Promise.all(items.map(async (item) => {
      const dataUrl = await fileToDataUrl(item.file);
      item.dataUrl = dataUrl;
      setFiles(prev => prev.map(existing => existing.id === item.id ? { ...existing, dataUrl } : existing));

      const cdnUrl = await uploadToCdn(item.file).catch(() => null);
      item.cdnUrl = cdnUrl;
      setFiles(prev => prev.map(existing => existing.id === item.id ? { ...existing, cdnUrl, uploading: false } : existing));
    }));
  }, []);

  const handleDrop = useCallback((evt) => {
    evt.preventDefault();
    setDragOver(false);
    addFiles(evt.dataTransfer.files);
  }, [addFiles]);

  const handleFileInput = (evt) => {
    addFiles(evt.target.files);
    evt.target.value = '';
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(fileItem => fileItem.id !== fileId));
    setResult(null);
    setApplied(false);
  };

  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const resizeAndUpload = async (photoItem) => {
    const srcData = photoItem.dataUrl;
    if (!srcData) return null;
    const resized = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const maxDimension = 800;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      image.onerror = () => resolve(srcData);
      image.src = srcData;
    });
    const blob = await (await fetch(resized)).blob();
    const uploaded = await base44.integrations.Core.UploadFile({ file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }) });
    return uploaded.file_url;
  };

  const buildPrompt = (photoCount, batchIndex, totalBatches) => {
    const notesSection = engineerNotes.trim()
      ? `\n=== ENGINEER'S NOTES ===\n${engineerNotes.trim()}\n=== END NOTES ===\n`
      : '';
    const batchNote = totalBatches > 1 ? ` (photo batch ${batchIndex + 1} of ${totalBatches} — engineer's notes apply to the whole job)` : '';

    return `You are an expert Legionella risk assessor producing a full ACoP L8 / HSG274 Part 2 risk assessment report for Dorset Plumbing (UK).
Site: ${job.site_name || job.client || 'the site'} | Property type: ${job.property_type || 'Commercial'}${batchNote}
${notesSection}
INSTRUCTIONS — read every word of the engineer's notes and examine every photo. Extract the maximum possible detail:

OUTLETS: List EVERY outlet mentioned in the notes or visible in photos. For each one record the exact location, type, hot temp (number only e.g. "52"), cold temp (number only e.g. "18"), whether it has a TMV (true/false), whether it is infrequently used (true/false), and any defect notes. Read temperature gauge values precisely from photos.

ROOMS: List every room, floor, ward, or area mentioned anywhere in the notes or visible in photos.

SHOWERS: List every shower — location, condition (Good / Fair / Poor / Heavily Scaled), last descale date if mentioned, notes.

TMVs: List every TMV — ref if given, location, type (e.g. "Type 3"), condition, notes.

DEAD LEGS: Any redundant, capped, or seldom-used pipework branches.

ACTIONS: Raise a SPECIFIC remedial action for EVERY defect, temperature failure, missing record, or non-compliance. Priority: "1" = immediate risk (e.g. Legionella growth temp, no written scheme), "2" = within 1 month, "3" = within 3 months.

SITE DESCRIPTION: A thorough professional paragraph about the property, water systems, infrastructure, and key observations.

SUMMARY: A thorough professional executive summary (4–6 sentences) covering what was inspected, key findings, risk level, and the main actions required. Write as if it will appear verbatim in a formal report.

ISSUES TEXT: Every deficiency, non-compliance, and hazard found — one bullet per line starting with "•". Be specific (include locations and values).

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "site_description": "string",
  "summary": "string",
  "rooms": [{"name": "string"}],
  "outlets": [{"location": "string","type": "string","hot": "string","cold": "string","notes": "string","hasTmv": false,"infrequent": false}],
  "showers": [{"location": "string","condition": "string","notes": "string"}],
  "tmv_register": [{"ref": "string","location": "string","type": "string","condition": "string","notes": "string"}],
  "dead_legs": [{"location": "string","description": "string","pipe_material": "string"}],
  "issues_text": "string",
  "actions": [{"system": "string","observation": "string","action": "string","priority": "string"}],
  "photos": [{"caption": "string","kind": "string","location": "string"}]
}
Valid outlet types: WHB, Shower, Bath, Kitchen Sink, Cleaner Sink, Outside Tap, Pot Wash, TMV
Valid photo kinds: Cover Photo, Temperature Reading, Outlet, CWST, TMV, Dead Leg, Shower Head, Plant Room, Defect, General`;
  };

  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  const runLLM = async (fileUrls, batchIndex, totalBatches) => {
    const prompt = buildPrompt(fileUrls.length, batchIndex, totalBatches);
    // Try Claude first (best quality), fall back to GPT-4o on rate limit
    const models = ['claude_sonnet_4_6', 'gpt_5_4'];
    for (let i = 0; i < models.length; i++) {
      try {
        if (i > 0) await sleep(5000); // wait before fallback
        const llmResult = await base44.integrations.Core.InvokeLLM({
          prompt,
          file_urls: fileUrls.length > 0 ? fileUrls : undefined,
          model: models[i],
        });
        const responseString = typeof llmResult === 'string' ? llmResult : JSON.stringify(llmResult);
        const match = responseString.match(/```(?:json)?\s*([\s\S]*?)```/) || responseString.match(/(\{[\s\S]*\})/);
        if (!match) return null;
        return JSON.parse(match[1]);
      } catch (err) {
        const isRateLimit = err.message?.toLowerCase().includes('rate limit') || err.message?.includes('429');
        if (isRateLimit && i < models.length - 1) continue; // try next model
        throw err;
      }
    }
  };

  const mergeResults = (batchResults) => {
    const merged = { rooms: [], outlets: [], showers: [], tmv_register: [], dead_legs: [], actions: [], photos: [], issues_text: '', summary: '', site_description: '' };
    for (const r of batchResults) {
      if (!r) continue;
      merged.rooms.push(...(r.rooms || []));
      merged.outlets.push(...(r.outlets || []));
      merged.showers.push(...(r.showers || []));
      merged.tmv_register.push(...(r.tmv_register || []));
      merged.dead_legs.push(...(r.dead_legs || []));
      merged.actions.push(...(r.actions || []));
      merged.photos.push(...(r.photos || []));
      if (r.issues_text) merged.issues_text += (merged.issues_text ? '\n' : '') + r.issues_text;
      if (!merged.summary && r.summary) merged.summary = r.summary;
      if (!merged.site_description && r.site_description) merged.site_description = r.site_description;
    }
    const seen = new Set();
    merged.rooms = merged.rooms.filter(r => { if (seen.has(r.name)) return false; seen.add(r.name); return true; });
    return merged;
  };

  const handleAnalyse = async () => {
    if (files.length === 0 && !engineerNotes.trim()) return;
    setAnalysing(true);
    setError(null);
    setResult(null);

    try {
      setProcessedFiles(files);

      // Upload all photos first
      const allFileUrls = [];
      for (const photoItem of files) {
        setBatchProgress({ current: allFileUrls.length, total: files.length });
        const url = await resizeAndUpload(photoItem);
        if (url) allFileUrls.push(url);
      }

      // Split into batches of 8 for the LLM calls (smaller = less rate limit pressure)
      const BATCH_SIZE = 8;
      const batches = [];
      if (allFileUrls.length === 0) {
        batches.push([]); // notes-only
      } else {
        for (let i = 0; i < allFileUrls.length; i += BATCH_SIZE) {
          batches.push(allFileUrls.slice(i, i + BATCH_SIZE));
        }
      }

      setBatchProgress({ current: 0, total: batches.length });
      const batchResults = [];
      for (let i = 0; i < batches.length; i++) {
        setBatchProgress({ current: i + 1, total: batches.length });
        if (i > 0) await new Promise(res => setTimeout(res, 3000)); // 3s pause between batches
        const batchResult = await runLLM(batches[i], i, batches.length);
        batchResults.push(batchResult);
      }

      const merged = mergeResults(batchResults);

      // Always do a synthesis pass — for multi-batch to consolidate, for notes-only to get a richer output
      if (batches.length > 1 || (allFileUrls.length === 0 && engineerNotes.trim())) {
        setBatchProgress({ current: batches.length + 1, total: batches.length + 1 });
        const notesSection = engineerNotes.trim() ? `\n=== ENGINEER'S NOTES ===\n${engineerNotes.trim()}\n=== END NOTES ===\n` : '';
        const isNotesOnly = allFileUrls.length === 0;
        const synthResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an expert Legionella risk assessor producing a full ACoP L8 / HSG274 Part 2 risk assessment for Dorset Plumbing (UK).
Site: ${job.site_name || job.client || 'the site'} | Type: ${job.property_type || 'Commercial'}
${notesSection}
${isNotesOnly ? '' : `DATA EXTRACTED ACROSS ALL PHOTO BATCHES:
Outlets (${merged.outlets.length}): ${merged.outlets.map(o => `${o.location} ${o.type} H:${o.hot||'?'} C:${o.cold||'?'}`).join(' | ')}
Rooms: ${merged.rooms.map(r => r.name).join(', ') || 'none'}
Showers (${merged.showers.length}): ${merged.showers.map(s => `${s.location} ${s.condition}`).join(', ')}
TMVs (${merged.tmv_register.length}): ${merged.tmv_register.map(t => t.location).join(', ')}
Dead legs (${merged.dead_legs.length}): ${merged.dead_legs.map(d => d.location).join(', ')}
`}
Read every word of the engineer's notes. Extract EVERYTHING — every outlet with temperatures, every room, every TMV, every shower, every dead leg, every action item, every deficiency.

Return ONLY valid JSON — no markdown, no explanation:
{
  "summary": "thorough 4-6 sentence professional executive summary for a formal report",
  "site_description": "detailed professional paragraph about the property and water systems",
  "issues_text": "every deficiency and hazard, one per line starting with •",
  "rooms": [{"name": "string"}],
  "outlets": [{"location":"string","type":"string","hot":"string","cold":"string","notes":"string","hasTmv":false,"infrequent":false}],
  "showers": [{"location":"string","condition":"string","notes":"string"}],
  "tmv_register": [{"ref":"string","location":"string","type":"string","condition":"string","notes":"string"}],
  "dead_legs": [{"location":"string","description":"string","pipe_material":"string"}],
  "actions": [{"system":"string","observation":"string","action":"string","priority":"string"}]
}
outlet types: WHB, Shower, Bath, Kitchen Sink, Cleaner Sink, Outside Tap, Pot Wash, TMV
action priority: "1"=immediate, "2"=within 1 month, "3"=within 3 months`,
          model: 'claude_sonnet_4_6',
        });
        const synthStr = typeof synthResult === 'string' ? synthResult : JSON.stringify(synthResult);
        const synthMatch = synthStr.match(/```(?:json)?\s*([\s\S]*?)```/) || synthStr.match(/(\{[\s\S]*\})/);
        if (synthMatch) {
          const synth = JSON.parse(synthMatch[1]);
          if (synth.summary) merged.summary = synth.summary;
          if (synth.site_description) merged.site_description = synth.site_description;
          if (synth.issues_text) merged.issues_text = synth.issues_text;
          // For notes-only, the synthesis IS the primary extraction — replace everything
          if (isNotesOnly) {
            if (synth.rooms?.length) merged.rooms = synth.rooms;
            if (synth.outlets?.length) merged.outlets = synth.outlets;
            if (synth.showers?.length) merged.showers = synth.showers;
            if (synth.tmv_register?.length) merged.tmv_register = synth.tmv_register;
            if (synth.dead_legs?.length) merged.dead_legs = synth.dead_legs;
            if (synth.actions?.length) merged.actions = synth.actions;
          }
        }
      }

      setResult(merged);
    } catch (err) {
      setError('AI analysis failed: ' + err.message);
    } finally {
      setAnalysing(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  const handleApply = () => {
    if (!result) return;

    const updatedJob = { ...job };

    // Merge rooms (avoid duplicates by name)
    const existingRoomNames = new Set((job.rooms || []).map(roomItem => roomItem.name));
    const newRooms = (result.rooms || [])
      .filter(roomItem => roomItem.name && !existingRoomNames.has(roomItem.name))
      .map(roomItem => ({ id: uid(), name: roomItem.name }));
    if (newRooms.length) updatedJob.rooms = [...(job.rooms || []), ...newRooms];

    if ((result.outlets || []).length > 0) {
      updatedJob.outlets = [...(job.outlets || []), ...result.outlets.map(outlet => ({ id: uid(), ...outlet }))];
    }

    if ((result.showers || []).length > 0) {
      updatedJob.showers = [...(job.showers || []), ...result.showers.map(shower => ({ id: uid(), ...shower }))];
    }

    if ((result.tmv_register || []).length > 0) {
      const existingTmvCount = (job.tmv_register || []).length;
      updatedJob.tmv_register = [
        ...(job.tmv_register || []),
        ...result.tmv_register.map((tmvItem, tmvIndex) => ({
          id: uid(),
          ref: tmvItem.ref || `TMV-${String(existingTmvCount + tmvIndex + 1).padStart(2, '0')}`,
          ...tmvItem
        }))
      ];
    }

    if ((result.dead_legs || []).length > 0) {
      updatedJob.dead_legs = [...(job.dead_legs || []), ...result.dead_legs.map(deadLeg => ({ id: uid(), ...deadLeg }))];
    }

    if ((result.actions || []).length > 0) {
      const existingActionCount = (job.actions || []).length;
      updatedJob.actions = [
        ...(job.actions || []),
        ...result.actions.map((actionItem, actionIndex) => ({
          id: uid(),
          ref: `A${existingActionCount + actionIndex + 1}`,
          status: 'Open',
          responsible_person: job.responsible_person || '',
          deadline: '',
          ...actionItem
        }))
      ];
    }

    const validPhotoKinds = ['Cover Photo','Temperature Reading','Outlet','CWST','TMV','Dead Leg','Shower Head','Plant Room','Defect','General'];
    if (processedFiles.length > 0) {
      const newPhotos = processedFiles.map((photoFile, photoIndex) => {
        const photoMeta = (result.photos || [])[photoIndex] || {};
        return {
          id: photoFile.id,
          file_url: photoFile.cdnUrl || photoFile.dataUrl,
          kind: validPhotoKinds.includes(photoMeta.kind) ? photoMeta.kind : 'General',
          location: photoMeta.location || '',
          caption: photoMeta.caption || ''
        };
      });
      updatedJob.photos = [...(job.photos || []), ...newPhotos];
    }

    if (result.summary && !(job.summary || '').trim()) updatedJob.summary = result.summary;
    if (result.site_description && !(job.site_description || '').trim()) updatedJob.site_description = result.site_description;
    if (result.issues_text && !(job.issues_text || '').trim()) updatedJob.issues_text = result.issues_text;

    onChange(updatedJob);
    setApplied(true);
  };

  const uploadingCount = files.filter(photoFile => photoFile.uploading).length;
  const readyToAnalyse = (files.length > 0 || engineerNotes.trim().length > 0) && uploadingCount === 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div>
        <strong className="text-base block">🤖 AI Report Builder</strong>
        <p className="text-xs text-gray-500 mt-0.5">Drop site photos and/or paste engineer's notes — AI will auto-populate outlets, rooms, TMVs, actions, and summary.</p>
      </div>

      <div
        onDragOver={(evt) => { evt.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-red-500 bg-red-50 scale-[1.01]' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
      >
        <div className="text-3xl mb-1">📸</div>
        <div className="text-sm font-bold text-gray-700">Drag &amp; drop photos here</div>
        <div className="text-xs text-gray-400 mt-0.5">or click to browse — all formats supported</div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">📝 Engineer's notes <span className="text-gray-400 font-normal">(optional — paste or type site observations)</span></label>
        <textarea
          value={engineerNotes}
          onChange={e => { setEngineerNotes(e.target.value); setResult(null); setApplied(false); }}
          placeholder="e.g. Site has 3 floors. TMV in plant room needs servicing. Shower head in room 12 heavily scaled. Cold water tank on roof — no insulation. Temperature readings: WHB room 1 hot 48°C cold 19°C..."
          rows={5}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 resize-y"
        />
      </div>

      {files.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">{files.length} photo{files.length !== 1 ? 's' : ''} selected</span>
            <button onClick={() => { setFiles([]); setResult(null); setApplied(false); }} className="text-xs text-red-600 hover:underline">Clear all</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {files.map(photoFile => (
              <div key={photoFile.id} className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100 aspect-square">
                {photoFile.dataUrl ? (
                  <img src={photoFile.dataUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>
                )}
                {photoFile.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <button
                  onClick={(evt) => { evt.stopPropagation(); removeFile(photoFile.id); }}
                  className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 text-xs font-bold text-red-600 flex items-center justify-center shadow"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadingCount > 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          ⏫ Uploading {uploadingCount} photo{uploadingCount !== 1 ? 's' : ''}…
        </div>
      )}

      {(files.length > 0 || engineerNotes.trim()) && (
        <button
          onClick={handleAnalyse}
          disabled={!readyToAnalyse || analysing}
          className="w-full py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-50 transition-all"
          style={{ background: analysing ? '#888' : '#d71920' }}
        >
          {analysing
            ? <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                {batchProgress.total > 1
                  ? `Analysing batch ${batchProgress.current} of ${batchProgress.total}…`
                  : 'Analysing with full context… 20–40 seconds'}
              </span>
            : <span>✨ Analyse {[files.length > 0 ? `${files.length} photo${files.length !== 1 ? 's' : ''}` : '', engineerNotes.trim() ? 'notes' : ''].filter(Boolean).join(' + ')} &amp; build report
                {files.length > 10 && <span className="block text-xs font-normal opacity-80 mt-0.5">Will process in {Math.ceil(files.length / 10)} batches of 10</span>}
              </span>
          }
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <strong className="text-sm text-green-800 block mb-1">✅ AI analysis complete</strong>
            <div className="text-xs text-green-700 space-y-0.5">
              {result.rooms?.length > 0 && <div>🏠 {result.rooms.length} room{result.rooms.length !== 1 ? 's' : ''} identified</div>}
              {result.outlets?.length > 0 && <div>💧 {result.outlets.length} outlet{result.outlets.length !== 1 ? 's' : ''} identified</div>}
              {result.tmv_register?.length > 0 && <div>🔧 {result.tmv_register.length} TMV{result.tmv_register.length !== 1 ? 's' : ''} identified</div>}
              {result.showers?.length > 0 && <div>🚿 {result.showers.length} shower{result.showers.length !== 1 ? 's' : ''} identified</div>}
              {result.dead_legs?.length > 0 && <div>⚠️ {result.dead_legs.length} dead leg{result.dead_legs.length !== 1 ? 's' : ''} identified</div>}
              {result.actions?.length > 0 && <div>📋 {result.actions.length} action{result.actions.length !== 1 ? 's' : ''} raised</div>}
              {result.summary && <div>📝 Executive summary generated</div>}
            </div>
          </div>

          {result.summary && (
            <div className="border border-gray-200 rounded-xl p-3">
              <strong className="text-xs text-gray-500 uppercase block mb-1">Executive Summary</strong>
              <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
            </div>
          )}

          {result.issues_text && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
              <strong className="text-xs text-amber-700 uppercase block mb-1">Issues Identified</strong>
              <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{result.issues_text}</p>
            </div>
          )}

          {result.outlets?.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-3">
              <strong className="text-xs text-gray-500 uppercase block mb-2">Outlets Found</strong>
              <div className="space-y-1">
                {result.outlets.map((outletItem, outletIndex) => (
                  <div key={outletIndex} className="text-xs flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                    <span className="font-semibold w-24 truncate">{outletItem.location}</span>
                    <span className="text-gray-500">{outletItem.type}</span>
                    {outletItem.hot && <span className="text-red-600 font-mono">{outletItem.hot}°H</span>}
                    {outletItem.cold && <span className="text-blue-600 font-mono">{outletItem.cold}°C</span>}
                    {outletItem.notes && <span className="text-gray-400 truncate">{outletItem.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.actions?.length > 0 && (
            <div className="border border-red-100 bg-red-50 rounded-xl p-3">
              <strong className="text-xs text-red-700 uppercase block mb-2">Actions Raised</strong>
              <div className="space-y-1">
                {result.actions.map((actionItem, actionIndex) => (
                  <div key={actionIndex} className="text-xs border-b border-red-100 last:border-0 pb-1">
                    <span className={`inline-block w-4 h-4 rounded text-center font-bold mr-1 text-white text-[10px] leading-4 ${actionItem.priority === '1' ? 'bg-red-600' : actionItem.priority === '2' ? 'bg-amber-500' : 'bg-gray-400'}`}>{actionItem.priority}</span>
                    <strong>{actionItem.system}</strong> — {actionItem.action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {applied ? (
            <div className="bg-green-50 border border-green-300 rounded-2xl px-4 py-3 text-sm font-bold text-green-800 text-center">
              ✅ Applied to report — check Outlets, Rooms, Actions tabs
            </div>
          ) : (
            <button
              onClick={handleApply}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm"
              style={{ background: '#16a34a' }}
            >
              ✅ Apply all to report
            </button>
          )}
        </div>
      )}
    </div>
  );
}