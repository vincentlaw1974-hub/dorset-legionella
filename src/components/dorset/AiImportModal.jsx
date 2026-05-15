import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { uid } from '@/lib/jobUtils';

export default function AiImportModal({ onClose, onImport }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are helping a Legionella risk assessor import site survey notes into a structured format.

Parse the following survey notes and extract all rooms/areas and their outlets (taps, showers, sinks etc) with temperatures.

Survey notes:
"""
${text}
"""

Return JSON with this exact structure:
{
  "rooms": [
    { "name": "string — room/area name" }
  ],
  "outlets": [
    {
      "location": "string — must match one of the room names exactly",
      "type": "string — one of: WHB, Shower, Bath, Kitchen Sink, Cleaner Sink, Pot Wash, Outside Tap, Other",
      "hot": "string — hot temp in °C as a number string, or empty string if none",
      "cold": "string — cold temp in °C as a number string, or empty string if none",
      "notes": "string — any relevant notes e.g. 'water heater faulty', 'no hot water', 'advise removal'",
      "infrequent": false,
      "hasTmv": false
    }
  ],
  "notes": "string — any general site notes not tied to a specific room (e.g. boiler type, system description)"
}

Rules:
- If an area has multiple identical outlet types (e.g. x2 WHB), create one entry per outlet.
- Map outlet types carefully: WHB = washhand basin, sink = Kitchen Sink or Cleaner Sink based on context.
- If hot water is described as absent or faulty, use empty string for hot temp and add a note.
- Infer hasTmv=true only if explicitly mentioned.
- Every outlet must have a location matching a room name.`,
        response_json_schema: {
          type: 'object',
          properties: {
            rooms: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } } } },
            outlets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  type: { type: 'string' },
                  hot: { type: 'string' },
                  cold: { type: 'string' },
                  notes: { type: 'string' },
                  infrequent: { type: 'boolean' },
                  hasTmv: { type: 'boolean' }
                }
              }
            },
            notes: { type: 'string' }
          }
        }
      });
      setPreview(result);
    } catch (e) {
      setError('AI parsing failed. Please try again.');
    }
    setLoading(false);
  };

  const handleImport = () => {
    if (!preview) return;
    const rooms = (preview.rooms || []).map(r => ({ id: uid(), name: r.name }));
    const outlets = (preview.outlets || []).map(o => ({
      id: uid(),
      location: o.location || '',
      type: o.type || 'WHB',
      hot: o.hot || '',
      cold: o.cold || '',
      notes: o.notes || '',
      infrequent: !!o.infrequent,
      hasTmv: !!o.hasTmv,
    }));
    onImport({ rooms, outlets, generalNotes: preview.notes || '' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold">✨ AI Site Import</h2>
            <p className="text-xs text-gray-500 mt-0.5">Paste your survey notes — AI will create rooms and outlets automatically</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!preview ? (
            <>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={`Paste your survey notes here, e.g.\n\nGround floor WC\nWHB hot 45.7 cold 16.4\n\nGround floor gents\n2x WHB hot 56 cold 16`}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm min-h-[200px] focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
              {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-green-800 font-medium">
                ✅ AI found {preview.rooms?.length || 0} rooms and {preview.outlets?.length || 0} outlets
              </div>

              {/* Rooms preview */}
              <div>
                <strong className="text-sm block mb-2">Rooms to create:</strong>
                <div className="flex flex-wrap gap-2">
                  {(preview.rooms || []).map((r, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-xl bg-gray-100 text-sm font-medium border border-gray-200">{r.name}</span>
                  ))}
                </div>
              </div>

              {/* Outlets preview */}
              <div>
                <strong className="text-sm block mb-2">Outlets to create:</strong>
                <div className="space-y-2">
                  {(preview.outlets || []).map((o, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
                      <span className="font-semibold text-gray-800">{o.location}</span>
                      <span className="text-blue-700 font-medium">{o.type}</span>
                      {o.hot && <span className="text-red-600">Hot: {o.hot}°C</span>}
                      {o.cold && <span className="text-blue-500">Cold: {o.cold}°C</span>}
                      {o.notes && <span className="text-gray-500 italic">{o.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {preview.notes && (
                <div>
                  <strong className="text-sm block mb-1">General notes:</strong>
                  <div className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2">{preview.notes}</div>
                </div>
              )}

              <button
                onClick={() => setPreview(null)}
                className="text-sm text-gray-500 underline"
              >
                ← Edit notes and re-parse
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          {!preview ? (
            <button
              onClick={handleParse}
              disabled={loading || !text.trim()}
              className="flex-1 px-4 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ background: '#d71920' }}
            >
              {loading ? '✨ Parsing…' : '✨ Parse with AI'}
            </button>
          ) : (
            <button
              onClick={handleImport}
              className="flex-1 px-4 py-3 rounded-xl text-white text-sm font-bold"
              style={{ background: '#16a34a' }}
            >
              ✅ Import to Job
            </button>
          )}
        </div>
      </div>
    </div>
  );
}