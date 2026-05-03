import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const RESULTS_OPTIONS = ['Pending', 'Satisfactory', 'Unsatisfactory', 'Action Required'];
const ADVISED_METHODS = ['Email', 'Phone', 'Letter', 'In Person', 'Written Report'];

export default function WaterSamplingSection({ job, onChange }) {
  const f = (field) => ({
    value: job[field] || '',
    onChange: (e) => onChange({ [field]: e.target.value }),
  });

  const samplingTaken = !!job.water_samples_taken;
  const resultColor = {
    'Satisfactory': 'text-green-700 bg-green-50 border-green-200',
    'Unsatisfactory': 'text-red-700 bg-red-50 border-red-200',
    'Action Required': 'text-red-700 bg-red-50 border-red-200',
    'Pending': 'text-amber-700 bg-amber-50 border-amber-200',
  }[job.water_samples_results] || '';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <strong>Microbiological water sampling</strong>

      <div className="mt-3 divide-y divide-gray-100">
        {/* Were samples taken? */}
        <div className="flex items-center justify-between py-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={samplingTaken}
              onChange={e => onChange({ water_samples_taken: e.target.checked })}
              className="w-4 h-4 accent-red-600"
            />
            Water samples taken during this assessment
          </label>
        </div>
      </div>

      {samplingTaken && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Date samples taken</Label>
              <Input type="date" {...f('water_samples_date')} />
            </div>
            <div>
              <Label>Laboratory / contractor</Label>
              <Input {...f('water_samples_lab')} placeholder="e.g. ALS Environmental, Eurofins" />
            </div>
            <div>
              <Label>Sample results</Label>
              <select
                value={job.water_samples_results || ''}
                onChange={e => onChange({ water_samples_results: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
              >
                <option value="">-- select --</option>
                {RESULTS_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {job.water_samples_results && (
                <div className={`mt-1 text-xs font-semibold px-2 py-1 rounded border ${resultColor}`}>
                  {job.water_samples_results === 'Satisfactory' && '✓ Results within acceptable limits'}
                  {job.water_samples_results === 'Pending' && '⏳ Awaiting laboratory results'}
                  {job.water_samples_results === 'Unsatisfactory' && '⚠ Unsatisfactory — client must be advised immediately and remedial action taken'}
                  {job.water_samples_results === 'Action Required' && '🚨 Action Required — immediate corrective measures necessary'}
                </div>
              )}
            </div>
          </div>

          {/* Client advised section */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={!!job.water_samples_advised}
                onChange={e => onChange({ water_samples_advised: e.target.checked })}
                className="w-4 h-4 accent-red-600"
                id="samples-advised"
              />
              <label htmlFor="samples-advised" className="text-sm font-semibold cursor-pointer">
                Client / duty holder has been advised of results
              </label>
            </div>

            {(job.water_samples_results === 'Unsatisfactory' || job.water_samples_results === 'Action Required') && !job.water_samples_advised && (
              <div className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                ⚠ IMPORTANT — Unsatisfactory or action-required results MUST be communicated to the duty holder without delay. Record the date and method below.
              </div>
            )}

            {job.water_samples_advised && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <Label>Date advised</Label>
                  <Input type="date" {...f('water_samples_advised_date')} />
                </div>
                <div>
                  <Label>Method of communication</Label>
                  <select
                    value={job.water_samples_advised_method || ''}
                    onChange={e => onChange({ water_samples_advised_method: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
                  >
                    <option value="">-- select --</option>
                    {ADVISED_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Sampling notes / further detail</Label>
            <Textarea
              {...f('water_samples_notes')}
              placeholder="Sample locations, parameters tested (total coliforms, E.coli, Legionella spp., TVC), any further observations or actions required..."
              className="min-h-[70px]"
            />
          </div>
        </div>
      )}

      {!samplingTaken && (
        <p className="text-xs text-gray-500 mt-2">
          No microbiological samples were taken during this assessment. Sampling may be recommended where temperature non-compliance or elevated risk is identified.
        </p>
      )}
    </div>
  );
}