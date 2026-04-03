import React, { useState, useRef, useEffect } from 'react';
import InviteModal from '@/components/dorset/InviteModal';

export default function Header({ onNew, onDelete, onComplete, onDuplicate, saveState, hasJob, job, jobs, onSelect }) {
  const [showInvite, setShowInvite] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef();

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch('');
  }, [showSearch]);

  const results = showSearch && search.trim()
    ? (jobs || []).filter(j =>
        `${j.client} ${j.site_name} ${j.address}`.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : [];
  return (
    <header className="sticky top-0 z-30 text-white" style={{ background: 'linear-gradient(180deg,#111 0%,#1c1c1c 100%)', borderBottom: '5px solid #d71920' }}>
      <div className="max-w-6xl mx-auto px-3 py-2.5 flex justify-between items-start gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl p-1">
            <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=44&h=44&fit=crop" alt="logo" className="h-10 w-10 object-cover rounded-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Dorset Plumbing</h1>
            <p className="text-xs text-gray-300">Legionella Risk Assessment • Control Scheme • CQC Support</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Save indicator */}
          {/* Open job search */}
          <div className="relative">
            <button onClick={() => setShowSearch(v => !v)} className="text-sm px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl font-bold hover:bg-gray-100">Open job</button>
            {showSearch && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-2">
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search site, client, address…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mb-1"
                />
                {results.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto">
                    {results.map(j => (
                      <button
                        key={j.id}
                        onClick={() => { onSelect(j.id); setShowSearch(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-sm"
                      >
                        <div className="font-semibold">{j.site_name || j.client || 'Untitled'}</div>
                        <div className="text-xs text-gray-400">{j.client} {j.assessment_date}</div>
                      </button>
                    ))}
                  </div>
                ) : search.trim() ? (
                  <div className="text-xs text-gray-400 px-3 py-2">No results found</div>
                ) : (
                  <div className="text-xs text-gray-400 px-3 py-2">Start typing to search…</div>
                )}
              </div>
            )}
          </div>

          {saveState === 'saving' && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Saved
            </span>
          )}
          <button onClick={() => setShowInvite(true)} className="text-sm px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl font-bold hover:bg-gray-100">Invite user</button>
          <button onClick={onNew} className="text-sm px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl font-bold hover:bg-gray-100">New job</button>
          {hasJob && onDuplicate && (
            <button onClick={onDuplicate} className="text-sm px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl font-bold hover:bg-gray-100">Duplicate</button>
          )}
          {hasJob && job?.status !== 'Completed' && onComplete && (
            <button onClick={onComplete} className="text-sm px-3 py-2 bg-green-600 text-white border border-green-700 rounded-xl font-bold hover:bg-green-700">Mark complete</button>
          )}
          {hasJob && (
            <button onClick={onDelete} className="text-sm px-3 py-2 bg-red-700 text-white border border-red-800 rounded-xl font-bold hover:bg-red-800">Delete job</button>
          )}
        </div>
      </div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </header>
  );
}