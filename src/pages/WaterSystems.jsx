import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Droplets, MapPin, Thermometer, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import WaterSystemForm from '@/components/water-systems/WaterSystemForm';

const typeLabels = {
  hot_water: 'Hot Water',
  cold_water: 'Cold Water',
  cooling_tower: 'Cooling Tower',
  spa_pool: 'Spa / Pool',
  evaporative_condenser: 'Evaporative Condenser',
  humidifier: 'Humidifier',
  water_feature: 'Water Feature',
  fire_sprinkler: 'Fire Sprinkler',
  other: 'Other',
};

export default function WaterSystems() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: systems = [], isLoading } = useQuery({
    queryKey: ['waterSystems'],
    queryFn: () => base44.entities.WaterSystem.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WaterSystem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waterSystems'] }),
  });

  const handleEdit = (system) => {
    setEditing(system);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Water Systems" description="Manage and monitor all water systems in your facility">
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add System
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : systems.length === 0 ? (
        <EmptyState 
          icon={Droplets} 
          title="No water systems" 
          description="Start by adding your first water system to monitor and assess."
          actionLabel="Add Water System"
          actionPath="#"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systems.map(system => (
            <Card key={system.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Droplets className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{system.name}</h3>
                      <p className="text-xs text-muted-foreground">{typeLabels[system.type] || system.type}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(system)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(system.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{system.location}</span>
                  </div>
                  {(system.temperature_hot_flow || system.temperature_cold) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Thermometer className="w-3.5 h-3.5" />
                      <span>
                        {system.temperature_hot_flow ? `Hot: ${system.temperature_hot_flow}°C` : ''}
                        {system.temperature_hot_flow && system.temperature_cold ? ' / ' : ''}
                        {system.temperature_cold ? `Cold: ${system.temperature_cold}°C` : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <StatusBadge value={system.status} />
                  {system.next_service_date && (
                    <span className="text-[10px] text-muted-foreground">
                      Next service: {format(new Date(system.next_service_date), 'MMM d')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Water System' : 'Add Water System'}</DialogTitle>
          </DialogHeader>
          <WaterSystemForm 
            system={editing} 
            onClose={handleClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}