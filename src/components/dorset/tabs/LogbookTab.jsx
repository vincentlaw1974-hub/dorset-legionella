import React from 'react';
import { uid, today } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const categories = ['Temperature Check','Flushing','Shower Cleaning','TMV Service','CWST Inspection','Follow-up Works','Other'];

export default function LogbookTab({ job, onChange }) {
  const updateLog = (id, field, value) => {
    onChange({ logs: (job.logs || []).map(l => l.id === id ? { ...l, [field]: value } : l) });
  };

  const addLog = () => {
    const entry = { id: uid(), date: today(), category: 'Temperature Check', location: '', detail: '', completed_by: job.assessor || '', status: 'Completed' };
    onChange({ logs: [entry, ...(job.logs || [])] });
  };

  const quickTempLog = () => {
    const entry = { id: uid(), date: today(), category: 'Temperature Check', location: 'Whole site', detail: 'Monthly hot and cold checks completed.', completed_by: job.assessor || '', status: 'Completed' };
    onChange({ logs: [entry, ...(job.logs || [])] });
  };

  const removeLog = (id) => {
    onChange({ logs: (job.logs || []).filter(l => l.id !== id) });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <strong>Site logbook</strong>
        <div className="flex gap-2">
          <button onClick={addLog} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>Add entry</button>
          <button onClick={quickTempLog} className="text-sm px-3 py-2 rounded-xl font-bold bg-white border border-gray-300 text-gray-900">Quick temp log</button>
        </div>
      </div>

      {(job.logs || []).length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6">No log entries yet.</div>
      )}

      <div className="space-y-3">
        {(job.logs || []).map(l => (
          <div key={l.id} className="border border-gray-200 rounded-2xl p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><Label>Date</Label><Input type="date" value={l.date} onChange={e => updateLog(l.id, 'date', e.target.value)} /></div>
              <div>
                <Label>Category</Label>
                <select value={l.category} onChange={e => updateLog(l.id, 'category', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                  {categories.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>Location</Label>
                {(job.rooms || []).length > 0 ? (
                  <select value={l.location} onChange={e => updateLog(l.id, 'location', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{fontSize:'16px'}}>
                    <option value="">-- select room --</option>
                    {(job.rooms || []).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                ) : (
                  <Input value={l.location} onChange={e => updateLog(l.id, 'location', e.target.value)} />
                )}
              </div>
              <div><Label>Completed by</Label><Input value={l.completed_by} onChange={e => updateLog(l.id, 'completed_by', e.target.value)} /></div>
            </div>
            <div className="mt-2"><Label>Detail</Label><Textarea value={l.detail} onChange={e => updateLog(l.id, 'detail', e.target.value)} /></div>
            <div className="grid grid-cols-2 mt-2">
              <div>
                <Label>Status</Label>
                <select value={l.status} onChange={e => updateLog(l.id, 'status', e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                  {['Completed','Pending','Not Required'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2">
              <button onClick={() => removeLog(l.id)} className="text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50">Remove entry</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}