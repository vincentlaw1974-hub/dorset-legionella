import React from 'react';
import { uid } from '@/lib/jobUtils';
import { Input } from '@/components/ui/input';

const COMMON_ROOMS = [
  'Bathroom', 'Bedroom', 'Kitchen', 'En-suite', 'Airing Cupboard',
  'Garden', 'WC / Toilet', 'Utility Room', 'Hallway', 'Lounge',
  'Cleaner Store', 'Plant Room', 'Garage', 'Loft',
];

export default function RoomsTab({ job, onChange }) {
  const rooms = job.rooms || [];

  const addRoom = (name = '') => {
    onChange({ rooms: [...rooms, { id: uid(), name }] });
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
          <p className="text-xs text-gray-500 mt-0.5">Tap a room below or type a custom name</p>
        </div>
        <button onClick={() => addRoom('')} className="text-sm px-3 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
          + Custom
        </button>
      </div>
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm mb-3">
        Tap a room type to add it instantly. These appear as dropdowns throughout the app — outlets, dead legs, showers, photos, and logbook.
      </div>

      {/* Quick-add chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {COMMON_ROOMS.map(name => (
          <button
            key={name}
            onClick={() => addRoom(name)}
            className="px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all active:scale-95"
          >
            + {name}
          </button>
        ))}
      </div>

      {rooms.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-4">No rooms added yet. Tap a room above to add it.</div>
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