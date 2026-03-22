import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function IssuesTab({ job, onChange }) {
  return (
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
  );
}