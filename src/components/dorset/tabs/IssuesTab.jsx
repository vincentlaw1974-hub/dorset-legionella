import React, { useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { uid } from '@/lib/jobUtils';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';
import { Loader2, X } from 'lucide-react';

export default function IssuesTab({ job, onChange }) {
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef();

  const handlePhotos = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    e.target.value = '';
    setUploading(true);
    for (const file of files) {
      const newId = uid();
      const dataUrl = await fileToDataUrl(file);
      const newPhotos = [...(job.photos || []), { id: newId, file_url: dataUrl, kind: 'Defect', location: '', caption: '' }];
      onChange({ photos: newPhotos });
      uploadToCdn(file).then(cdnUrl => {
        if (cdnUrl) onChange({ photos: (job.photos || []).map(p => p.id === newId ? { ...p, file_url: cdnUrl } : p) });
      });
    }
    setUploading(false);
  };

  const issuePhotos = (job.photos || []).filter(p => p.kind === 'Defect');

  const removePhoto = (id) => {
    onChange({ photos: (job.photos || []).filter(p => p.id !== id) });
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong className="block mb-3">Issues / findings</strong>
        <p className="text-sm text-gray-500 mb-3">
          List failures, dirty CWST, dead legs, overdue service, cross-connection concerns, missing records, etc.
        </p>
        <Textarea
          value={job.issues_text || ''}
          onChange={e => onChange({ issues_text: e.target.value })}
          placeholder="e.g. Shower head in Room 3 found with scale and biofilm. CWST lid unsealed. No flushing records available..."
          className="min-h-[220px]"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <strong>Issue photos</strong>
          <label className="text-sm px-3 py-2 rounded-xl font-bold text-white cursor-pointer flex items-center gap-1" style={{ background: '#d71920' }}>
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : 'Add photos'}
            <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
          </label>
        </div>
        <p className="text-xs text-gray-400 mb-3">You can select multiple photos at once. They will be tagged as Defect photos in the report.</p>
        {issuePhotos.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-4">No issue photos yet.</div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {issuePhotos.map(p => (
            <div key={p.id} className="relative rounded-xl overflow-hidden bg-gray-100 aspect-square">
              <img src={p.file_url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(p.id)}
                className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-red-600 hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}