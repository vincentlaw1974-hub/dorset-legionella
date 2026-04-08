import React from 'react';
import { uid } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function ActionsTab({ job, onChange }) {
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

      {(job.actions || []).length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6">No actions yet.</div>
      )}

      <div className="space-y-4">
        {(job.actions || []).map(a => (
          <div key={a.id} className="border border-gray-200 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><Label>Ref</Label><Input className="h-12 text-base" value={a.ref} onChange={e => updateAction(a.id, 'ref', e.target.value)} /></div>
              <div>
                <Label>Priority</Label>
                <select value={a.priority} onChange={e => updateAction(a.id, 'priority', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base">
                  {['1','2','3','4','O'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3"><Label>System</Label><Input className="h-12 text-base" value={a.system} onChange={e => updateAction(a.id, 'system', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><Label>Responsible</Label><Input className="h-12 text-base" value={a.responsible_person || ''} onChange={e => updateAction(a.id, 'responsible_person', e.target.value)} /></div>
              <div><Label>Deadline</Label><Input type="date" className="h-12 text-base" value={a.deadline || ''} onChange={e => updateAction(a.id, 'deadline', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><Label>Status</Label><Input className="h-12 text-base" value={a.status} onChange={e => updateAction(a.id, 'status', e.target.value)} /></div>
            </div>
            <div className="mb-3"><Label>Observation</Label><Textarea className="text-base min-h-[80px]" value={a.observation} onChange={e => updateAction(a.id, 'observation', e.target.value)} /></div>
            <div className="mb-3"><Label>Action required</Label><Textarea className="text-base min-h-[80px]" value={a.action} onChange={e => updateAction(a.id, 'action', e.target.value)} /></div>
            <button onClick={() => removeAction(a.id)} className="w-full py-3 rounded-xl bg-white text-red-600 border border-red-200 font-bold text-sm">Remove action</button>
          </div>
        ))}
      </div>
    </div>
  );
}