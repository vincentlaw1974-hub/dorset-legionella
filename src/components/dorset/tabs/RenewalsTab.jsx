import React from 'react';

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

export default function RenewalsTab({ jobs, onSelect }) {
  const items = jobs
    .map(j => ({ job: j, days: getDaysUntilRenewal(j), date: getRenewalDate(j) }))
    .filter(({ days }) => days !== null)
    .sort((a, b) => a.days - b.days);

  const overdue = items.filter(({ days }) => days < 0);
  const dueSoon = items.filter(({ days }) => days >= 0 && days <= 60);
  const upcoming = items.filter(({ days }) => days > 60);

  const Card = ({ job: j, days, date }) => (
    <div
      onClick={() => onSelect(j.id)}
      className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm flex items-center justify-between gap-4 ${
        days < 0 ? 'border-red-300 bg-red-50 hover:border-red-400' :
        days <= 14 ? 'border-orange-300 bg-orange-50 hover:border-orange-400' :
        days <= 60 ? 'border-yellow-200 bg-yellow-50 hover:border-yellow-400' :
        'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="min-w-0">
        <div className="font-semibold text-sm">{j.site_name || j.client || 'Untitled'}</div>
        <div className="text-xs text-gray-500 mt-0.5">{j.client}{j.client && j.address ? ' — ' : ''}{j.address}</div>
        <div className="text-xs mt-1 text-gray-500">Renewal: <strong>{date?.toISOString().slice(0, 10) || '—'}</strong></div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          days < 0 ? 'bg-red-200 text-red-800' :
          days <= 14 ? 'bg-orange-200 text-orange-800' :
          days <= 60 ? 'bg-yellow-200 text-yellow-800' :
          'bg-gray-100 text-gray-600'
        }`}>
          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days} days`}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          j.status === 'Completed' ? 'bg-gray-200 text-gray-600' :
          j.status === 'Reviewed' ? 'bg-blue-100 text-blue-700' :
          'bg-yellow-100 text-yellow-800'
        }`}>{j.status || 'In Progress'}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-600 font-bold text-sm">🔴 Overdue ({overdue.length})</span>
          </div>
          <div className="space-y-2">{overdue.map(i => <Card key={i.job.id} {...i} />)}</div>
        </div>
      )}

      {dueSoon.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-orange-600 font-bold text-sm">⚠ Due within 60 days ({dueSoon.length})</span>
          </div>
          <div className="space-y-2">{dueSoon.map(i => <Card key={i.job.id} {...i} />)}</div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-600 font-bold text-sm">📅 Upcoming ({upcoming.length})</span>
          </div>
          <div className="space-y-2">{upcoming.map(i => <Card key={i.job.id} {...i} />)}</div>
        </div>
      )}

      {items.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm shadow-sm">
          No jobs with renewal dates found.
        </div>
      )}
    </div>
  );
}