import React from 'react';
import { uid } from '@/lib/jobUtils';
import { Input } from '@/components/ui/input';

export default function RoomsTab({ job, onChange }) {
  const rooms = job.rooms || [];

  const addRoom = () => {
    onChange({ rooms: [...rooms, { id: uid(), name: '' }] });
  };

  const updateRoom = (id, name) => {
    onChange({ rooms: rooms.map(r => r.id === id ? { ...r, name } : r) });
  };

  const removeRoom = (id) => {
    onChange({ rooms: rooms.filter(r => r.id !== id) });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <strong>Site rooms / areas</strong>
          <p className="text-xs text-gray-500 mt-0.5">Add room</p>
        </div>
        <button onClick={addRoom} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
          Add room
        </button>
      </div>
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm mb-3">
        Add all rooms and areas on site. These will appear as dropdowns throughout the app — outlets, dead legs, shower heads, photos, and logbook.
      </div>

      {rooms.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-6">No rooms added yet.</div>
      )}

      <div className="space-y-2">
        {rooms.map(r => (
          <div key={r.id} className="flex items-center gap-2">
            <Input
              value={r.name}
              onChange={e => updateRoom(r.id, e.target.value)}
              placeholder="e.g. Room 1 Ensuite"
              className="flex-1"
            />
            <button
              onClick={() => removeRoom(r.id)}
              className="text-sm px-3 py-1.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold hover:bg-red-50 shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}