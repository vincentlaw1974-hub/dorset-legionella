import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import StatusBadge from '@/components/shared/StatusBadge';
import { ArrowRight } from 'lucide-react';

export default function RecentAssessments({ assessments }) {
  const recent = assessments
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Recent Assessments</CardTitle>
        <Link to="/assessments" className="text-xs text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No assessments yet</p>
        ) : (
          <div className="space-y-3">
            {recent.map(a => (
              <Link 
                key={a.id} 
                to={`/assessments/${a.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {a.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.water_system_name} · {a.assessment_date ? format(new Date(a.assessment_date), 'MMM d, yyyy') : 'No date'}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {a.overall_risk_level && <StatusBadge value={a.overall_risk_level} type="risk" />}
                  <StatusBadge value={a.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}