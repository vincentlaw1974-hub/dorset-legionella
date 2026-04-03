import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function ManagementTab({ job, onChange }) {
  const f = (field) => ({
    value: job[field] || '',
    onChange: (e) => onChange({ [field]: e.target.value })
  });
  const cb = (field) => ({
    checked: !!job[field],
    onChange: (e) => onChange({ [field]: e.target.checked })
  });

  const naInput = (field, label) => {
    const naKey = `${field}_na`;
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>{label}</Label>
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={!!job[naKey]}
              onChange={e => onChange({ [naKey]: e.target.checked, ...(e.target.checked ? { [field]: '' } : {}) })}
              className="w-3.5 h-3.5 accent-gray-400"
            />
            N/A
          </label>
        </div>
        <Input {...f(field)} disabled={!!job[naKey]} placeholder={job[naKey] ? 'Not applicable' : ''} />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong>Management responsibilities and key roles</strong>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {naInput('duty_holder', 'Duty Holder')}
          {naInput('duty_holder_role', 'Duty Holder role/company')}
          {naInput('responsible_person', 'Responsible Person')}
          {naInput('responsible_role', 'Responsible Person role')}
          {naInput('deputy_person', 'Deputy Responsible Person')}
          {naInput('deputy_role', 'Deputy role')}
          {naInput('assessor', 'Assessor')}
          {naInput('reviewer', 'Peer reviewer / authoriser')}
        </div>
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-gray-700">
          The Duty Holder is responsible for ensuring risks from Legionella are assessed and controlled. The Responsible Person oversees implementation and operation of the written scheme. The assessor provides assessment and recommendations only.
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong>Documentation &amp; compliance</strong>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {[
            ['written_scheme', 'Written scheme in place'],
            ['schematics_available', 'Existing schematics available'],
            ['training_records', 'Training records available'],
            ['monitoring_records', 'Monitoring records available'],
            ['vulnerable_users', 'Vulnerable users/residents present'],
            ['cqc_mode', 'Care/CQC support mode'],
          ].map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...cb(field)} className="w-4 h-4 accent-red-600" />
              {label}
            </label>
          ))}
        </div>
        <div className="mt-3">
          <Label>Compliance notes</Label>
          <Textarea {...f('compliance_notes')} placeholder="Missing records, written appointment issues, training gaps, etc." />
        </div>
      </div>
    </div>
  );
}