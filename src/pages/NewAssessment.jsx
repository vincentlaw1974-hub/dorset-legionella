import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';

export default function NewAssessment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: systems = [] } = useQuery({
    queryKey: ['waterSystems'],
    queryFn: () => base44.entities.WaterSystem.list(),
  });

  const [form, setForm] = useState({
    title: '',
    water_system_id: '',
    water_system_name: '',
    assessor_name: '',
    assessment_date: new Date().toISOString().split('T')[0],
    review_date: '',
    overall_risk_level: '',
    risk_score: '',
    status: 'draft',
    temperature_compliance: 'not_assessed',
    biofilm_risk: 'not_assessed',
    stagnation_risk: 'not_assessed',
    treatment_effectiveness: 'not_assessed',
    vulnerable_people_exposure: false,
    summary: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: (data) => {
      const cleaned = { ...data };
      if (cleaned.risk_score) cleaned.risk_score = Number(cleaned.risk_score);
      return base44.entities.Assessment.create(cleaned);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      navigate('/assessments');
    },
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSystemChange = (id) => {
    const system = systems.find(s => s.id === id);
    setForm(prev => ({
      ...prev,
      water_system_id: id,
      water_system_name: system?.name || '',
    }));
  };

  const calculateRiskLevel = (score) => {
    const num = Number(score);
    if (num <= 5) return 'low';
    if (num <= 12) return 'medium';
    if (num <= 19) return 'high';
    return 'critical';
  };

  const handleRiskScoreChange = (value) => {
    handleChange('risk_score', value);
    if (value) {
      handleChange('overall_risk_level', calculateRiskLevel(value));
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="New Risk Assessment" description="Create a comprehensive legionella risk assessment" />

      <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-6">
        {/* General Info */}
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base">General Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Assessment Title *</Label>
              <Input value={form.title} onChange={e => handleChange('title', e.target.value)} placeholder="e.g. Q1 2026 Hot Water Risk Assessment" required />
            </div>
            <div>
              <Label>Water System *</Label>
              <Select value={form.water_system_id} onValueChange={handleSystemChange}>
                <SelectTrigger><SelectValue placeholder="Select system" /></SelectTrigger>
                <SelectContent>
                  {systems.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {s.location}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assessor Name *</Label>
              <Input value={form.assessor_name} onChange={e => handleChange('assessor_name', e.target.value)} required />
            </div>
            <div>
              <Label>Assessment Date *</Label>
              <Input type="date" value={form.assessment_date} onChange={e => handleChange('assessment_date', e.target.value)} required />
            </div>
            <div>
              <Label>Review Date</Label>
              <Input type="date" value={form.review_date} onChange={e => handleChange('review_date', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Risk Assessment */}
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base">Risk Evaluation</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Risk Score (1-25)</Label>
              <Input type="number" min="1" max="25" value={form.risk_score} onChange={e => handleRiskScoreChange(e.target.value)} placeholder="1-25" />
            </div>
            <div>
              <Label>Overall Risk Level</Label>
              <Select value={form.overall_risk_level} onValueChange={v => handleChange('overall_risk_level', v)}>
                <SelectTrigger><SelectValue placeholder="Auto or select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Temperature Compliance</Label>
              <Select value={form.temperature_compliance} onValueChange={v => handleChange('temperature_compliance', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                  <SelectItem value="partially_compliant">Partially Compliant</SelectItem>
                  <SelectItem value="not_assessed">Not Assessed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Biofilm Risk</Label>
              <Select value={form.biofilm_risk} onValueChange={v => handleChange('biofilm_risk', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="not_assessed">Not Assessed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stagnation Risk</Label>
              <Select value={form.stagnation_risk} onValueChange={v => handleChange('stagnation_risk', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="not_assessed">Not Assessed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Treatment Effectiveness</Label>
              <Select value={form.treatment_effectiveness} onValueChange={v => handleChange('treatment_effectiveness', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="effective">Effective</SelectItem>
                  <SelectItem value="partially_effective">Partially Effective</SelectItem>
                  <SelectItem value="ineffective">Ineffective</SelectItem>
                  <SelectItem value="not_assessed">Not Assessed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3 py-2">
              <Switch checked={form.vulnerable_people_exposure} onCheckedChange={v => handleChange('vulnerable_people_exposure', v)} />
              <Label className="mb-0">Vulnerable people exposed (elderly, immunocompromised)</Label>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base">Summary & Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Executive Summary</Label>
              <Textarea value={form.summary} onChange={e => handleChange('summary', e.target.value)} rows={4} placeholder="Summarize key findings..." />
            </div>
            <div>
              <Label>Additional Notes</Label>
              <Textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => handleChange('status', v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/assessments')}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Assessment
          </Button>
        </div>
      </form>
    </div>
  );
}