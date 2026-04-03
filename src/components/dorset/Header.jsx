import React, { useState, useRef, useEffect } from 'react';
import InviteModal from '@/components/dorset/InviteModal';

export default function Header({ onNew, onDelete, onDuplicate, saveState, hasJob, job, jobs, onSelect }) {
  const [showInvite, setShowInvite] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef();
  const moreRef = useRef();

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch('');
  }, [showSearch]);

  // Close "more" menu on outside click
  useEffect(() => {
    if (!showMore) return;
    const handler = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMore]);

  const results = showSearch && search.trim()
    ? (jobs || []).filter(j =>
        `${j.client} ${j.site_name} ${j.address}`.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const statusColors = { 'In Progress': '#d97706', 'Completed': '#16a34a', 'Reviewed': '#2563eb' };
  const statusColor = statusColors[job?.status] || '#d97706';

  return (
    <header className="sticky top-0 z-30 text-white" style={{ background: 'linear-gradient(180deg,#111 0%,#1c1c1c 100%)', borderBottom: '5px solid #d71920' }}>
      <div className="max-w-6xl mx-auto px-3 py-2.5 flex justify-between items-center gap-2">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-white rounded-xl p-1 flex-shrink-0">
            <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=44&h=44&fit=crop" alt="logo" className="h-10 w-10 object-cover rounded-lg" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">Dorset Plumbing</h1>
            <p className="text-xs text-gray-400 hidden sm:block">Legionella Risk Assessment • Control Scheme • CQC Support</p>
            {job && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-gray-300 truncate max-w-[140px]">{job.site_name || job.client || 'Untitled'}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: statusColor + '33', color: statusColor, border: `1px solid ${statusColor}66` }}>{job.status || 'In Progress'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Save state */}
          {saveState === 'saving' && (
            <span className="text-xs text-gray-400 hidden sm:flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="text-xs text-green-400 hidden sm:flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Saved
            </span>
          )}

          {/* Export PDF */}
          {hasJob && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('dorset:export'))}
              className="text-sm px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-xl font-bold hover:bg-gray-600 hidden sm:inline-flex items-center gap-1"
            >📄 Export PDF</button>
          )}

          {/* Open job search */}
          <button
            onClick={() => setShowSearch(v => !v)}
            className={`text-sm px-3 py-2 border rounded-xl font-bold transition-all ${showSearch ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-100'}`}
          >
            🔍 <span className="hidden sm:inline">Open job</span>
          </button>

          {/* New job */}
          <button onClick={onNew} className="text-sm px-3 py-2 bg-red-600 text-white border border-red-700 rounded-xl font-bold hover:bg-red-700">
            + <span className="hidden sm:inline">New job</span>
          </button>

          {/* More menu */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setShowMore(v => !v)}
              className="text-sm px-2.5 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl font-bold hover:bg-gray-100"
            >⋯</button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 min-w-[160px] py-1 overflow-hidden">
                <button onClick={() => { setShowInvite(true); setShowMore(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-800">👤 Invite user</button>
                {hasJob && onDuplicate && (
                  <button onClick={() => { onDuplicate(); setShowMore(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-800">📋 Duplicate job</button>
                )}
                {hasJob && (
                  <>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { onDelete(); setShowMore(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 font-semibold">🗑 Delete job</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="border-t border-gray-700 px-3 py-2.5">
          <div className="max-w-6xl mx-auto">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by site name, client or address…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-xl px-4 py-2.5 text-sm"
            />
            {search.trim() && (
              <div className="mt-1 bg-white rounded-xl shadow-xl overflow-hidden">
                {results.length > 0 ? results.map(j => (
                  <button
                    key={j.id}
                    onClick={() => { onSelect(j.id); setShowSearch(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-sm border-b border-gray-100 last:border-0 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{j.site_name || j.client || 'Untitled'}</div>
                      <div className="text-xs text-gray-400">{j.client}{j.assessment_date ? ` • ${j.assessment_date}` : ''}</div>
                    </div>
                    <span className="text-xs font-bold ml-2 px-2 py-0.5 rounded-full" style={{ background: (statusColors[j.status] || '#d97706') + '22', color: statusColors[j.status] || '#d97706' }}>{j.status || 'In Progress'}</span>
                  </button>
                )) : (
                  <div className="text-sm text-gray-400 px-4 py-3">No jobs found for "{search}"</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </header>
  );
}