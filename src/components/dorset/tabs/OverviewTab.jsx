import React from 'react';
import { templateOutlets, uid } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const templates = ['Blank', 'Nursing Home', 'Care Home', 'Holiday Park', 'Factory Unit', 'Domestic'];

export default function OverviewTab({ job, onChange }) {
  const handleTemplate = (name) => {
    if (name === 'Blank') {
      onChange({ template: 'Blank' });
      return;
    }
    const outlets = (templateOutlets[name] || []).map(([location, type]) => ({
      id: uid(), location, type, hot: '', cold: '', notes: '', designation: '', infrequent: false
    }));
    onChange({
      template: name,
      property_type: name,
      cqc_mode: ['Nursing Home', 'Care Home'].includes(name),
      vulnerable_users: ['Nursing Home', 'Care Home', 'Holiday Park'].includes(name),
      tmvs_installed: name !== 'Domestic',
      outlets,
    });
  };

  const f = (field) => ({
    value: job[field] || '',
    onChange: (e) => onChange({ [field]: e.target.value })
  });

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <strong>Executive summary &amp; site details</strong>
        <select
          value={job.template || 'Blank'}
          onChange={e => handleTemplate(e.target.value)}
          className="text-sm border border-gray-300 rounded-xl px-3 py-2 max-w-[220px]"
        >
          {templates.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Client</Label><Input {...f('client')} /></div>
        <div><Label>Site name</Label><Input {...f('site_name')} /></div>
        <div><Label>Address</Label><Textarea {...f('address')} className="min-h-[72px]" /></div>
        <div>
          <Label>Property type</Label>
          <select {...f('property_type')} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
            {['Nursing Home','Care Home','Holiday Park','Factory Unit','Domestic','Other'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div><Label>Assessment date</Label><Input type="date" {...f('assessment_date')} /></div>
        <div><Label>Review due</Label><Input type="date" {...f('review_due')} /></div>
        <div><Label>Report reference</Label><Input {...f('report_ref')} /></div>
        <div>
          <Label>Status</Label>
          <select {...f('status')} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
            {['In Progress','Completed','Reviewed'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div><Label>Visit date(s)</Label><Input {...f('visit_dates')} /></div>
        <div>
          <Label>Overall risk</Label>
          <select {...f('risk')} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
            {['LOW','MEDIUM','HIGH'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <Label>Executive summary</Label>
        <Textarea {...f('summary')} placeholder="Overview of what was assessed, main risks, and key immediate actions." className="min-h-[96px]" />
      </div>
    </div>
  );
}