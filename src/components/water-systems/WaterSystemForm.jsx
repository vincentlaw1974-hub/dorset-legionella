import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const systemTypes = [
  { value: 'hot_water', label: 'Hot Water' },
  { value: 'cold_water', label: 'Cold Water' },
  { value: 'cooling_tower', label: 'Cooling Tower' },
  { value: 'spa_pool', label: 'Spa / Pool' },
  { value: 'evaporative_condenser', label: 'Evaporative Condenser' },
  { value: 'humidifier', label: 'Humidifier' },
  { value: 'water_feature', label: 'Water Feature' },
  { value: 'fire_sprinkler', label: 'Fire Sprinkler' },
  { value: 'other', label: 'Other' },
];

const treatmentMethods = [
  { value: 'chlorination', label: 'Chlorination' },
  { value: 'chlorine_dioxide', label: 'Chlorine Dioxide' },
  { value: 'copper_silver_ionisation', label: 'Copper/Silver Ionisation' },
  { value: 'uv_treatment', label: 'UV Treatment' },
  { value: 'thermal', label: 'Thermal' },
  { value: 'none', label: 'None' },
  { value: 'other', label: 'Other' },
];

export default function WaterSystemForm({ system, onClose }) {
  const [form, setForm] = useState({
    name: system?.name || '',
    type: system?.type || '',
    location: system?.location || '',
    description: system?.description || '',
    capacity_liters: system?.capacity_liters || '',
    temperature_hot_flow: system?.temperature_hot_flow || '',
    temperature_hot_return: system?.temperature_hot_return || '',
    temperature_cold: system?.temperature_cold || '',
    treatment_method: system?.treatment_method || '',
    status: system?.status || 'active',
    last_service_date: system?.last_service_date || '',
    next_service_date: system?.next_service_date || '',
    notes: system?.notes || '',
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => {
      const cleaned = { ...data };
      if (cleaned.capacity_liters) cleaned.capacity_liters = Number(cleaned.capacity_liters);
      if (cleaned.temperature_hot_flow) cleaned.temperature_hot_flow = Number(cleaned.temperature_hot_flow);
      if (cleaned.temperature_hot_return) cleaned.temperature_hot_return = Number(cleaned.temperature_hot_return);
      if (cleaned.temperature_cold) cleaned.temperature_cold = Number(cleaned.temperature_cold);
      
      return system 
        ? base44.entities.WaterSystem.update(system.id, cleaned)
        : base44.entities.WaterSystem.create(cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waterSystems'] });
      onClose();
    },
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>System Name *</Label>
          <Input value={form.name} onChange={e => handleChange('name', e.target.value)} required />
        </div>
        <div>
          <Label>Type *</Label>
          <Select value={form.type} onValueChange={v => handleChange('type', v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {systemTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => handleChange('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
              <SelectItem value="decommissioned">Decommissioned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Location *</Label>
          <Input value={form.location} onChange={e => handleChange('location', e.target.value)} required />
        </div>
        <div>
          <Label>Capacity (Liters)</Label>
          <Input type="number" value={form.capacity_liters} onChange={e => handleChange('capacity_liters', e.target.value)} />
        </div>
        <div>
          <Label>Treatment Method</Label>
          <Select value={form.treatment_method} onValueChange={v => handleChange('treatment_method', v)}>
            <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
            <SelectContent>
              {treatmentMethods.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Hot Water Flow Temp (°C)</Label>
          <Input type="number" value={form.temperature_hot_flow} onChange={e => handleChange('temperature_hot_flow', e.target.value)} />
        </div>
        <div>
          <Label>Hot Water Return Temp (°C)</Label>
          <Input type="number" value={form.temperature_hot_return} onChange={e => handleChange('temperature_hot_return', e.target.value)} />
        </div>
        <div>
          <Label>Cold Water Temp (°C)</Label>
          <Input type="number" value={form.temperature_cold} onChange={e => handleChange('temperature_cold', e.target.value)} />
        </div>
        <div>
          <Label>Last Service Date</Label>
          <Input type="date" value={form.last_service_date} onChange={e => handleChange('last_service_date', e.target.value)} />
        </div>
        <div>
          <Label>Next Service Date</Label>
          <Input type="date" value={form.next_service_date} onChange={e => handleChange('next_service_date', e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={e => handleChange('description', e.target.value)} rows={2} />
        </div>
        <div className="col-span-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {system ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}