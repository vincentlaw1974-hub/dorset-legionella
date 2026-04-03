import React, { useState } from 'react';
import { Input } from '@/components/ui/input';

export default function JobList({ jobs, currentId, onSelect }) {
  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const matchesSearch = j => `${j.client} ${j.site_name} ${j.address}`.toLowerCase().includes(search.toLowerCase());

  const filtered = jobs.filter(j => {
    if (!matchesSearch(j)) return false;
    if (!showCompleted && j.status === 'Completed') return false;
    return true;
  });

  // If searching and there are matching completed jobs, auto-show them
  const hasMatchingCompleted = search.trim() && jobs.some(j => j.status === 'Completed' && matchesSearch(j));
  const visibleFiltered = hasMatchingCompleted
    ? jobs.filter(j => matchesSearch(j))
    : filtered;

  const completedCount = jobs.filter(j => j.status === 'Completed').length;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <strong className="text-sm">Saved jobs</strong>
        <Input
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-[140px] h-8 text-sm"
        />
      </div>

      {completedCount > 0 && (
        <button
          onClick={() => setShowCompleted(v => !v)}
          className="text-xs text-gray-500 underline mb-2 block"
        >
          {showCompleted ? `Hide completed (${completedCount})` : `Show completed (${completedCount})`}
        </button>
      )}

      <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-0.5">
        {visibleFiltered.map(j => (
          <div
            key={j.id}
            onClick={() => onSelect(j.id)}
            className={`p-3 border rounded-xl cursor-pointer transition-all ${j.id === currentId ? 'border-brand-red bg-red-50' : 'border-gray-200 bg-white hover:bg-gray-50'} ${j.status === 'Completed' ? 'opacity-60' : ''}`}
          >
            <div className="font-bold text-sm">{j.site_name || j.client || 'Untitled site'}</div>
            <div className="text-xs text-gray-500 mt-1">{j.property_type} • {j.assessment_date}</div>
            <div className="text-xs text-gray-500">{j.address || ''}</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold badge-${(j.risk || 'low').toLowerCase()}`}>{j.risk || 'LOW'}</span>
              {j.status === 'Completed' && (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-600">Completed</span>
              )}
            </div>
          </div>
        ))}
        {visibleFiltered.length === 0 && <div className="text-xs text-gray-400 text-center py-3">No jobs found</div>}
      </div>
    </div>
  );
}