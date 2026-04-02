import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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