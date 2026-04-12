import React, { useState } from 'react';
import { Input } from '@/components/ui/input';

function jobProgress(j) {
  const steps = [
    !!j.assessment_date,
    !!(j.site_name || j.client),
    (j.outlets || []).length > 0 && (j.outlets || []).some(o => o.hot || o.cold),
    !!(j.summary || (j.actions || []).length > 0),
  ];
  return steps;
}

const STATUS_FILTERS = ['All', 'In Progress', 'Completed', 'Reviewed', 'Future'];

function getRenewalDate(job) {
  if (job.review_due) return new Date(job.review_due);
  if (job.created_date) {
    const d = new Date(job.created_date);
    d.setMonth(d.getMonth() + 11);
    return d;
  }
  return null;
}

function getDaysUntilRenewal(job) {
  const date = getRenewalDate(job);
  if (!date) return null;
  return Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
}

function isReviewDueSoon(dateStr) {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  const now = new Date();
  const diff = (due - now) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function JobsListPanel({ jobs, currentId, onSelect, onNew }) {
  const [search, setSearch] = useState('');
  const recentIds = JSON.parse(localStorage.getItem('recentJobs') || '[]');
  const recentJobs = recentIds.map(id => jobs.find(j => j.id === id)).filter(Boolean).slice(0, 3);
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('date');

  const renewalJobs = jobs
    .map(j => ({ job: j, days: getDaysUntilRenewal(j) }))
    .filter(({ days }) => days !== null && days <= 60)
    .sort((a, b) => a.days - b.days);

  const matchesSearch = j =>
    `${j.client} ${j.site_name} ${j.address}`.toLowerCase().includes(search.toLowerCase());

  const filtered = jobs.filter(j => {
    if (!matchesSearch(j)) return false;
    if (statusFilter === 'All' && j.status === 'Future') return false;
    if (statusFilter !== 'All' && j.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'risk') {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[a.risk] ?? 1) - (order[b.risk] ?? 1);
    }
    if (sortBy === 'name') return (a.site_name || a.client || '').localeCompare(b.site_name || b.client || '');
    // default: date descending
    return new Date(b.created_date || 0) - new Date(a.created_date || 0);
  });

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <strong className="text-base">All Jobs ({jobs.length})</strong>
        <button onClick={onNew} className="text-sm px-4 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>+ New job</button>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <Input
          placeholder="Search by site, client, address…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[160px] h-9 text-sm"
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm"
        >
          <option value="date">Sort: Date</option>
          <option value="risk">Sort: Risk</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${statusFilter === s ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            style={statusFilter === s ? { background: '#d71920' } : {}}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Renewals Due */}
      {renewalJobs.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-red-600 font-bold uppercase tracking-wide mb-1.5">⚠ Renewals Due ({renewalJobs.length})</div>
          <div className="flex flex-col gap-1.5">
            {renewalJobs.map(({ job: j, days }) => (
              <button
                key={j.id}
                onClick={() => onSelect(j.id)}
                className={`text-left px-3 py-2 rounded-xl border text-sm transition-all hover:bg-red-50 hover:border-red-300 ${j.id === currentId ? 'border-red-400 bg-red-50' : days < 0 ? 'border-red-300 bg-red-50' : 'border-orange-200 bg-orange-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate">{j.site_name || j.client || 'Untitled'}</span>
                  <span className={`text-xs font-bold whitespace-nowrap px-2 py-0.5 rounded-full ${
                    days < 0 ? 'bg-red-200 text-red-800' : days <= 14 ? 'bg-orange-200 text-orange-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d`}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Renewal: {getRenewalDate(j)?.toISOString().slice(0, 10) || '—'}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 mb-3" />
        </div>
      )}

      {/* Recently viewed */}
      {!search && statusFilter === 'All' && recentJobs.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Recently viewed</div>
          <div className="flex flex-col gap-1">
            {recentJobs.map(j => (
              <button
                key={j.id}
                onClick={() => onSelect(j.id)}
                className={`text-left px-3 py-2 rounded-xl border text-sm transition-all hover:bg-red-50 hover:border-red-300 ${j.id === currentId ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
              >
                <span className="font-medium">{j.site_name || j.client || 'Untitled'}</span>
                <span className="ml-2 text-xs text-gray-400">{j.assessment_date}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 mb-3" />
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">All jobs</div>
        </div>
      )}

      {/* Job list */}
      {sorted.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No jobs found.</p>}
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-0.5">
        {sorted.map(j => {
          const dueSoon = isReviewDueSoon(j.review_due);
          const overdue = isOverdue(j.review_due);
          return (
            <div
              key={j.id}
              onClick={() => onSelect(j.id)}
              className={`border rounded-xl p-3 cursor-pointer transition-all hover:shadow-sm ${j.id === currentId ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-red-300 bg-white'} ${j.status === 'Completed' ? 'opacity-70' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{j.site_name || j.client || 'Untitled'}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{j.client}{j.client && j.assessment_date ? ' — ' : ''}{j.assessment_date}</div>
                  <div className="text-xs text-gray-400 truncate">{j.address}</div>
                  {j.review_due && (
                    <div className={`text-xs mt-1 font-semibold ${overdue ? 'text-red-600' : dueSoon ? 'text-orange-500' : 'text-gray-400'}`}>
                      {overdue ? '⚠ Review overdue' : dueSoon ? `⏰ Review due ${j.review_due}` : `Review: ${j.review_due}`}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold badge-${(j.risk || 'low').toLowerCase()}`}>{j.risk || 'LOW'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${j.status === 'Completed' ? 'bg-gray-200 text-gray-600' : j.status === 'Reviewed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-800'}`}>{j.status || 'In Progress'}</span>
                  <div className="flex gap-0.5 mt-0.5" title="Progress: Date / Site / Outlets / Summary">
                    {jobProgress(j).map((done, i) => (
                      <span key={i} className={`w-2 h-2 rounded-full ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}