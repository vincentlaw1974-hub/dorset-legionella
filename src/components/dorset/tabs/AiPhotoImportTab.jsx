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
        const maxDimension = 1400;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      image.onerror = () => resolve(srcData);
      image.src = srcData;
    });
    const blob = await (await fetch(resized)).blob();
    const uploaded = await base44.integrations.Core.UploadFile({ file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }) });
    return uploaded.file_url;
  };

  const analysePhotoBatch = async (batchFiles, batchIndex, totalBatches) => {
    const fileUrls = [];
    for (const photoItem of batchFiles) {
      const url = await resizeAndUpload(photoItem);
      if (url) fileUrls.push(url);
    }

    const prompt = `You are an expert Legionella risk assessor for Dorset Plumbing (UK).
You are given ${fileUrls.length} site photos (batch ${batchIndex + 1} of ${totalBatches}) from a water system inspection at: ${job.site_name || job.client || 'a site'} (${job.property_type || 'Commercial'}).
${batchIndex === 0 && engineerNotes.trim() ? `\nENGINEER'S NOTES:\n${engineerNotes.trim()}\n` : ''}

Analyse every photo carefully and extract information to populate a Legionella risk assessment report.

Return ONLY valid JSON:
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
Rules: Only include items you can actually see. Return EMPTY arrays where nothing is visible. outlet types: WHB, Shower, Bath, Kitchen Sink, Cleaner Sink, Outside Tap, Pot Wash, TMV. photo kinds: Cover Photo, Temperature Reading, Outlet, CWST, TMV, Dead Leg, Shower Head, Plant Room, Defect, General.`;

    const llmResult = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: fileUrls,
      model: 'claude_sonnet_4_6',
    });

    const responseString = typeof llmResult === 'string' ? llmResult : JSON.stringify(llmResult);
    const match = responseString.match(/```(?:json)?\s*([\s\S]*?)```/) || responseString.match(/(\{[\s\S]*\})/);
    if (!match) return null;
    return JSON.parse(match[1]);
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
    // Deduplicate rooms by name
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
      const BATCH_SIZE = 10;
      setProcessedFiles(files);
      const batches = [];
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        batches.push(files.slice(i, i + BATCH_SIZE));
      }

      // If only notes, no photos
      if (files.length === 0) {
        batches.push([]);
      }

      setBatchProgress({ current: 0, total: batches.length });
      const batchResults = [];
      for (let i = 0; i < batches.length; i++) {
        setBatchProgress({ current: i + 1, total: batches.length });
        const batchResult = await analysePhotoBatch(batches[i], i, batches.length);
        batchResults.push(batchResult);
      }

      setResult(mergeResults(batchResults));
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
                  ? `Analysing batch ${batchProgress.current} of ${batchProgress.total}… please wait`
                  : 'Analysing… this may take 20–40 seconds'}
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