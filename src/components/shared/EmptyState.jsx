import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function EmptyState({ icon: Icon, title, description, actionLabel, actionPath }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {actionLabel && actionPath && (
        <Link to={actionPath}>
          <Button>{actionLabel}</Button>
        </Link>
      )}
    </div>
  );
}