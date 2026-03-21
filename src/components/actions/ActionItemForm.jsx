import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const categories = [
  { value: 'temperature_control', label: 'Temperature Control' },
  { value: 'water_treatment', label: 'Water Treatment' },
  { value: 'system_maintenance', label: 'System Maintenance' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'training', label: 'Training' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'design_modification', label: 'Design Modification' },
  { value: 'cleaning_disinfection', label: 'Cleaning & Disinfection' },
  { value: 'other', label: 'Other' },
];

export default function ActionItemForm({ item, onClose }) {
  const queryClient = useQueryClient();

  const { data: systems = [] } = useQuery({
    queryKey: ['waterSystems'],
    queryFn: () => base44.entities.WaterSystem.list(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => base44.entities.Assessment.list(),
  });

  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    assessment_id: item?.assessment_id || '',
    assessment_title: item?.assessment_title || '',
    water_system_id: item?.water_system_id || '',
    water_system_name: item?.water_system_name || '',
    priority: item?.priority || 'medium',
    status: item?.status || 'open',
    assigned_to: item?.assigned_to || '',
    due_date: item?.due_date || '',
    completed_date: item?.completed_date || '',
    category: item?.category || '',
    notes: item?.notes || '',
  });

  const mutation = useMutation({
    mutationFn: (data) => item 
      ? base44.entities.ActionItem.update(item.id, data)
      : base44.entities.ActionItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      onClose();
    },
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleAssessmentChange = (id) => {
    const assessment = assessments.find(a => a.id === id);
    setForm(prev => ({
      ...prev,
      assessment_id: id,
      assessment_title: assessment?.title || '',
      water_system_id: assessment?.water_system_id || prev.water_system_id,
      water_system_name: assessment?.water_system_name || prev.water_system_name,
    }));
  };

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
      <div>
        <Label>Title *</Label>
        <Input value={form.title} onChange={e => handleChange('title', e.target.value)} required />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => handleChange('description', e.target.value)} rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Assessment</Label>
          <Select value={form.assessment_id} onValueChange={handleAssessmentChange}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {assessments.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Water System</Label>
          <Select value={form.water_system_id} onValueChange={v => {
            const sys = systems.find(s => s.id === v);
            handleChange('water_system_id', v);
            handleChange('water_system_name', sys?.name || '');
          }}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {systems.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => handleChange('category', v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={v => handleChange('priority', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => handleChange('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Assigned To</Label>
          <Input value={form.assigned_to} onChange={e => handleChange('assigned_to', e.target.value)} />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input type="date" value={form.due_date} onChange={e => handleChange('due_date', e.target.value)} />
        </div>
        {form.status === 'completed' && (
          <div>
            <Label>Completed Date</Label>
            <Input type="date" value={form.completed_date} onChange={e => handleChange('completed_date', e.target.value)} />
          </div>
        )}
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {item ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}