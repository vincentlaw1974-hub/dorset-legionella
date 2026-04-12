import React from 'react';
import { uid, outletStatus } from '@/lib/jobUtils';

const TYPES = ['WHB','Shower','Bath','Kitchen Sink','Cleaner Sink','Pot Wash','Outside Tap','Other'];

export default function OutletsQuickGrid({ job, onChange }) {
  const outlets = job.outlets || [];

  const update = (id, field, value) => {
    onChange({ outlets: outlets.map(o => o.id === id ? { ...o, [field]: value } : o) });
  };

  const addRow = () => {
    onChange({ outlets: [...outlets, { id: uid(), location: '', type: 'WHB', hot: '', cold: '', notes: '', infrequent: false }] });
  };

  const removeRow = (id) => {
    onChange({ outlets: outlets.filter(o => o.id !== id) });
  };

  const rooms = (job.rooms || []).map(r => r.name);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <strong className="text-sm">⚡ Quick outlet entry</strong>
        <button onClick={addRow} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>+ Row</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold w-1/4">Location</th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold w-1/6">Type</th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold w-20">Hot °C</th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold w-20">Cold °C</th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold">Status</th>
              <th className="border border-gray-200 px-2 py-2 text-left font-semibold">Notes</th>
              <th className="border border-gray-200 px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {outlets.length === 0 && (
              <tr><td colSpan={7} className="border border-gray-200 px-3 py-6 text-center text-gray-400">No outlets yet — click + Row to add</td></tr>
            )}
            {outlets.map(o => {
              const st = outletStatus(o, job.cqc_mode);
              const statusColors = { ok: '#16a34a', warn: '#d97706', fail: '#dc2626' };
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-1 py-1">
                    {rooms.length > 0 ? (
                      <select value={o.location} onChange={e => update(o.id, 'location', e.target.value)}
                        className="w-full border-0 bg-transparent text-xs px-1 py-1 focus:ring-1 focus:ring-red-400 rounded">
                        <option value="">-- room --</option>
                        {rooms.map(r => <option key={r}>{r}</option>)}
                      </select>
                    ) : (
                      <input value={o.location} onChange={e => update(o.id, 'location', e.target.value)} placeholder="Room / location"
                        className="w-full border-0 bg-transparent text-xs px-1 py-1 focus:ring-1 focus:ring-red-400 rounded outline-none" />
                    )}
                  </td>
                  <td className="border border-gray-200 px-1 py-1">
                    <select value={o.type} onChange={e => update(o.id, 'type', e.target.value)}
                      className="w-full border-0 bg-transparent text-xs px-1 py-1 focus:ring-1 focus:ring-red-400 rounded">
                      {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="border border-gray-200 px-1 py-1">
                    {o.type !== 'Outside Tap' ? (
                      <input inputMode="decimal" value={o.hot} onChange={e => update(o.id, 'hot', e.target.value)} placeholder="—"
                        className="w-full border-0 bg-transparent text-xs px-1 py-1 text-center focus:ring-1 focus:ring-red-400 rounded outline-none" />
                    ) : <span className="text-gray-300 text-center block">—</span>}
                  </td>
                  <td className="border border-gray-200 px-1 py-1">
                    <input inputMode="decimal" value={o.cold} onChange={e => update(o.id, 'cold', e.target.value)} placeholder="—"
                      className="w-full border-0 bg-transparent text-xs px-1 py-1 text-center focus:ring-1 focus:ring-red-400 rounded outline-none" />
                  </td>
                  <td className="border border-gray-200 px-2 py-1 text-center">
                    <span className="font-bold text-[11px]" style={{ color: statusColors[st.cls] }}>{st.text.toUpperCase()}</span>
                  </td>
                  <td className="border border-gray-200 px-1 py-1">
                    <input value={o.notes} onChange={e => update(o.id, 'notes', e.target.value)} placeholder="Notes…"
                      className="w-full border-0 bg-transparent text-xs px-1 py-1 focus:ring-1 focus:ring-red-400 rounded outline-none" />
                  </td>
                  <td className="border border-gray-200 px-1 py-1 text-center">
                    <button onClick={() => removeRow(o.id)} className="text-red-400 hover:text-red-600 font-bold text-base leading-none">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {outlets.length > 0 && (
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="text-green-600">✓ {outlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'ok').length} pass</span>
          <span className="text-yellow-600">⚠ {outlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'warn').length} warn</span>
          <span className="text-red-600">✕ {outlets.filter(o => outletStatus(o, job.cqc_mode).cls === 'fail').length} fail</span>
        </div>
      )}
    </div>
  );
}