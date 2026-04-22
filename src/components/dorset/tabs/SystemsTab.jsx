import React, { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';

function SystemPhotoUpload({ label, url, fieldName, onChange }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const handle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const dataUrl = await fileToDataUrl(file);
    onChange({ [fieldName]: dataUrl });
    const cdnUrl = await uploadToCdn(file);
    if (cdnUrl) onChange({ [fieldName]: cdnUrl });
    setUploading(false);
    e.target.value = '';
  };
  return (
    <div>
      <Label>{label}</Label>
      {url ? (
        <div className="relative">
          <img src={url} alt={label} className="w-full rounded-xl border border-gray-200 mt-1" style={{ maxHeight: 180, objectFit: 'cover' }} />
          <button onClick={() => onChange({ [fieldName]: null })} className="absolute top-2 right-2 bg-white border border-gray-300 rounded-full px-2 py-0.5 text-xs text-red-600 font-bold shadow">✕ Remove</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current.click()} disabled={uploading}
          className="mt-1 w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-red-400 hover:text-red-500 transition-all">
          {uploading ? '⏳ Uploading…' : '📷 Add photo'}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handle} className="hidden" />
    </div>
  );
}

export default function SystemsTab({ job, onChange }) {
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
        <strong>Site and system description</strong>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div><Label>General site description</Label><Textarea {...f('site_description')} /></div>
          <div><Label>Occupants / exposure group</Label><Textarea {...f('occupants')} /></div>
          <div><Label>Cold water source</Label><Input {...f('cold_source')} /></div>
          <div><Label>Hot water system</Label><Input {...f('hot_system')} /></div>
          {[
            ['cwst_present', 'Cold water storage tank present'],
            ['tmvs_installed', 'TMVs fitted'],
            ['air_con', 'Air conditioning present'],
            ['closed_systems', 'Closed water system present'],
          ].map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 text-sm cursor-pointer col-span-1">
              <input type="checkbox" {...cb(field)} className="w-4 h-4 accent-red-600" />
              {label}
            </label>
          ))}

          {job.cwst_present && (
            <>
              <div><Label>CWST location</Label><Input {...f('cwst_location')} /></div>
              <div className="col-span-full"><SystemPhotoUpload label="CWST photo" url={job.cwst_photo_url} fieldName="cwst_photo_url" onChange={onChange} /></div>
              <div>
                <Label>CWST temperature °C <span className="text-xs text-gray-400">(must be &lt;20°C)</span></Label>
                <Input
                  inputMode="decimal"
                  value={job.cwst_temp || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const temp = parseFloat(val);
                    const update = { cwst_temp: val };
                    if (!isNaN(temp) && temp > 20) update.risk = 'HIGH';
                    onChange(update);
                  }}
                />
                {parseFloat(job.cwst_temp) > 20 && (
                  <div className="text-xs text-red-600 mt-1 font-bold">⚠ CWST above 20°C — risk auto-set to HIGH</div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...cb('cwst_clean')} className="w-4 h-4 accent-red-600" />
                CWST clean
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...cb('cwst_drinking')} className="w-4 h-4 accent-red-600" />
                CWST feeds drinking water
              </label>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong>Hot water storage</strong>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="col-span-full">
            <SystemPhotoUpload
              label={job.hw_not_stored ? 'Boiler photo' : 'HW cylinder / calorifier photo'}
              url={job.cylinder_photo_url}
              fieldName="cylinder_photo_url"
              onChange={onChange}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer col-span-full">
            <input type="checkbox" {...cb('hw_not_stored')} className="w-4 h-4 accent-red-600" />
            Hot water not stored (combi boiler / inline heater)
          </label>
          {!job.hw_not_stored && (
            <div><Label>Cylinder / calorifier temp °C <span className="text-xs text-gray-400">(target ≥60°C)</span></Label><Input inputMode="decimal" {...f('cylinder_temp')} /></div>
          )}
          {job.hw_not_stored && (
            <div><Label>Boiler set temperature °C <span className="text-xs text-gray-400">(target ≥60°C)</span></Label><Input inputMode="decimal" {...f('hw_boiler_set_temp')} /></div>
          )}
          {!job.hw_not_stored && (
            <div><Label>Last full flush date</Label><Input type="date" {...f('last_flush_date')} /></div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong>Assessment history</strong>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div><Label>Previous assessment date</Label><Input type="date" {...f('previous_assessment_date')} /></div>
          <div><Label>Building / installation age</Label><Input {...f('building_age')} /></div>
          <div>
            <Label>Re-assessment interval (months)</Label>
            <select {...f('reassessment_interval')} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
              <option value="12">12 months (high/medium risk)</option>
              <option value="24">24 months (low risk)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong>Records in place</strong>
        <div className="text-xs text-gray-500 mt-1 mb-3">Tick if records are in place. Tick N/A if not applicable.</div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500 border-b">
            <th className="text-left pb-1 font-semibold">Record type</th>
            <th className="text-center pb-1 w-16 font-semibold">In place</th>
            <th className="text-center pb-1 w-12 font-semibold">N/A</th>
          </tr></thead>
          <tbody>
            {[['monthly_temp_log','log_temps_na','Monthly temperature log'],['flushing_log','log_flush_na','Flushing log'],['shower_cleaning_log','log_shower_na','Shower cleaning log'],['tmv_service_records','log_tmv_na','TMV service records']].map(([field, naField, label]) => (
              <tr key={field} className="border-b last:border-0">
                <td className="py-2">{label}</td>
                <td className="text-center"><input type="checkbox" checked={!!job[field] && !job[naField]} disabled={!!job[naField]} onChange={e => onChange({ [field]: e.target.checked })} className="w-4 h-4 accent-red-600" /></td>
                <td className="text-center"><input type="checkbox" checked={!!job[naField]} onChange={e => onChange({ [naField]: e.target.checked, ...(e.target.checked ? { [field]: false } : {}) })} className="w-4 h-4 accent-gray-400" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {job.air_con && (
          <div className="mt-3">
            <Label>AC last service date</Label>
            <Input type="date" {...f('ac_last_service_date')} />
            {job.ac_last_service_date && new Date(job.ac_last_service_date) < new Date(new Date().setFullYear(new Date().getFullYear()-1)) && (
              <div className="text-xs text-red-600 mt-1 font-bold">⚠ AC not serviced within 12 months — HIGH risk</div>
            )}
            {!job.ac_last_service_date && (
              <div className="text-xs text-red-600 mt-1 font-bold">⚠ No AC service date recorded — HIGH risk</div>
            )}
          </div>
        )}
        <div className="mt-3">
          <Label>Scope / restrictions / no-access areas</Label>
          <Textarea {...f('restrictions')} placeholder="Pipework behind walls not visible, no access areas, hidden services, etc." />
        </div>
      </div>

      {job.property_type === 'Dental Surgery' && (
        <div className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <strong>🦷 Dental Surgery — HTM 01-05 Requirements</strong>
          </div>
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
            Dental practices must comply with HTM 01-05 (Decontamination in Primary Care Dental Practices) and ACoP L8. Dental Unit Water Lines (DUWLs) present a specific Legionella risk and require separate controls from the domestic water system.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Number of dental chairs / DUWLs</Label>
              <Input value={job.duwl_count || ''} onChange={e => onChange({ duwl_count: e.target.value })} placeholder="e.g. 3" />
            </div>
            <div>
              <Label>DUWL water supply type</Label>
              <select value={job.duwl_water_type || ''} onChange={e => onChange({ duwl_water_type: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                <option value="">-- select --</option>
                <option value="Distilled water (self-contained bottle)">Distilled water (self-contained bottle) ✓ Recommended</option>
                <option value="RO water (self-contained bottle)">RO water (self-contained bottle) ✓ Recommended</option>
                <option value="Mains-fed">Mains-fed ⚠ Higher risk</option>
                <option value="Municipal water with inline filter">Municipal water with inline filter</option>
              </select>
              {(job.duwl_water_type === 'Mains-fed') && (
                <div className="text-xs text-red-600 mt-1 font-bold">⚠ HTM 01-05 recommends distilled or RO water in self-contained bottles for DUWLs</div>
              )}
            </div>
            <div>
              <Label>DUWL decontamination product used</Label>
              <Input value={job.duwl_decon_product || ''} onChange={e => onChange({ duwl_decon_product: e.target.value })} placeholder="e.g. Alpron, Oxygenal 6, Safewater" />
            </div>
            <div>
              <Label>DUWL decontamination frequency</Label>
              <select value={job.duwl_decon_freq || ''} onChange={e => onChange({ duwl_decon_freq: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                <option value="">-- select --</option>
                <option value="Daily">Daily ✓ Recommended</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly ⚠ Not recommended</option>
                <option value="Not done">Not done ✗ Non-compliant</option>
              </select>
              {job.duwl_decon_freq === 'Not done' && <div className="text-xs text-red-600 mt-1 font-bold">✗ Non-compliant — DUWL decontamination is required under HTM 01-05</div>}
            </div>
            <div>
              <Label>Last DUWL microbiological test date</Label>
              <Input type="date" value={job.duwl_last_test || ''} onChange={e => onChange({ duwl_last_test: e.target.value })} />
              {job.duwl_last_test && new Date(job.duwl_last_test) < new Date(new Date().setMonth(new Date().getMonth() - 3)) && (
                <div className="text-xs text-amber-700 mt-1 font-bold">⚠ Last DUWL test over 3 months ago — quarterly testing recommended</div>
              )}
              {!job.duwl_last_test && <div className="text-xs text-red-600 mt-1">⚠ No DUWL test date recorded</div>}
            </div>
            <div>
              <Label>DUWL test result (CFU/ml)</Label>
              <Input value={job.duwl_test_result || ''} onChange={e => onChange({ duwl_test_result: e.target.value })} placeholder="Target: <200 CFU/ml (ADA/CDC standard)" />
              {job.duwl_test_result && parseInt(job.duwl_test_result) > 200 && (
                <div className="text-xs text-red-600 mt-1 font-bold">⚠ DUWL result above 200 CFU/ml — immediate remedial action required</div>
              )}
            </div>
          </div>
          <div className="mt-3 divide-y divide-gray-100">
            <div className="text-xs font-semibold text-gray-600 pb-2">HTM 01-05 Compliance checks:</div>
            {[
              ['duwl_daily_flush', 'DUWLs flushed for 2 minutes at start of day (purge)'],
              ['duwl_patient_flush', 'DUWLs flushed 20–30 seconds between each patient'],
              ['duwl_decon_records', 'DUWL decontamination records in place'],
              ['duwl_test_records', 'Quarterly DUWL microbiological test records in place'],
              ['duwl_antiretraction', 'Anti-retraction valves fitted on all dental units'],
              ['dental_written_scheme', 'Written scheme covers DUWLs specifically'],
              ['dental_staff_training', 'Staff trained on DUWL decontamination procedure'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-sm cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={!!job[field]}
                  onChange={e => onChange({ [field]: e.target.checked })}
                  className="w-4 h-4 accent-red-600"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-3">
            <Label>Dental water system notes</Label>
            <Textarea value={job.dental_notes || ''} onChange={e => onChange({ dental_notes: e.target.value })} placeholder="DUWL condition, maintenance history, any non-conformances noted..." />
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong>Risk scoring overview</strong>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {[
            ['risk_contam', 'Contamination (1-5)'],
            ['risk_amplify', 'Amplification (1-5)'],
            ['risk_transmit', 'Transmission (1-5)'],
            ['risk_suscept', 'Susceptibility (1-5)'],
          ].map(([field, label]) => (
            <div key={field}>
              <Label>{label}</Label>
              <select {...f(field)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                {['1','2','3','4','5'].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-2">Use these to reflect inherent/current/residual risk discussion in the final report.</div>
      </div>
    </div>
  );
}