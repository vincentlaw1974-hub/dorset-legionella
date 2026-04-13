import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { blankJob, reportChecks, buildControlScheme, calculateRisk } from '@/lib/jobUtils';
import { saveDraft, clearDraft, getDraft, syncAllPendingDrafts, getAllPendingDraftIds } from '@/lib/syncManager';
import { stripBase64 } from '@/lib/photoUpload';

import Header from '@/components/dorset/Header';
import JobList from '@/components/dorset/JobList';
import MetricsBar from '@/components/dorset/MetricsBar';
import ReportChecks from '@/components/dorset/ReportChecks';
import OverviewTab from '@/components/dorset/tabs/OverviewTab';
import ManagementTab from '@/components/dorset/tabs/ManagementTab';
import SystemsTab from '@/components/dorset/tabs/SystemsTab';
import OutletsTab from '@/components/dorset/tabs/OutletsTab';
import ActionsTab from '@/components/dorset/tabs/ActionsTab';
import PhotosTab from '@/components/dorset/tabs/PhotosTab.jsx';
import LogbookTab from '@/components/dorset/tabs/LogbookTab';
import ReportTab from '@/components/dorset/tabs/ReportTab';
import JobsListPanel from '@/components/dorset/JobsListPanel';
import IssuesTab from '@/components/dorset/tabs/IssuesTab';
import RoomsTab from '@/components/dorset/tabs/RoomsTab';
import DeadLegsTab from '@/components/dorset/tabs/DeadLegsTab';
import ShowersTab from '@/components/dorset/tabs/ShowersTab';
import RenewalsTab from '@/components/dorset/tabs/RenewalsTab';
import DashboardTab from '@/components/dorset/tabs/DashboardTab';
import SchematicTab from '@/components/dorset/tabs/SchematicTab';
import BuildingsTab from '@/components/dorset/tabs/BuildingsTab';
import StatusGroupedTab from '@/components/dorset/tabs/StatusGroupedTab';
import OfflineBanner from '@/components/dorset/OfflineBanner';

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'overview', label: 'Overview' },
  { id: 'management', label: 'Management' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'buildings', label: '🏘️ Buildings', holidayParkOnly: true },
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

// stripBase64 is imported from photoUpload

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobsView, setJobsView] = useState('list');
  const [dashSubTab, setDashSubTab] = useState('jobs');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [tabMemory, setTabMemory] = useState({});
  const queryClient = useQueryClient();

  // Flush current job to server on page close (best-effort)
  useEffect(() => {
    const flush = () => {
      const job = localJobRef.current;
      if (!job?.id) return;
      // Use sendBeacon for guaranteed delivery on page unload (async-safe)
      const stripped = stripBase64(job);
      try {
        saveDraft(job.id, job); // always keep base64 draft in localStorage
      } catch {}
      // Attempt a synchronous XHR as last resort (sendBeacon doesn't support auth headers)
      // The draft in localStorage will be synced on next open regardless
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  const JOBS_CACHE_KEY = 'dorset_jobs_cache';

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const result = await base44.entities.Job.list('-created_date');
      try { localStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(result)); } catch {}
      return result;
    },
    // Seed from localStorage if offline / first render
    initialData: () => {
      try {
        const cached = localStorage.getItem(JOBS_CACHE_KEY);
        return cached ? JSON.parse(cached) : undefined;
      } catch { return undefined; }
    },
    initialDataUpdatedAt: () => {
      // Treat cached data as 5 min old so it refetches when online
      return Date.now() - 5 * 60 * 1000;
    },
  });

  const urlJobId = new URLSearchParams(window.location.search).get('job');
  const [currentId, setCurrentId] = useState(urlJobId || null);
  const [localJob, setLocalJob] = useState(null);
  const debounceRef = useRef(null);
  const localJobRef = useRef(null);

  // Real-time subscription: update jobs list and current job when another device saves
  useEffect(() => {
    const unsubscribe = base44.entities.Job.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      // If the updated job is currently open and we don't have a local draft, reload it
      if (event.type === 'update' && event.id === localJobRef.current?.id) {
        const hasDraft = !!getDraft(event.id);
        if (!hasDraft && event.data) {
          setLocalJob(event.data);
          localJobRef.current = event.data;
        }
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const selectedJob = jobs.find(j => j.id === (currentId || jobs[0]?.id)) || jobs[0] || null;

  useEffect(() => {
    if (selectedJob && localJobRef.current?.id !== selectedJob.id) {
      const draft = getDraft(selectedJob.id);
      if (draft) {
        // Always load from draft — it represents unsaved offline changes
        setLocalJob(draft);
        localJobRef.current = draft;
        // If we're online, push the draft to the server immediately
        if (navigator.onLine) {
          base44.entities.Job.update(draft.id, stripBase64(draft))
            .then(() => {
              clearDraft(draft.id);
              queryClient.invalidateQueries({ queryKey: ['jobs'] });
            })
            .catch(() => {}); // stays in draft on failure, will retry on next reconnect
        }
      } else {
        // No draft — server data is authoritative
        setLocalJob(selectedJob);
        localJobRef.current = selectedJob;
      }
    }
  }, [selectedJob?.id]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setCurrentId(created.id);
      setLocalJob(created);
      setActiveTab('overview');
    },
  });

  const [saveState, setSaveState] = useState('idle');
  const [pendingSync, setPendingSync] = useState(false);

  // Auto-retry: every 8 seconds, if there are pending drafts and we're online, push them
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      const ids = getAllPendingDraftIds();
      if (ids.length === 0) { setPendingSync(false); return; }
      const { synced } = await syncAllPendingDrafts();
      if (synced > 0) {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        setPendingSync(getAllPendingDraftIds().length > 0);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setSaveState('saved');
      setPendingSync(false);
      clearDraft(id);
      setTimeout(() => setSaveState('idle'), 2000);
    },
    onError: () => {
      setSaveState('idle');
      setPendingSync(true);
      // Explicitly save draft so retry loop can pick it up
      if (localJobRef.current) saveDraft(localJobRef.current.id, localJobRef.current);
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
        updateMutation.mutate({ id: localJobRef.current.id, data: stripBase64(localJobRef.current) });
      }
    }
    // Find the job — prefer draft if one exists (offline changes)
    const nextJob = jobs.find(j => j.id === id);
    if (nextJob) {
      const draft = getDraft(id);
      const jobToLoad = draft || nextJob;
      localJobRef.current = jobToLoad;
      setLocalJob(jobToLoad);
    }
    setCurrentId(id);
    // Restore remembered tab for this job, or default to overview (never restore dashboard)
    const remembered = tabMemory[id];
    setActiveTab(remembered && remembered !== 'dashboard' ? remembered : 'overview');
    setDashSubTab('jobs');
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

  // Remember the active tab per job
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (currentId) setTabMemory(m => ({ ...m, [currentId]: tab }));
  };


    const handleChange = useCallback((changes) => {
    const current = localJobRef.current;
    if (!current) return;
    let updated;

    // Safe patch: upgrade a single photo's url by id (avoids stale closure overwriting new photos)
    if (changes.__photoUpgrade) {
      const { id, url } = changes.__photoUpgrade;
      updated = { ...current, photos: (current.photos || []).map(p => p.id === id ? { ...p, file_url: url } : p) };
    } else if (changes.__arrayPatch) {
      // Patch a single item in a top-level array (outlets, showers, dead_legs)
      const { key, id, field, value } = changes.__arrayPatch;
      updated = { ...current, [key]: (current[key] || []).map(item => item.id === id ? { ...item, [field]: value } : item) };
    } else if (changes.__buildingPhotoUpgrade) {
      const { buildingId, photoId, url } = changes.__buildingPhotoUpgrade;
      updated = { ...current, buildings: (current.buildings || []).map(b => b.id === buildingId ? { ...b, photos: (b.photos || []).map(p => p.id === photoId ? { ...p, file_url: url } : p) } : b) };
    } else if (changes.__buildingOutletPhotoUpgrade) {
      const { buildingId, outletId, url } = changes.__buildingOutletPhotoUpgrade;
      updated = { ...current, buildings: (current.buildings || []).map(b => b.id === buildingId ? { ...b, outlets: (b.outlets || []).map(o => o.id === outletId ? { ...o, photo_url: url } : o) } : b) };
    } else {
      updated = { ...current, ...changes };
    }

    if (!updated.risk_override) {
      updated.risk = calculateRisk(updated);
    }
    const jobId = current.id;
    localJobRef.current = updated;
    setLocalJob(updated);
    setSaveState('saving');
    saveDraft(jobId, updated);
    if (!navigator.onLine) {
      setPendingSync(true);
      return;
    }
    // Skip server save if the value is base64 (wait for CDN upload to complete first)
    const isBase64Value =
      (changes.__arrayPatch && typeof changes.__arrayPatch.value === 'string' && changes.__arrayPatch.value.startsWith('data:')) ||
      Object.values(changes).some(v => typeof v === 'string' && v.startsWith('data:'));
    if (!isBase64Value) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (localJobRef.current?.id === jobId) {
          updateMutation.mutate({ id: jobId, data: stripBase64(localJobRef.current) });
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

  const handleRetrySync = useCallback(async () => {
    const result = await syncAllPendingDrafts();
    if (result.synced > 0) {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setPendingSync(false);
    }
  }, [queryClient]);



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

  // Only show spinner on truly first load (no cached data at all)
  if (isLoading && jobs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#f6f7f9' }}>
      <OfflineBanner pendingSync={pendingSync} onRetry={handleRetrySync} />
      <Header onNew={handleNew} onDelete={handleDelete} onDuplicate={handleDuplicate} saveState={saveState} hasJob={!!localJob} job={localJob} jobs={jobs} onSelect={handleSelect} />

      {jobs.length === 0 && (
        <div className="max-w-6xl mx-auto px-3 py-16 text-center">
          <p className="text-gray-500 mb-4">No jobs yet. Create your first job to get started.</p>
          <button onClick={handleNew} className="px-6 py-3 rounded-xl font-bold text-white text-sm" style={{ background: '#d71920' }}>
            New job
          </button>
        </div>
      )}

      {/* Renewals banner */}
      {activeTab === 'dashboard' && jobs.some(j => j.review_due && new Date(j.review_due) < new Date(Date.now() + 30*24*60*60*1000)) && (
        <div className="max-w-6xl mx-auto px-3 pt-3">
          <button onClick={() => setDashSubTab('renewals')} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-all">
            <span>🔔</span>
            <span>{jobs.filter(j => j.review_due && new Date(j.review_due) < new Date(Date.now() + 30*24*60*60*1000)).length} job{jobs.filter(j => j.review_due && new Date(j.review_due) < new Date(Date.now() + 30*24*60*60*1000)).length !== 1 ? 's' : ''} due for review within 30 days — click to view</span>
            <span className="ml-auto text-amber-600">→</span>
          </button>
        </div>
      )}

      {/* Global tabs — always visible when jobs exist */}
      {jobs.length > 0 && (
        <div className="max-w-6xl mx-auto px-3 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none" style={{WebkitOverflowScrolling:'touch', maxWidth:'100vw'}}>
            {activeTab === 'dashboard' ? (
              <>
                {[{id:'jobs',label:'📁 Jobs'},{id:'renewals',label:'🔔 Renewals'},{id:'stats',label:'📊 Stats'}].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDashSubTab(t.id)}
                    className={`whitespace-nowrap px-4 py-3 rounded-full text-sm font-semibold border transition-all flex-shrink-0 ${dashSubTab === t.id ? 'text-white border-transparent' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
                    style={dashSubTab === t.id ? { background: '#d71920', borderColor: '#d71920' } : {}}
                  >{t.label}</button>
                ))}
                {localJob && <button onClick={() => handleTabChange('overview')} className="whitespace-nowrap px-4 py-3 rounded-full text-sm font-semibold border bg-white text-gray-800 border-gray-300 hover:bg-gray-50 flex-shrink-0">Open Job →</button>}
              </>
            ) : (
              <>
                <button
                  onClick={() => handleTabChange('dashboard')}
                  className="whitespace-nowrap px-4 py-3 rounded-full text-sm font-semibold border bg-white text-gray-800 border-gray-300 hover:bg-gray-50 flex-shrink-0"
                >📊 Dashboard</button>
                {TABS.filter(t => t.id !== 'dashboard' && (!t.holidayParkOnly || localJob?.property_type === 'Holiday Park')).map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTabChange(t.id)}
                    className={`whitespace-nowrap px-4 py-3 rounded-full text-sm font-semibold border transition-all flex-shrink-0 ${activeTab === t.id ? 'text-white border-transparent' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
                    style={activeTab === t.id ? { background: '#d71920', borderColor: '#d71920' } : {}}
                  >{t.label}</button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Portfolio-level tabs — no job needed */}
      {activeTab === 'dashboard' && jobs.length > 0 && (
        <div className="max-w-6xl mx-auto px-3 pb-24">
          {dashSubTab === 'jobs' && (
            <div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setJobsView('list')} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${jobsView === 'list' ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-300'}`} style={jobsView === 'list' ? { background: '#d71920' } : {}}>📁 List</button>
                <button onClick={() => setJobsView('status')} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${jobsView === 'status' ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-300'}`} style={jobsView === 'status' ? { background: '#d71920' } : {}}>📋 By Status</button>
              </div>
              {jobsView === 'list' && <JobsListPanel jobs={jobs} currentId={localJob?.id} onSelect={handleSelect} onNew={handleNew} />}
              {jobsView === 'status' && <StatusGroupedTab jobs={jobs} onSelect={handleSelect} />}
            </div>
          )}
          {dashSubTab === 'renewals' && <RenewalsTab jobs={jobs} onSelect={handleSelect} />}
          {dashSubTab === 'stats' && <DashboardTab jobs={jobs} onSelect={handleSelect} onTabChange={setActiveTab} />}
        </div>
      )}



      {localJob && activeTab !== 'dashboard' && (
        <div className="max-w-6xl mx-auto px-3 py-0 pb-24">
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
              <MetricsBar job={localJob} />
              <ReportChecks job={localJob} />
            </div>

            {/* Main content */}
            <div key={localJob.id} className="flex-1 min-w-0">
              {activeTab === 'buildings' && <BuildingsTab job={localJob} onChange={handleChange} />}
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
              {activeTab === 'report' && (
                <div className="space-y-3">
                  <SchematicTab job={localJob} onChange={handleChange} />
                  <ReportTab job={localJob} onPrint={handlePrint} />
                </div>
              )}
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