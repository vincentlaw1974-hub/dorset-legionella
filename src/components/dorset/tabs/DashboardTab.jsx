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

function StatCard({ label, value, sub, color = '#111', bg = '#f9fafb', border = '#e5e7eb', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      style={{ background: bg, borderColor: border }}
    >
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-black" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function DashboardTab({ jobs, onSelect, onTabChange }) {
  const activeJobs = jobs.filter(j => j.status !== 'Future');
  const highRisk = jobs.filter(j => j.risk === 'HIGH');
  const overdueRenewals = jobs
    .map(j => ({ job: j, days: getDaysUntilRenewal(j), date: getRenewalDate(j) }))
    .filter(({ days }) => days !== null && days < 0)
    .sort((a, b) => a.days - b.days);
  const dueSoonRenewals = jobs
    .map(j => ({ job: j, days: getDaysUntilRenewal(j), date: getRenewalDate(j) }))
    .filter(({ days }) => days !== null && days >= 0 && days <= 60)
    .sort((a, b) => a.days - b.days);

  const urgentActions = jobs.flatMap(j =>
    (j.actions || [])
      .filter(a => a.status !== 'Completed' && (a.priority === '1' || a.priority === 'Critical' || a.priority === 'High'))
      .map(a => ({ ...a, jobName: j.site_name || j.client || 'Untitled', jobId: j.id }))
  );

  const completedJobs = jobs.filter(j => j.status === 'Completed').length;
  const inProgressJobs = jobs.filter(j => j.status === 'In Progress').length;

  return (
    <div className="space-y-4">

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Active Jobs" value={activeJobs.length} sub={`${inProgressJobs} in progress, ${completedJobs} completed`} />
        <StatCard
          label="Overdue Renewals"
          value={overdueRenewals.length}
          sub={overdueRenewals.length > 0 ? 'Needs immediate attention' : 'All up to date'}
          color={overdueRenewals.length > 0 ? '#991b1b' : '#166534'}
          bg={overdueRenewals.length > 0 ? '#fff5f5' : '#f0fdf4'}
          border={overdueRenewals.length > 0 ? '#fca5a5' : '#86efac'}
          onClick={() => onTabChange('renewals')}
        />
        <StatCard
          label="High Risk Sites"
          value={highRisk.length}
          sub={highRisk.length > 0 ? highRisk.map(j => j.site_name || j.client).join(', ').slice(0, 40) + (highRisk.length > 2 ? '…' : '') : 'No high risk sites'}
          color={highRisk.length > 0 ? '#92400e' : '#166534'}
          bg={highRisk.length > 0 ? '#fffbeb' : '#f0fdf4'}
          border={highRisk.length > 0 ? '#fcd34d' : '#86efac'}
        />
        <StatCard
          label="Urgent Actions"
          value={urgentActions.length}
          sub={urgentActions.length > 0 ? 'Priority 1 / Critical unresolved' : 'No urgent actions'}
          color={urgentActions.length > 0 ? '#991b1b' : '#166534'}
          bg={urgentActions.length > 0 ? '#fff5f5' : '#f0fdf4'}
          border={urgentActions.length > 0 ? '#fca5a5' : '#86efac'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Overdue + Due Soon Renewals */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-sm mb-3">🔔 Renewal Status</div>
          {overdueRenewals.length === 0 && dueSoonRenewals.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">No renewals overdue or due within 60 days.</div>
          ) : (
            <div className="space-y-2">
              {[...overdueRenewals, ...dueSoonRenewals].map(({ job: j, days, date }) => (
                <div
                  key={j.id}
                  onClick={() => onSelect(j.id)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
                    days < 0 ? 'bg-red-50 border-red-200 hover:border-red-400' : 'bg-orange-50 border-orange-200 hover:border-orange-400'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{j.site_name || j.client || 'Untitled'}</div>
                    <div className="text-xs text-gray-500">{date?.toISOString().slice(0, 10)}</div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                    days < 0 ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'
                  }`}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High Risk Sites */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-sm mb-3">🔴 High Risk Sites</div>
          {highRisk.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">No high risk sites.</div>
          ) : (
            <div className="space-y-2">
              {highRisk.map(j => (
                <div
                  key={j.id}
                  onClick={() => onSelect(j.id)}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 cursor-pointer hover:border-red-400 transition-all hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{j.site_name || j.client || 'Untitled'}</div>
                    <div className="text-xs text-gray-500">{j.property_type} {j.address ? '— ' + j.address.slice(0, 40) : ''}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full badge-high">HIGH</span>
                    <span className="text-xs text-gray-500">{j.status || 'In Progress'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Urgent Actions */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm lg:col-span-2">
          <div className="font-bold text-sm mb-3">⚡ Urgent Pending Actions</div>
          {urgentActions.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">No urgent actions outstanding.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-gray-500 font-semibold">Site</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-semibold">Ref</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-semibold">Observation</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-semibold">Responsible</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-semibold">Deadline</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-semibold">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {urgentActions.map((a, i) => (
                    <tr
                      key={i}
                      onClick={() => onSelect(a.jobId)}
                      className="border-b border-gray-100 hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-2 font-semibold text-red-700">{a.jobName}</td>
                      <td className="py-2 px-2">{a.ref || '—'}</td>
                      <td className="py-2 px-2 max-w-[200px] truncate">{a.observation || a.action || '—'}</td>
                      <td className="py-2 px-2">{a.responsible_person || '—'}</td>
                      <td className="py-2 px-2">{a.deadline || '—'}</td>
                      <td className="py-2 px-2">
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] badge-high">{a.priority}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}