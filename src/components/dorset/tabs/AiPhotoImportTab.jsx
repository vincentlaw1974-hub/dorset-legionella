import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { uid, today } from '@/lib/jobUtils';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function resizeImage(dataUrl, maxDim = 1500) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function analysePhotos(photoItems, job) {
  // Resize images to max 1400px, then upload resized versions to CDN for the API
  const fileUrls = await Promise.all(
    photoItems.map(async (p) => {
      const src = p.dataUrl;
      if (!src) return null;
      // Resize to stay under 2000px API limit
      const resized = await resizeImage(src, 1400);
      // Convert base64 data URL to a Blob/File and upload to CDN
      const res = await fetch(resized);
      const blob = await res.blob();
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    })
  ).then(urls => urls.filter(Boolean));

  const prompt = `You are an expert Legionella risk assessor for Dorset Plumbing (UK).
You are given ${photoItems.length} site photos from a water system inspection at: ${job.site_name || job.client || 'a site'} (${job.property_type || 'Commercial'}).

Analyse every photo carefully and extract as much information as possible to populate a Legionella risk assessment report.

Return ONLY valid JSON matching this schema exactly:
{
  "site_description": "string — 1-2 sentence description of the site/premises from what you can see",
  "summary": "string — 3-4 sentence professional executive summary based on the photos",
  "rooms": [{"name": "string"}],
  "outlets": [
    {
      "location": "string — room or area name",
      "type": "string — one of: WHB, Shower, Bath, Kitchen Sink, Cleaner Sink, Outside Tap, Pot Wash, TMV",
      "hot": "string — temperature reading in °C if visible on thermometer, else empty string",
      "cold": "string — cold temp if visible, else empty string",
      "notes": "string — any observations (scale, condition, limescale, etc.)",
      "hasTmv": false,
      "infrequent": false
    }
  ],
  "showers": [
    {
      "location": "string",
      "condition": "string — Good / Fair / Poor",
      "notes": "string"
    }
  ],
  "tmv_register": [
    {
      "ref": "string — e.g. TMV-01",
      "location": "string",
      "type": "string — e.g. TMV3, TMV2, Thermostatic Bar Valve",
      "condition": "string — Good / Fair / Poor",
      "notes": "string"
    }
  ],
  "dead_legs": [
    {
      "location": "string",
      "description": "string",
      "pipe_material": "string — Copper / CPVC / Plastic / Unknown"
    }
  ],
  "issues_text": "string — bullet points of observations and concerns",
  "actions": [
    {
      "system": "string",
      "observation": "string",
      "action": "string — recommended remedial action",
      "priority": "string — 1 (high) / 2 (medium) / 3 (low)"
    }
  ],
  "photos": [
    {
      "caption": "string — brief description of what the photo shows",
      "kind": "string — one of: Cover Photo, Temperature Reading, Outlet, CWST, TMV, Dead Leg, Shower Head, Plant Room, Defect, General",
      "location": "string — room or area if identifiable"
    }
  ]
}

Rules:
- Only include items you can actually see or confidently infer from the photos.
- For temperature readings, only enter a value if a thermometer/display is clearly visible.
- Be precise about locations if signage or room labels are visible.
- "actions" should include any issues that need remediation.
- Return EMPTY arrays for sections where nothing relevant is visible.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: fileUrls,
    model: 'claude_sonnet_4_6',
    response_json_schema: {
      type: 'object',
      properties: {
        site_description: { type: 'string' },
        summary: { type: 'string' },
        rooms: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } } } },
        outlets: { type: 'array', items: { type: 'object' } },
        showers: { type: 'array', items: { type: 'object' } },
        tmv_register: { type: 'array', items: { type: 'object' } },
        dead_legs: { type: 'array', items: { type: 'object' } },
        issues_text: { type: 'string' },
        actions: { type: 'array', items: { type: 'object' } },
        photos: { type: 'array', items: { type: 'object' } }
      }
    }
  });

  return result?.data ?? result;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function AiPhotoImportTab({ job, onChange }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]); // { id, file, dataUrl, cdnUrl, uploading }
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState(false);
  const inputRef = useRef();

  const addFiles = useCallback(async (newFiles) => {
    const imageFiles = [...newFiles].filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    setResult(null);
    setApplied(false);
    setError(null);

    const items = imageFiles.map(file => ({ id: uid(), file, dataUrl: null, cdnUrl: null, uploading: true }));
    setFiles(prev => [...prev, ...items]);

    // Convert to data URLs and upload to CDN in parallel
    await Promise.all(items.map(async (item) => {
      const dataUrl = await fileToDataUrl(item.file);
      item.dataUrl = dataUrl;
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, dataUrl } : f));

      const cdnUrl = await uploadToCdn(item.file).catch(() => null);
      item.cdnUrl = cdnUrl;
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, cdnUrl, uploading: false } : f));
    }));
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFileInput = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setResult(null);
    setApplied(false);
  };

  const handleAnalyse = async () => {
    if (files.length === 0) return;
    setAnalysing(true);
    setError(null);
    setResult(null);
    try {
      const data = await analysePhotos(files, job);
      setResult(data);
    } catch (err) {
      setError('AI analysis failed: ' + err.message);
    } finally {
      setAnalysing(false);
    }
  };

  const handleApply = () => {
    if (!result) return;

    const updates = {};

    // Merge rooms (avoid duplicates)
    if ((result.rooms || []).length > 0) {
      const existingNames = new Set((job.rooms || []).map(r => r.name));
      const newRooms = result.rooms.filter(r => r.name && !existingNames.has(r.name)).map(r => ({ id: uid(), name: r.name }));
      updates.rooms = [...(job.rooms || []), ...newRooms];
    }

    // Merge outlets
    if ((result.outlets || []).length > 0) {
      const newOutlets = result.outlets.map(o => ({ id: uid(), ...o }));
      updates.outlets = [...(job.outlets || []), ...newOutlets];
    }

    // Merge showers
    if ((result.showers || []).length > 0) {
      const newShowers = result.showers.map(s => ({ id: uid(), ...s }));
      updates.showers = [...(job.showers || []), ...newShowers];
    }

    // Merge TMV register
    if ((result.tmv_register || []).length > 0) {
      const existingCount = (job.tmv_register || []).length;
      const newTmvs = result.tmv_register.map((t, i) => ({
        id: uid(),
        ref: t.ref || `TMV-${String(existingCount + i + 1).padStart(2, '0')}`,
        ...t
      }));
      updates.tmv_register = [...(job.tmv_register || []), ...newTmvs];
    }

    // Merge dead legs
    if ((result.dead_legs || []).length > 0) {
      const newLegs = result.dead_legs.map(d => ({ id: uid(), ...d }));
      updates.dead_legs = [...(job.dead_legs || []), ...newLegs];
    }

    // Merge actions
    if ((result.actions || []).length > 0) {
      const existingCount = (job.actions || []).length;
      const newActions = result.actions.map((a, i) => ({
        id: uid(),
        ref: `A${existingCount + i + 1}`,
        status: 'Open',
        responsible_person: job.responsible_person || '',
        deadline: '',
        ...a
      }));
      updates.actions = [...(job.actions || []), ...newActions];
    }

    // Add photos
    if ((result.photos || []).length > 0) {
      const photoKinds = ['Cover Photo','Temperature Reading','Outlet','CWST','TMV','Dead Leg','Shower Head','Plant Room','Defect','General'];
      const newPhotos = files.map((f, i) => {
        const meta = result.photos[i] || {};
        const kind = photoKinds.includes(meta.kind) ? meta.kind : 'General';
        return {
          id: f.id,
          file_url: f.cdnUrl || f.dataUrl,
          kind,
          location: meta.location || '',
          caption: meta.caption || ''
        };
      });
      updates.photos = [...(job.photos || []), ...newPhotos];
    }

    // Text fields — only fill if currently empty
    if (result.summary && !(job.summary || '').trim()) updates.summary = result.summary;
    if (result.site_description && !(job.site_description || '').trim()) updates.site_description = result.site_description;
    if (result.issues_text && !(job.issues_text || '').trim()) updates.issues_text = result.issues_text;

    onChange(updates);
    setApplied(true);
  };

  const uploadingCount = files.filter(f => f.uploading).length;
  const readyToAnalyse = files.length > 0 && uploadingCount === 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div>
        <strong className="text-base block">🤖 AI Photo Report Builder</strong>
        <p className="text-xs text-gray-500 mt-0.5">Drop site photos and AI will analyse them to auto-populate outlets, rooms, TMVs, actions, and summary.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-red-500 bg-red-50 scale-[1.01]' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
      >
        <div className="text-4xl mb-2">📸</div>
        <div className="text-sm font-bold text-gray-700">Drag &amp; drop photos here</div>
        <div className="text-xs text-gray-400 mt-1">or click to browse — all formats supported</div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </div>

      {/* Preview grid */}
      {files.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">{files.length} photo{files.length !== 1 ? 's' : ''} selected</span>
            <button onClick={() => { setFiles([]); setResult(null); setApplied(false); }} className="text-xs text-red-600 hover:underline">Clear all</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {files.map(f => (
              <div key={f.id} className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100 aspect-square">
                {f.dataUrl ? (
                  <img src={f.dataUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>
                )}
                {f.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                  className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 text-xs font-bold text-red-600 flex items-center justify-center shadow"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload status */}
      {uploadingCount > 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          ⏫ Uploading {uploadingCount} photo{uploadingCount !== 1 ? 's' : ''}…
        </div>
      )}

      {/* Analyse button */}
      {files.length > 0 && (
        <button
          onClick={handleAnalyse}
          disabled={!readyToAnalyse || analysing}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm disabled:opacity-50 transition-all"
          style={{ background: analysing ? '#888' : '#d71920' }}
        >
          {analysing
            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Analysing {files.length} photo{files.length !== 1 ? 's' : ''}… this may take 20–40 seconds</span>
            : `✨ Analyse ${files.length} photo${files.length !== 1 ? 's' : ''} & build report`
          }
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Results preview */}
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
                {result.outlets.map((o, i) => (
                  <div key={i} className="text-xs flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                    <span className="font-semibold w-24 truncate">{o.location}</span>
                    <span className="text-gray-500">{o.type}</span>
                    {o.hot && <span className="text-red-600 font-mono">{o.hot}°H</span>}
                    {o.cold && <span className="text-blue-600 font-mono">{o.cold}°C</span>}
                    {o.notes && <span className="text-gray-400 truncate">{o.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.actions?.length > 0 && (
            <div className="border border-red-100 bg-red-50 rounded-xl p-3">
              <strong className="text-xs text-red-700 uppercase block mb-2">Actions Raised</strong>
              <div className="space-y-1">
                {result.actions.map((a, i) => (
                  <div key={i} className="text-xs border-b border-red-100 last:border-0 pb-1">
                    <span className={`inline-block w-4 h-4 rounded text-center font-bold mr-1 text-white text-[10px] leading-4 ${a.priority === '1' ? 'bg-red-600' : a.priority === '2' ? 'bg-amber-500' : 'bg-gray-400'}`}>{a.priority}</span>
                    <strong>{a.system}</strong> — {a.action}
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