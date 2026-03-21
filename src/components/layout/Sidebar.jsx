import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Droplets, 
  ClipboardCheck, 
  ListChecks, 
  Plus,
  Shield,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Water Systems', icon: Droplets, path: '/water-systems' },
  { label: 'Assessments', icon: ClipboardCheck, path: '/assessments' },
  { label: 'Action Items', icon: ListChecks, path: '/actions' },
];

export default function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">LegionellaGuard</h1>
            <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Risk Assessment</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onToggle}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => window.innerWidth < 1024 && onToggle()}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4.5 h-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Quick action */}
        <div className="p-4 border-t border-sidebar-border">
          <Link to="/assessments/new">
            <Button className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground gap-2" size="sm">
              <Plus className="w-4 h-4" />
              New Assessment
            </Button>
          </Link>
        </div>
      </aside>
    </>
  );
}