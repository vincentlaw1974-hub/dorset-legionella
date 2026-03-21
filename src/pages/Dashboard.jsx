import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Droplets, ClipboardCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import RiskDistribution from '@/components/dashboard/RiskDistribution';
import RecentAssessments from '@/components/dashboard/RecentAssessments';
import UpcomingActions from '@/components/dashboard/UpcomingActions';

export default function Dashboard() {
  const { data: systems = [] } = useQuery({
    queryKey: ['waterSystems'],
    queryFn: () => base44.entities.WaterSystem.list(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => base44.entities.Assessment.list(),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['actions'],
    queryFn: () => base44.entities.ActionItem.list(),
  });

  const openActions = actions.filter(a => a.status === 'open' || a.status === 'in_progress');
  const overdueActions = actions.filter(a => {
    if (!a.due_date || a.status === 'completed' || a.status === 'cancelled') return false;
    return new Date(a.due_date) < new Date();
  });
  const highRiskCount = assessments.filter(a => a.overall_risk_level === 'high' || a.overall_risk_level === 'critical').length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader 
        title="Dashboard" 
        description="Overview of your legionella risk management program"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Water Systems" value={systems.length} icon={Droplets} />
        <StatCard label="Assessments" value={assessments.length} icon={ClipboardCheck} />
        <StatCard 
          label="High/Critical Risk" 
          value={highRiskCount} 
          icon={AlertTriangle} 
          colorClass={highRiskCount > 0 ? "bg-destructive" : undefined}
        />
        <StatCard label="Open Actions" value={openActions.length} icon={CheckCircle2} trend={overdueActions.length > 0 ? `${overdueActions.length} overdue` : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <RecentAssessments assessments={assessments} />
        </div>
        <RiskDistribution assessments={assessments} />
      </div>

      <UpcomingActions actions={actions} />
    </div>
  );
}