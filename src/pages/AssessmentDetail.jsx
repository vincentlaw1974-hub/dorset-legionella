import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Droplets, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';

const formatLabel = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '—';

function RiskIndicator({ label, value }) {
  const colors = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
    compliant: 'bg-emerald-500',
    non_compliant: 'bg-red-500',
    partially_compliant: 'bg-amber-500',
    effective: 'bg-emerald-500',
    partially_effective: 'bg-amber-500',
    ineffective: 'bg-red-500',
    not_assessed: 'bg-slate-300',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colors[value] || 'bg-slate-300'}`} />
        <span className="text-sm font-medium">{formatLabel(value)}</span>
      </div>
    </div>
  );
}

export default function AssessmentDetail() {
  const id = new URLSearchParams(window.location.search).get('id') || window.location.pathname.split('/').pop();

  const { data: assessment, isLoading } = useQuery({
    queryKey: ['assessment', id],
    queryFn: async () => {
      const all = await base44.entities.Assessment.list();
      return all.find(a => a.id === id);
    },
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['actions', id],
    queryFn: async () => {
      const all = await base44.entities.ActionItem.list();
      return all.filter(a => a.assessment_id === id);
    },
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!assessment) {
    return <div className="p-8 text-center text-muted-foreground">Assessment not found</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <Link to="/assessments">
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Assessments
        </Button>
      </Link>

      <div className="flex flex-wrap items-start gap-3 mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{assessment.title}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {assessment.assessor_name}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {assessment.assessment_date ? format(new Date(assessment.assessment_date), 'MMM d, yyyy') : '—'}</span>
            <span className="flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" /> {assessment.water_system_name || '—'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {assessment.overall_risk_level && <StatusBadge value={assessment.overall_risk_level} type="risk" />}
          <StatusBadge value={assessment.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Factors */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Risk Factors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assessment.risk_score && (
              <div className="text-center py-4 mb-2 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-foreground">{assessment.risk_score}</p>
                <p className="text-xs text-muted-foreground mt-1">Risk Score (out of 25)</p>
              </div>
            )}
            <RiskIndicator label="Temperature" value={assessment.temperature_compliance} />
            <RiskIndicator label="Biofilm Risk" value={assessment.biofilm_risk} />
            <RiskIndicator label="Stagnation" value={assessment.stagnation_risk} />
            <RiskIndicator label="Treatment" value={assessment.treatment_effectiveness} />
            {assessment.vulnerable_people_exposure && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive font-medium">
                <AlertTriangle className="w-4 h-4" />
                Vulnerable People Exposed
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary & Actions */}
        <div className="lg:col-span-2 space-y-6">
          {assessment.summary && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Executive Summary</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{assessment.summary}</p></CardContent>
            </Card>
          )}

          {assessment.notes && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{assessment.notes}</p></CardContent>
            </Card>
          )}

          {/* Related Actions */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Action Items ({actions.length})</CardTitle>
              <Link to="/actions">
                <Button variant="outline" size="sm">View All Actions</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No action items for this assessment</p>
              ) : (
                <div className="space-y-2">
                  {actions.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.assigned_to || 'Unassigned'} · {a.due_date ? format(new Date(a.due_date), 'MMM d') : 'No due date'}</p>
                      </div>
                      <div className="flex gap-2">
                        <StatusBadge value={a.priority} type="risk" />
                        <StatusBadge value={a.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {assessment.review_date && (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Next Review</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(assessment.review_date), 'MMMM d, yyyy')}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}