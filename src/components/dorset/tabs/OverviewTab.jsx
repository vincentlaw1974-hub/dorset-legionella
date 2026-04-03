import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { templateOutlets, uid } from '@/lib/jobUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const templates = ['Blank', 'Nursing Home', 'Care Home', 'Holiday Park', 'Factory Unit', 'Domestic'];
const ASSESSORS = ['Vincent White', 'Ben White', 'Jake Robbins', 'Chris Hooker', 'Dominic Lowey-Parsons'];

export default function OverviewTab({ job, onChange }) {
  const coverRef = useRef();

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
      risk: ['Nursing Home', 'Care Home'].includes(name) ? 'MEDIUM' : 'LOW',
      outlets,
    });
  };

  const [postcode, setPostcode] = useState('');
  const [postcodeResults, setPostcodeResults] = useState([]);
  const [postcodeLoading, setPostcodeLoading] = useState(false);

  const lookupPostcode = async () => {
    if (!postcode.trim()) return;
    setPostcodeLoading(true);
    setPostcodeResults([]);
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`);
    const json = await res.json();
    setPostcodeLoading(false);
    if (json.status === 200 && json.result) {
      const r = json.result;
      const addr = `${r.admin_ward || ''}, ${r.admin_district || ''}, ${r.region || ''}, ${r.postcode}`.replace(/^,\s*/, '');
      onChange({ address: addr });
      setPostcodeResults([]);
    } else {
      setPostcodeResults(['Address not found']);
    }
  };

  const handleCoverPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange({ cover_photo_url: file_url });
    e.target.value = '';
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
      {/* Status selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['In Progress', 'Completed', 'Reviewed', 'Future'].map(s => {
          const active = (job.status || 'In Progress') === s;
          const colors = { 'In Progress': '#d97706', 'Completed': '#16a34a', 'Reviewed': '#2563eb', 'Future': '#7c3aed' };
          const icons = { 'In Progress': '🔵', 'Completed': '✅', 'Reviewed': '🔍', 'Future': '🗓' };
          return (
            <button
              key={s}
              onClick={() => onChange({ status: s })}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all`}
              style={active ? { background: colors[s], color: '#fff', borderColor: colors[s] } : { background: '#fff', color: '#374151', borderColor: '#d1d5db' }}
            >
              {icons[s]} {s}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Client</Label><Input {...f('client')} /></div>
        <div><Label>Site name</Label><Input {...f('site_name')} /></div>
        <div>
          <Label>Address</Label>
          <div className="flex gap-2 mb-1">
            <input
              type="text"
              placeholder="Postcode lookup"
              value={postcode}
              onChange={e => setPostcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupPostcode()}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-base"
            />
            <button type="button" onClick={lookupPostcode} disabled={postcodeLoading} className="text-sm px-3 py-2 rounded-xl bg-white border border-gray-300 font-medium whitespace-nowrap">
              {postcodeLoading ? '...' : 'Find address'}
            </button>
          </div>
          {postcodeResults.length > 0 && <div className="text-xs text-red-600 mb-1">{postcodeResults[0]}</div>}
          <Textarea {...f('address')} className="min-h-[72px]" placeholder="Or type address manually" />
        </div>
        <div>
          <Label>Property type</Label>
          <select {...f('property_type')} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
            {['Nursing Home','Care Home','Holiday Park','Factory Unit','Domestic','Commercial','Doctors Surgery','Dental Surgery','Other'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label>Assessment date</Label>
          <Input type="date" {...f('assessment_date')} onChange={e => {
            const val = e.target.value;
            onChange({ assessment_date: val, review_due: val ? new Date(new Date(val).setFullYear(new Date(val).getFullYear()+1)).toISOString().slice(0,10) : '' });
          }} />
        </div>
        <div><Label>Review due</Label><Input type="date" {...f('review_due')} /></div>
        <div><Label>Report reference</Label><Input {...f('report_ref')} /></div>
        <div>
          <Label>Assessor</Label>
          <select value={job.assessor || ''} onChange={e => onChange({ assessor: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base" style={{fontSize:'16px'}}>
            <option value="">-- select --</option>
            {ASSESSORS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div><Label>Responsible person</Label><Input {...f('responsible_person')} /></div>
        <div><Label>Visit date(s)</Label><Input {...f('visit_dates')} /></div>
        <div>
          <Label>Overall risk</Label>
          <div className="flex gap-2 items-center">
            <select {...f('risk')} disabled={!job.risk_override} className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
              {['LOW','MEDIUM','HIGH'].map(t => <option key={t}>{t}</option>)}
            </select>
            <button
              type="button"
              onClick={() => onChange({ risk_override: !job.risk_override })}
              className="text-xs px-3 py-2 rounded-xl border font-medium whitespace-nowrap"
              style={{ background: job.risk_override ? '#7f1d1d' : '#fff', color: job.risk_override ? '#fff' : '#374151', borderColor: '#d1d5db' }}
            >{job.risk_override ? 'Auto (resume)' : 'Manual override'}</button>
          </div>
          {job.risk_override && <div className="text-xs text-amber-700 mt-1">⚠ Risk manually overridden — auto-calculation paused</div>}
        </div>
      </div>
      <div className="mt-3">
        <Label>Executive summary</Label>
        <Textarea {...f('summary')} placeholder="Overview of what was assessed, main risks, and key immediate actions." className="min-h-[96px]" />
      </div>

      {/* Cover photo */}
      <div className="mt-3">
        <Label>Cover photo <span className="text-xs text-gray-400">(shown full-width on report cover)</span></Label>
        {job.cover_photo_url && (
          <div className="relative mt-2 mb-2">
            <img src={job.cover_photo_url} alt="Cover" className="w-full rounded-xl" style={{maxHeight:'320px',objectFit:'contain',background:'#f3f4f6'}} />
            <button onClick={() => onChange({ cover_photo_url: '' })} className="absolute top-2 right-2 bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Remove</button>
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <label className="text-sm px-3 py-2 rounded-xl font-bold text-white cursor-pointer" style={{ background: '#d71920' }}>
            {job.cover_photo_url ? 'Replace photo' : 'Add cover photo'}
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverPhoto} />
          </label>
          <label className="text-sm px-3 py-2 rounded-xl font-bold bg-white border border-gray-300 text-gray-700 cursor-pointer hover:bg-gray-50">
            Upload from device
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverPhoto} />
          </label>
        </div>
      </div>
    </div>
  );
}