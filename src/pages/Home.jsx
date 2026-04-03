import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { blankJob, reportChecks, buildControlScheme, calculateRisk } from '@/lib/jobUtils';

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
import JobsListPanel from '@/components/dorset/JobsListPanel';
import IssuesTab from '@/components/dorset/tabs/IssuesTab';
import RoomsTab from '@/components/dorset/tabs/RoomsTab';
import DeadLegsTab from '@/components/dorset/tabs/DeadLegsTab';
import ShowersTab from '@/components/dorset/tabs/ShowersTab';

const TABS = [
  { id: 'jobs', label: '📁 Jobs' },
  { id: 'overview', label: 'Overview' },
  { id: 'management', label: 'Management' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'systems', label: 'Systems' },
  { id: 'outlets', label: 'Outlets' },
  { id: 'issues', label: 'Issues' },
  { id: 'dead_legs', label: 'Dead Legs' },
  { id: 'showers', label: 'Showers' },
  { id: 'actions', label: 'Actions' },
  { id: 'photos', label: 'Photos' },
  { id: 'logbook', label: 'Logbook' },
  { id: 'report', label: '📄 Report' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('jobs');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const [currentId, setCurrentId] = useState(null);
  const [localJob, setLocalJob] = useState(null);
  const debounceRef = useRef(null);
  const localJobRef = useRef(null);

  const selectedJob = jobs.find(j => j.id === (currentId || jobs[0]?.id)) || jobs[0] || null;

  useEffect(() => {
    // Only sync from server if we don't already have this job loaded locally
    // (avoid overwriting in-flight edits when the query re-fetches)
    if (selectedJob && localJobRef.current?.id !== selectedJob.id) {
      setLocalJob(selectedJob);
      localJobRef.current = selectedJob;
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

  const [saveState, setSaveState] = useState('idle');

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

  const handleSelect = (id) => {
    // Flush any pending save for the current job before switching
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      if (localJobRef.current) {
        updateMutation.mutate({ id: localJobRef.current.id, data: localJobRef.current });
      }
    }
    // Find the job and set it immediately to avoid any stale state
    const nextJob = jobs.find(j => j.id === id);
    if (nextJob) {
      localJobRef.current = nextJob;
      setLocalJob(nextJob);
    }
    setCurrentId(id);
    setActiveTab('overview');
    setSidebarOpen(false);
    const key = 'recentJobs';
    const recent = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = [id, ...recent.filter(r => r !== id)].slice(0, 3);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleNew = () => {
    const siteName = window.prompt('Enter site name for the new job:');
    if (!siteName || !siteName.trim()) return;
    createMutation.mutate({ ...blankJob(), site_name: siteName.trim() });
  };

  const handleChange = useCallback((changes) => {
    const current = localJobRef.current;
    if (!current) return;
    let updated = { ...current, ...changes };
    if (!updated.risk_override) {
      updated.risk = calculateRisk(updated);
    }
    // Guard: only save if the id hasn't changed under us
    const jobId = current.id;
    localJobRef.current = updated;
    setLocalJob(updated);
    setSaveState('saving');
    if ('photos' in changes) {
      clearTimeout(debounceRef.current);
      updateMutation.mutate({ id: jobId, data: updated });
    } else {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Double-check we're still on the same job before saving
        if (localJobRef.current?.id === jobId) {
          updateMutation.mutate({ id: jobId, data: localJobRef.current });
        }
      }, 800);
    }
  }, [updateMutation]);

  const handleComplete = useCallback(() => {
    if (!localJob) return;
    const updated = { ...localJob, status: 'Completed' };
    localJobRef.current = updated;
    setLocalJob(updated);
    updateMutation.mutate({ id: updated.id, data: updated });
  }, [localJob, updateMutation]);

  const handleDuplicate = useCallback(() => {
    if (!localJob) return;
    const { id, created_date, updated_date, created_by, ...rest } = localJob;
    const copy = {
      ...rest,
      site_name: (rest.site_name || rest.client || 'Copy') + ' (Copy)',
      status: 'In Progress',
      assessment_date: '',
      review_due: '',
    };
    createMutation.mutate(copy);
  }, [localJob, createMutation]);

  const handleDelete = () => {
    if (!localJob) return;
    setDeleteTargetId(localJob.id);
    setConfirmDelete(true);
  };

  const confirmDoDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
    setConfirmDelete(false);
    setDeleteTargetId(null);
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
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#f6f7f9' }}>
      <Header onNew={handleNew} onDelete={handleDelete} onDuplicate={handleDuplicate} saveState={saveState} hasJob={!!localJob} job={localJob} jobs={jobs} onSelect={handleSelect} />

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
          <div className="flex flex-col lg:flex-row gap-3 items-start">

            {/* Mobile sidebar toggle */}
            <div className="lg:hidden mb-2">
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold shadow-sm"
              >
                <span>📋 {localJob?.site_name || localJob?.client || 'Current job'}</span>
                <span className="text-gray-400">{sidebarOpen ? '▲ Hide' : '▼ Details'}</span>
              </button>
            </div>

            {/* Left sidebar */}
            <div className={`w-full lg:w-[280px] lg:flex-shrink-0 ${sidebarOpen ? 'block' : 'hidden'} lg:block`}>
              <JobList jobs={jobs} currentId={localJob.id} onSelect={handleSelect} />
              <MetricsBar job={localJob} />
              <ReportChecks job={localJob} />
            </div>

            {/* Main content — key by job id forces full remount on job switch, preventing stale state */}
            <div key={localJob.id} className="flex-1 min-w-0">
              {/* Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none" style={{WebkitOverflowScrolling:'touch', maxWidth:'100vw'}}>
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
              {activeTab === 'jobs' && <JobsListPanel jobs={jobs} currentId={localJob?.id} onSelect={handleSelect} onNew={handleNew} />}
              {activeTab === 'overview' && <OverviewTab job={localJob} onChange={handleChange} />}
              {activeTab === 'management' && <ManagementTab job={localJob} onChange={handleChange} />}
              {activeTab === 'systems' && <SystemsTab job={localJob} onChange={handleChange} />}
              {activeTab === 'outlets' && <OutletsTab job={localJob} onChange={handleChange} />}
              {activeTab === 'rooms' && <RoomsTab job={localJob} onChange={handleChange} />}
              {activeTab === 'dead_legs' && <DeadLegsTab job={localJob} onChange={handleChange} />}
              {activeTab === 'showers' && <ShowersTab job={localJob} onChange={handleChange} />}
              {activeTab === 'issues' && <IssuesTab job={localJob} onChange={handleChange} />}
              {activeTab === 'actions' && <ActionsTab job={localJob} onChange={handleChange} />}
              {activeTab === 'photos' && <PhotosTab job={localJob} onChange={handleChange} />}
              {activeTab === 'logbook' && <LogbookTab job={localJob} onChange={handleChange} />}
              {activeTab === 'report' && <ReportTab job={localJob} onPrint={handlePrint} />}
            </div>

          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold mb-2">Delete job?</h2>
            <p className="text-sm text-gray-600 mb-5">This will permanently delete <strong>{localJob?.site_name || localJob?.client || 'this job'}</strong>. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDoDelete} className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-bold hover:bg-red-800">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}