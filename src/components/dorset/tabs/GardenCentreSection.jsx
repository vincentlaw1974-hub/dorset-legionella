import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const Check = ({ field, label, job, onChange }) => (
  <div className="flex items-center py-2 border-b border-gray-100 last:border-0">
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={!!job[field]}
        onChange={e => onChange({ [field]: e.target.checked })}
        className="w-4 h-4 accent-red-600"
      />
      {label}
    </label>
  </div>
);

export default function GardenCentreSection({ job, onChange }) {
  const f = (field) => ({
    value: job[field] || '',
    onChange: (e) => onChange({ [field]: e.target.value })
  });

  return (
    <div className="space-y-3">

      {/* Regulatory notice */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-900">
        <strong className="block mb-2">🌿 Garden Centre — Specific Legionella Requirements</strong>
        <ul className="space-y-1 text-xs list-disc ml-4">
          <li><strong>ACoP L8 &amp; HSG274 Part 2</strong> — Hot &amp; cold water systems (toilets, staff facilities, food prep)</li>
          <li><strong>HSG274 Part 3</strong> — Decorative water features, ornamental fountains &amp; ponds with aerosol risk</li>
          <li><strong>COSHH 2002</strong> — Risk assessment required for all systems capable of generating aerosols</li>
          <li><strong>BS 8580-1:2019</strong> — Risk assessment standard covering all water system types on site</li>
          <li>Greenhouse tanks in warm areas are HIGH RISK — Legionella thrives 20–45°C</li>
          <li>Misting/fogging systems create fine aerosols — must be mains-fed or treated with regular servicing</li>
          <li>Seasonal closure must be managed with a recommissioning procedure</li>
          <li>Reassessment required every <strong>2 years</strong> minimum</li>
        </ul>
      </div>

      {/* Site facilities inventory */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <strong className="block mb-3">Site facilities inventory</strong>
        <p className="text-xs text-gray-500 mb-3">Tick all water systems present on site.</p>
        <div className="divide-y divide-gray-100">
          <Check field="gc_public_toilets" label="Public toilet / visitor welfare facilities" job={job} onChange={onChange} />
          <Check field="gc_staff_facilities" label="Staff welfare facilities (WCs, showers, kitchen)" job={job} onChange={onChange} />
          <Check field="gc_food_prep_area" label="Food preparation / restaurant / café area" job={job} onChange={onChange} />
          <Check field="gc_animal_area" label="Animal areas (aquatics, pets, farm animals)" job={job} onChange={onChange} />
          <Check field="gc_water_features" label="Decorative water features / ornamental fountains / ponds with recirculation" job={job} onChange={onChange} />
          <Check field="gc_misting_systems" label="Greenhouse misting / fogging systems" job={job} onChange={onChange} />
          <Check field="gc_irrigation_systems" label="Irrigation networks / hose reels" job={job} onChange={onChange} />
          <Check field="gc_greenhouse_tanks" label="Water storage tanks in greenhouse or warm areas" job={job} onChange={onChange} />
          <Check field="gc_seasonal_closure" label="Site subject to seasonal closure or significantly reduced use" job={job} onChange={onChange} />
        </div>
      </div>

      {/* Water features */}
      {job.gc_water_features && (
        <div className="bg-white border border-orange-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⛲</span>
            <strong>Decorative water features / fountains</strong>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800 mb-3">
            HSG274 Part 3 applies. Water must be treated with biocide or kept at temperatures preventing Legionella growth. pH 7.2–7.6. Clean and drain at least annually.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Number of features</Label><Input {...f('gc_water_features_count')} placeholder="e.g. 2" /></div>
            <div><Label>Treatment method</Label><Input {...f('gc_water_features_treatment')} placeholder="e.g. Biocide dosing, chlorine, UV" /></div>
            <div><Label>Date last cleaned / drained</Label><Input type="date" {...f('gc_water_features_last_clean')} /></div>
          </div>
          <div className="mt-3 divide-y divide-gray-100">
            <Check field="gc_hsg274_p3_assessed" label="HSG274 Part 3 assessment completed for water features" job={job} onChange={onChange} />
            <Check field="gc_biocide_records" label="Biocide dosing / treatment records available" job={job} onChange={onChange} />
            <Check field="gc_written_scheme_covers_features" label="Written scheme includes water feature control measures" job={job} onChange={onChange} />
          </div>
        </div>
      )}

      {/* Misting systems */}
      {job.gc_misting_systems && (
        <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💨</span>
            <strong>Greenhouse misting / fogging systems</strong>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 mb-3">
            Misting systems produce very fine aerosols — one of the highest-risk Legionella transmission routes. Must be fed from mains or treated/filtered water with regular servicing.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Water source</Label><Input {...f('gc_misting_source')} placeholder="e.g. Mains, RO unit, storage tank" /></div>
            <div><Label>Date last serviced / flushed</Label><Input type="date" {...f('gc_misting_last_service')} /></div>
          </div>
        </div>
      )}

      {/* Greenhouse tanks */}
      {job.gc_greenhouse_tanks && (
        <div className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🏗️</span>
            <strong>Greenhouse / warm-area storage tanks</strong>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 mb-3">
            ⚠ HIGH RISK — Storage tanks in heated greenhouses routinely sit in the Legionella growth range (20–45°C). Annual inspection and cleaning required under ACoP L8 / HSG274 Part 2.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Recorded tank water temperature (°C)</Label><Input {...f('gc_greenhouse_tank_temp')} placeholder="e.g. 24.5" /></div>
            <div><Label>Date tank last cleaned / inspected</Label><Input type="date" {...f('gc_greenhouse_tank_last_clean')} /></div>
          </div>
        </div>
      )}

      {/* Irrigation / hose reels */}
      {job.gc_irrigation_systems && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🌱</span>
            <strong>Irrigation networks / hose reels</strong>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 mb-3">
            Hose reels and irrigation lines that are infrequently used can harbour stagnant warm water. Ensure hoses are purged before use and stored drained. Outside taps require check valves.
          </div>
          <div>
            <Label>Notes on irrigation / hose reel systems</Label>
            <Textarea {...f('gc_irrigation_notes')} placeholder="Location of hose reels, usage frequency, labelling, check valve status..." />
          </div>
        </div>
      )}

      {/* Seasonal closure */}
      {job.gc_seasonal_closure && (
        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🗓️</span>
            <strong>Seasonal closure / reduced use</strong>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-3">
            A recommissioning procedure must be in place covering: thermal flush of all outlets, inspection and cleaning of tanks and water features, biocide dosing, and temperature checks before reopening.
          </div>
          <div>
            <Label>Closure details &amp; recommissioning procedure</Label>
            <Textarea {...f('gc_seasonal_closure_notes')} placeholder="Closure periods, recommissioning steps, responsible person..." />
          </div>
        </div>
      )}

      {/* General GC notes */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <Label>Garden centre specific notes / observations</Label>
        <Textarea {...f('gc_notes')} placeholder="Any other observations — signage, visitor access to water features, staff training, etc." className="mt-1" />
      </div>

    </div>
  );
}