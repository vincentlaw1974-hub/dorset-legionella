import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { blankJob, reportChecks, buildControlScheme } from '@/lib/jobUtils';

import Header from '@/components/dorset/Header';
import JobList from '@/components/dorset/JobList';
import MetricsBar from '@/components/dorset/MetricsBar';
import ReportChecks from '@/components/dorset/ReportChecks';
import OverviewTab from '@/components/dorset/tabs/OverviewTab';
import ManagementTab from '@/components/dorset/tabs/ManagementTab';
import SystemsTab from '@/components/dorset/tabs/SystemsTab';
import OutletsTab from '@/components/dorset/tabs/OutletsTab';
import ActionsTab from '@/components/dorset/tabs/ActionsTab';
import PhotosTab from '@/components/dorset/tabs/PhotosTab';
import LogbookTab from '@/components/dorset/tabs/LogbookTab';
import ReportTab from '@/components/dorset/tabs/ReportTab';
import IssuesTab from '@/components/dorset/tabs/IssuesTab';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'management', label: 'Management' },
  { id: 'systems', label: 'Systems' },
  { id: 'outlets', label: 'Outlets' },
  { id: 'issues', label: 'Issues' },
  { id: 'actions', label: 'Actions' },
  { id: 'photos', label: 'Photos' },
  { id: 'logbook', label: 'Logbook' },
  { id: 'report', label: 'Report' },
];

const MOBILE_TABS = ['overview', 'outlets', 'issues', 'actions', 'photos', 'logbook', 'report'];

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const [currentId, setCurrentId] = useState(null);
  const [localJob, setLocalJob] = useState(null);
  const debounceRef = useRef(null);

  const selectedJob = jobs.find(j => j.id === (currentId || jobs[0]?.id)) || jobs[0] || null;

  // Sync localJob when selected job changes (e.g. switching jobs)
  useEffect(() => {
    if (selectedJob && (!localJob || localJob.id !== selectedJob.id)) {
      setLocalJob(selectedJob);
    }
  }, [selectedJob?.id]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setCurrentId(created.id);
      setLocalJob(created);
    },
  });

  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved'

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Job.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setCurrentId(null);
      setLocalJob(null);
    },
  });

  const handleNew = () => {
    createMutation.mutate(blankJob());
  };

  const handleChange = useCallback((changes) => {
    if (!localJob) return;
    const updated = { ...localJob, ...changes };
    setLocalJob(updated);
    setSaveState('saving');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate({ id: updated.id, data: updated });
    }, 800);
  }, [localJob, updateMutation]);

  const handleDelete = () => {
    if (!localJob) return;
    if (!window.confirm(`Delete "${localJob.site_name || localJob.client || 'this job'}"? This cannot be undone.`)) return;
    deleteMutation.mutate(localJob.id);
  };

  const handleExport = () => {
    if (!localJob) return;
    const blob = new Blob([JSON.stringify(localJob, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const base = ((localJob.site_name || localJob.client || 'assessment').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')) || 'assessment';
    a.href = URL.createObjectURL(blob);
    a.download = `${base}-backup-${localJob.assessment_date || 'today'}.json`;
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const d = JSON.parse(r.result);
      delete d.id;
      createMutation.mutate(d);
    };
    r.readAsText(file);
    e.target.value = '';
  };

  const handlePrint = () => {
    if (!localJob) return;
    const checks = reportChecks(localJob).filter(x => !x[1]);
    if (checks.length) {
      alert('Finish these first:\n- ' + checks.map(x => x[0]).join('\n- '));
      return;
    }
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#f6f7f9' }}>
      <Header onNew={handleNew} onExport={handleExport} onImport={handleImport} onDelete={handleDelete} saveState={saveState} hasJob={!!localJob} />

      {/* No jobs state */}
      {jobs.length === 0 && (
        <div className="max-w-6xl mx-auto px-3 py-16 text-center">
          <p className="text-gray-500 mb-4">No jobs yet. Create your first job to get started.</p>
          <button onClick={handleNew} className="px-6 py-3 rounded-xl font-bold text-white text-sm" style={{ background: '#d71920' }}>
            New job
          </button>
        </div>
      )}

      {localJob && (
        <div className="max-w-6xl mx-auto px-3 py-3 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3">
            {/* Left sidebar */}
            <div>
              <JobList jobs={jobs} currentId={localJob.id} onSelect={setCurrentId} />
              <MetricsBar job={localJob} />
              <ReportChecks job={localJob} />
            </div>

            {/* Main content */}
            <div>
              {/* Desktop tabs */}
              <div className="hidden sm:flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium border transition-all ${activeTab === t.id ? 'text-white border-transparent' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
                    style={activeTab === t.id ? { background: '#d71920', borderColor: '#d71920' } : {}}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'overview' && <OverviewTab job={localJob} onChange={handleChange} />}
              {activeTab === 'management' && <ManagementTab job={localJob} onChange={handleChange} />}
              {activeTab === 'systems' && <SystemsTab job={localJob} onChange={handleChange} />}
              {activeTab === 'outlets' && <OutletsTab job={localJob} onChange={handleChange} />}
              {activeTab === 'issues' && <IssuesTab job={localJob} onChange={handleChange} />}
              {activeTab === 'actions' && <ActionsTab job={localJob} onChange={handleChange} />}
              {activeTab === 'photos' && <PhotosTab job={localJob} onChange={handleChange} />}
              {activeTab === 'logbook' && <LogbookTab job={localJob} onChange={handleChange} />}
              {activeTab === 'report' && <ReportTab job={localJob} onPrint={handlePrint} />}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {localJob && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-25 bg-white border-t border-gray-200 p-2 grid grid-cols-4 gap-2">
          {MOBILE_TABS.map(id => {
            const tab = TABS.find(t => t.id === id);
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${activeTab === id ? 'text-white border-transparent' : 'bg-white text-gray-800 border-gray-300'}`}
                style={activeTab === id ? { background: '#d71920', borderColor: '#d71920' } : {}}
              >
                {tab?.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}