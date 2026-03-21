import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const riskColors = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const statusColors = {
  draft: 'bg-slate-50 text-slate-600 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reviewed: 'bg-purple-50 text-purple-700 border-purple-200',
  archived: 'bg-slate-50 text-slate-500 border-slate-200',
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-50 text-slate-500 border-slate-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-50 text-slate-500 border-slate-200',
  decommissioned: 'bg-slate-50 text-slate-400 border-slate-200',
  under_maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
};

const formatLabel = (value) => {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function StatusBadge({ value, type = 'status' }) {
  const colors = type === 'risk' ? riskColors : statusColors;
  return (
    <Badge 
      variant="outline" 
      className={cn('font-medium text-xs border', colors[value] || 'bg-muted text-muted-foreground')}
    >
      {formatLabel(value)}
    </Badge>
  );
}