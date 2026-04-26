import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function ManagementTab({ job, onChange }) {
  const f = (field) => ({
    value: job[field] || '',
    onChange: (e) => onChange({ [field]: e.target.value })
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

  const naCheckbox = (field, label) => {
    const naKey = `${field}_na`;
    const isNA = !!job[naKey];
    return (
      <div key={field} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
        <label className={`flex items-center gap-2 text-sm cursor-pointer ${isNA ? 'opacity-40' : ''}`}>
          <input
            type="checkbox"
            checked={!!job[field] && !isNA}
            disabled={isNA}
            onChange={e => onChange({ [field]: e.target.checked })}
            className="w-4 h-4 accent-red-600"
          />
          {label}
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer ml-3 whitespace-nowrap">
          <input
            type="checkbox"
            checked={isNA}
            onChange={e => onChange({ [naKey]: e.target.checked, ...(e.target.checked ? { [field]: false } : {}) })}
            className="w-3.5 h-3.5 accent-gray-400"
          />
          N/A
        </label>
      </div>
    );
  };

  const isDomestic = (job.property_type || '').toLowerCase() === 'domestic';

  if (isDomestic) {
    return (
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
          <strong className="block mb-1">🏠 Residential / Domestic property</strong>
          For a low-risk residential rental property with a combi-boiler, a formal written scheme is not required. This assessment confirms that simple control measures are in place as required by HSG274 Part 2.
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <strong>Simple control measures</strong>
          <div className="mt-3 divide-y divide-gray-100">
            {naCheckbox('monthly_temp_log', 'Temperature checks carried out periodically')}
            {naCheckbox('shower_cleaning_log', 'Shower head cleaned and descaled regularly')}
            {naCheckbox('flushing_log', 'Unused taps/outlets flushed weekly')}
            {naCheckbox('vulnerable_users', 'Vulnerable occupants present (elderly, immunocompromised)')}
          </div>
          <div className="mt-3">
            <Label>Control notes</Label>
            <Textarea {...f('compliance_notes')} placeholder="Any observations about control measures, condition of fittings, landlord instructions, etc." />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <strong>Responsible person</strong>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {naInput('duty_holder', 'Landlord / Duty Holder')}
            {naInput('responsible_person', 'Managing Agent (if applicable)')}
            {naInput('assessor', 'Assessor')}
          </div>
        </div>
      </div>
    );
  }

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
          {job.property_type === 'Dental Surgery' && (
            <div className="mt-2 pt-2 border-t border-red-200 text-xs text-red-800 font-medium">
              🦷 Dental Surgery: The Registered Manager (CQC) has a specific duty of care under HTM 01-05 to ensure water supply and DUWL systems comply with ACoP L8 and HTM 04-01. Risk assessment must be reviewed at least every 2 years.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong>Documentation &amp; compliance</strong>
        <div className="mt-3 divide-y divide-gray-100">
          {naCheckbox('written_scheme', 'Written scheme in place')}
          {naCheckbox('schematics_available', 'Existing schematics available')}
          {naCheckbox('training_records', 'Training records available')}
          {naCheckbox('monitoring_records', 'Monitoring records available')}
          {naCheckbox('vulnerable_users', 'Vulnerable users/residents present')}
          {naCheckbox('cqc_mode', 'Care/CQC support mode')}
          {job.property_type === 'Dental Surgery' && naCheckbox('dental_htm0105_compliant', 'HTM 01-05 written scheme includes DUWL controls')}
          {job.property_type === 'Dental Surgery' && naCheckbox('dental_cqc_registered', 'CQC registered dental practice')}
        </div>
        <div className="mt-3">
          <Label>Compliance notes</Label>
          <Textarea {...f('compliance_notes')} placeholder="Missing records, written appointment issues, training gaps, etc." />
        </div>
      </div>
    </div>
  );
}