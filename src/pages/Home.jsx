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
import IssuesTab from '@/components/dorset/tabs/IssuesTab';
import RoomsTab from '@/components/dorset/tabs/RoomsTab';
import DeadLegsTab from '@/components/dorset/tabs/DeadLegsTab';
import ShowersTab from '@/components/dorset/tabs/ShowersTab';

const TABS = [
  { id: 'jobs', label: '📁 Jobs' },
  { id: 'overview', label: 'Overview' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'systems', label: 'Systems' },
  { id: 'outlets', label: 'Outlets' },
  { id: 'issues', label: 'Issues' },
  { id: 'dead_legs', label: 'Dead Legs' },
  { id: 'showers', label: 'Showers' },
  { id: 'photos', label: 'Photos' },
  { id: 'logbook', label: 'Logbook' },
  { id: 'report', label: 'Report' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');
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
    if (selectedJob && (!localJob || localJob.id !== selectedJob.id)) {
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

  const handleNew = () => {
    createMutation.mutate(blankJob());
  };

  const handleChange = useCallback((changes) => {
    const current = localJobRef.current;
    if (!current) return;
    let updated = { ...current, ...changes };
    if (!updated.risk_override) {
      updated.risk = calculateRisk(updated);
    }
    localJobRef.current = updated;
    setLocalJob(updated);
    setSaveState('saving');
    if ('photos' in changes) {
      clearTimeout(debounceRef.current);
      updateMutation.mutate({ id: updated.id, data: updated });
    } else {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateMutation.mutate({ id: updated.id, data: updated });
      }, 800);
    }
  }, [updateMutation]);

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
      <Header onNew={handleNew} onDelete={handleDelete} saveState={saveState} hasJob={!!localJob} />

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

            {/* Left sidebar */}
            <div className="w-full lg:w-[280px] lg:flex-shrink-0">
              <JobList jobs={jobs} currentId={localJob.id} onSelect={(id) => { setCurrentId(id); }} />
              <MetricsBar job={localJob} />
              <ReportChecks job={localJob} />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
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
              {activeTab === 'jobs' && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <strong className="text-base">All saved jobs</strong>
                    <button onClick={handleNew} className="text-sm px-4 py-2 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>+ New job</button>
                  </div>
                  {jobs.length === 0 && <p className="text-sm text-gray-400">No jobs yet.</p>}
                  <div className="space-y-2">
                    {jobs.map(j => (
                      <div
                        key={j.id}
                        onClick={() => { setCurrentId(j.id); setActiveTab('overview'); }}
                        className={`border rounded-xl p-3 cursor-pointer transition-all hover:shadow-sm ${j.id === localJob?.id ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-red-300 bg-white'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-sm">{j.site_name || j.client || 'Untitled'}</div>
                            <div className="text-xs text-gray-500">{j.client}{j.client && j.assessment_date ? ' — ' : ''}{j.assessment_date}</div>
                            <div className="text-xs text-gray-400">{j.address}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold badge-${(j.risk||'low').toLowerCase()}`}>{j.risk || 'LOW'}</span>
                            <span className="text-xs text-gray-400">{j.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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