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

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong>Management responsibilities and key roles</strong>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div><Label>Duty Holder</Label><Input {...f('duty_holder')} /></div>
          <div><Label>Duty Holder role/company</Label><Input {...f('duty_holder_role')} /></div>
          <div><Label>Responsible Person</Label><Input {...f('responsible_person')} /></div>
          <div><Label>Responsible Person role</Label><Input {...f('responsible_role')} /></div>
          <div><Label>Deputy Responsible Person</Label><Input {...f('deputy_person')} /></div>
          <div><Label>Deputy role</Label><Input {...f('deputy_role')} /></div>
          <div><Label>Assessor</Label><Input {...f('assessor')} /></div>
          <div><Label>Peer reviewer / authoriser</Label><Input {...f('reviewer')} /></div>
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