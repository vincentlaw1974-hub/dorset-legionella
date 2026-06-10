import React from 'react';
import { uid } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function ActionsTab({ job, onChange }) {
  // Check if a central TMV action suggestion should be shown
  const hasCentralTmv = (job.outlets || []).some(o => o.hasTmv && o.tmv_type === 'Central / Shared TMV');
  const centralTmvActionExists = (job.actions || []).some(a =>
    a.system === 'TMVs' && (a.action || '').includes('Central TMV')
  );
  const showCentralTmvSuggestion = hasCentralTmv && !centralTmvActionExists;

  const addCentralTmvAction = () => {
    const actions = [...(job.actions || []), {
      id: uid(),
      ref: `A${(job.actions || []).length + 1}`,
      system: 'TMVs',
      observation: 'Central / Shared TMV identified serving multiple outlets. Long blended pipe runs noted.',
      action: 'Central TMV identified serving multiple outlets. Long blended pipe runs present an increased Legionella risk. Consider fitting point-of-use TMVs at individual outlets to reduce pipe run length and biofilm risk.',
      priority: '3',
      responsible_person: job.responsible_person || '',
      deadline: '',
      status: 'Open'
    }];
    onChange({ actions });
  };

  const updateAction = (id, field, value) => {
    const actions = (job.actions || []).map(a => a.id === id ? { ...a, [field]: value } : a);
    onChange({ actions });
  };

  const addAction = () => {
    const actions = [...(job.actions || []), {
      id: uid(),
      ref: `A${(job.actions || []).length + 1}`,
      system: '', observation: '', action: '', priority: '2', responsible_person: '', deadline: '', status: ''
    }];
    onChange({ actions });
  };

  const removeAction = (id) => {
    onChange({ actions: (job.actions || []).filter(a => a.id !== id) });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <strong>Improvement actions</strong>
        <button onClick={addAction} className="text-sm px-4 py-3 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>+ Add action</button>
      </div>
      <div className="text-xs text-gray-500 mb-3">Priority: 1 Immediate, 2 ASAP, 3 Planned, 4 Future, O Observation.</div>

      {showCentralTmvSuggestion && (
        <div className="mb-3 border border-amber-200 bg-amber-50 rounded-xl p-3 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-amber-800 text-sm mb-1">Suggested action: Central TMV risk</div>
            <div className="text-xs text-amber-700">A Central / Shared TMV is fitted on one or more outlets. Add the pre-filled action recommendation?</div>
          </div>
          <button onClick={addCentralTmvAction} className="flex-shrink-0 text-xs px-3 py-1.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700">+ Add action</button>
        </div>
      )}

      {(job.actions || []).length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6">No actions yet.</div>
      )}

      <div className="space-y-4">
        {(job.actions || []).map(a => (
          <div key={a.id} className="border border-gray-200 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><Label>Ref</Label><Input className="h-12 text-base" placeholder="e.g. A1" value={a.ref} onChange={e => updateAction(a.id, 'ref', e.target.value)} /></div>
              <div>
                <Label>Priority</Label>
                <select value={a.priority} onChange={e => updateAction(a.id, 'priority', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base">
                  <option value="1">1 — Immediate</option>
                  <option value="2">2 — ASAP</option>
                  <option value="3">3 — Planned</option>
                  <option value="4">4 — Future</option>
                  <option value="O">O — Observation</option>
                </select>
              </div>
            </div>
            <div className="mb-3"><Label>System</Label><Input className="h-12 text-base" placeholder="e.g. Hot Water, Cold Water, Showers, TMVs" value={a.system} onChange={e => updateAction(a.id, 'system', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><Label>Responsible</Label><Input className="h-12 text-base" placeholder="e.g. Management, Contractor" value={a.responsible_person || ''} onChange={e => updateAction(a.id, 'responsible_person', e.target.value)} /></div>
              <div><Label>Deadline</Label><Input type="date" className="h-12 text-base" value={a.deadline || ''} onChange={e => updateAction(a.id, 'deadline', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><Label>Status</Label><Input className="h-12 text-base" placeholder="e.g. Open, In Progress, Completed" value={a.status} onChange={e => updateAction(a.id, 'status', e.target.value)} /></div>
            </div>
            <div className="mb-3"><Label>Observation</Label><Textarea className="text-base min-h-[80px]" placeholder="What was found during the assessment, e.g. No temperature monitoring records available" value={a.observation} onChange={e => updateAction(a.id, 'observation', e.target.value)} /></div>
            <div className="mb-3"><Label>Action required</Label><Textarea className="text-base min-h-[80px]" placeholder="What needs to be done, e.g. Implement monthly temperature monitoring and retain records on site" value={a.action} onChange={e => updateAction(a.id, 'action', e.target.value)} /></div>
            <button onClick={() => removeAction(a.id)} className="w-full py-3 rounded-xl bg-white text-red-600 border border-red-200 font-bold text-sm">Remove action</button>
          </div>
        ))}
      </div>
    </div>
  );
}