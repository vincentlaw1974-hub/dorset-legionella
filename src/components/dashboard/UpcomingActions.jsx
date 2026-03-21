import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isPast, isToday } from 'date-fns';
import StatusBadge from '@/components/shared/StatusBadge';
import { ArrowRight, AlertTriangle } from 'lucide-react';

export default function UpcomingActions({ actions }) {
  const upcoming = actions
    .filter(a => a.status !== 'completed' && a.status !== 'cancelled')
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Upcoming Actions</CardTitle>
        <Link to="/actions" className="text-xs text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No pending actions</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map(a => {
              const overdue = a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date));
              return (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {overdue && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                      <p className="text-sm font-medium truncate">{a.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.due_date ? format(new Date(a.due_date), 'MMM d, yyyy') : 'No due date'}
                      {a.assigned_to && ` · ${a.assigned_to}`}
                    </p>
                  </div>
                  <StatusBadge value={a.priority} type="risk" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}