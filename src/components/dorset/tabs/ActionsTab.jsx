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
        <button onClick={addAction} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>Add action</button>
      </div>
      <div className="text-xs text-gray-500 mb-3">Priority key: 1 Immediate, 2 As soon as practicable, 3 Planned remedial works, 4 Future maintenance/capital, O Observation.</div>

      {(job.actions || []).length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6">No actions yet.</div>
      )}

      <div className="space-y-3">
        {(job.actions || []).map(a => (
          <div key={a.id} className="border border-gray-200 rounded-2xl p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><Label>Ref</Label><Input value={a.ref} onChange={e => updateAction(a.id, 'ref', e.target.value)} /></div>
              <div><Label>System</Label><Input value={a.system} onChange={e => updateAction(a.id, 'system', e.target.value)} /></div>
              <div>
                <Label>Priority</Label>
                <select value={a.priority} onChange={e => updateAction(a.id, 'priority', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                  {['1','2','3','4','O'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div><Label>Status</Label><Input value={a.status} onChange={e => updateAction(a.id, 'status', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 mt-2">
              <div><Label>Responsible person</Label><Input value={a.responsible_person || ''} onChange={e => updateAction(a.id, 'responsible_person', e.target.value)} /></div>
              <div><Label>Deadline</Label><Input type="date" value={a.deadline || ''} onChange={e => updateAction(a.id, 'deadline', e.target.value)} /></div>
            </div>
            <div className="mt-2"><Label>Observation</Label><Textarea value={a.observation} onChange={e => updateAction(a.id, 'observation', e.target.value)} /></div>
            <div className="mt-2"><Label>Action</Label><Textarea value={a.action} onChange={e => updateAction(a.id, 'action', e.target.value)} /></div>
            <div className="mt-2">
              <button onClick={() => removeAction(a.id)} className="text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50">Remove action</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}