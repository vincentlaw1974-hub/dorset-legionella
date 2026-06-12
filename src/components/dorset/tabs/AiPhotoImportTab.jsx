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

  const handleAnalyse = async () => {
    if (files.length === 0 && !engineerNotes.trim()) return;
    setAnalysing(true);
    setError(null);
    setResult(null);

    try {
      // Resize images and upload to CDN for the API
      const fileUrls = await Promise.all(
        files.map(async (photoItem) => {
          const sourcData = photoItem.dataUrl;
          if (!sourcData) return null;

          // Resize to max 1400px
          const resized = await new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
              const maxDimension = 1400;
              const scaleFactor = Math.min(1, maxDimension / Math.max(image.width, image.height));
              const targetWidth = Math.round(image.width * scaleFactor);
              const targetHeight = Math.round(image.height * scaleFactor);
              const canvasEl = document.createElement('canvas');
              canvasEl.width = targetWidth;
              canvasEl.height = targetHeight;
              canvasEl.getContext('2d').drawImage(image, 0, 0, targetWidth, targetHeight);
              resolve(canvasEl.toDataURL('image/jpeg', 0.75));
            };
            image.onerror = () => resolve(sourcData);
            image.src = sourcData;
          });

          const fetchResponse = await fetch(resized);
          const blobData = await fetchResponse.blob();
          const fileData = new File([blobData], 'photo.jpg', { type: 'image/jpeg' });
          const uploadResult = await base44.integrations.Core.UploadFile({ file: fileData });
          return uploadResult.file_url;
        })
      ).then(urlList => urlList.filter(Boolean));

      const promptText = `You are an expert Legionella risk assessor for Dorset Plumbing (UK).
You are given ${files.length > 0 ? `${files.length} site photos` : 'no photos'}${engineerNotes.trim() ? ' and engineer\'s written notes' : ''} from a water system inspection at: ${job.site_name || job.client || 'a site'} (${job.property_type || 'Commercial'}).
${engineerNotes.trim() ? `\nENGINEER'S NOTES:\n${engineerNotes.trim()}\n` : ''}

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

      const llmResult = await base44.integrations.Core.InvokeLLM({
        prompt: promptText,
        ...(fileUrls.length > 0 ? { file_urls: fileUrls } : {}),
        model: 'claude_sonnet_4_6',
      });

      // Extract JSON from the plain string response
      const responseString = typeof llmResult === 'string' ? llmResult : JSON.stringify(llmResult);
      const codeBlockMatch = responseString.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonObjectMatch = responseString.match(/(\{[\s\S]*\})/);
      const jsonString = codeBlockMatch ? codeBlockMatch[1] : (jsonObjectMatch ? jsonObjectMatch[1] : null);

      if (!jsonString) {
        setError('AI returned an unexpected response. Please try again.');
        return;
      }

      const parsedData = JSON.parse(jsonString);
      setResult(parsedData);
    } catch (err) {
      setError('AI analysis failed: ' + err.message);
    } finally {
      setAnalysing(false);
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
    if (files.length > 0) {
      const newPhotos = files.map((photoFile, photoIndex) => {
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
          className="w-full py-4 rounded-2xl font-bold text-white text-sm disabled:opacity-50 transition-all"
          style={{ background: analysing ? '#888' : '#d71920' }}
        >
          {analysing
            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Analysing… this may take 20–40 seconds</span>
            : `✨ Analyse ${[files.length > 0 ? `${files.length} photo${files.length !== 1 ? 's' : ''}` : '', engineerNotes.trim() ? 'notes' : ''].filter(Boolean).join(' + ')} & build report`
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