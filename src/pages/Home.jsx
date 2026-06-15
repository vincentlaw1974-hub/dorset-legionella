import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { blankJob, reportChecks, buildControlScheme, calculateRisk } from '@/lib/jobUtils';
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
import AiAdviceTab from '@/components/dorset/tabs/AiAdviceTab';
import BuildingsTab from '@/components/dorset/tabs/BuildingsTab';
import StatusGroupedTab from '@/components/dorset/tabs/StatusGroupedTab';
import TmvsTab from '@/components/dorset/tabs/TmvsTab';
import AiPhotoImportTab from '@/components/dorset/tabs/AiPhotoImportTab';
import AiDirectReportTab from '@/components/dorset/tabs/AiDirectReportTab';
import OfflineBanner from '@/components/dorset/OfflineBanner';

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'overview', label: 'Overview' },
  { id: 'management', label: 'Management' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'buildings', label: '🏘️ Buildings', holidayParkOnly: true },
  { id: 'systems', label: 'Systems' },
  { id: 'tmvs', label: '🔧 TMVs' },
  { id: 'outlets', label: 'Outlets' },
  { id: 'issues', label: 'Issues' },
  { id: 'dead_legs', label: 'Dead Legs' },
  { id: 'showers', label: 'Showers' },
  { id: 'actions', label: 'Actions' },
  { id: 'photos', label: 'Photos' },
  { id: 'logbook', label: 'Logbook' },
  { id: 'report', label: '📄 Report' },
  { id: 'ai_photo_import', label: '📸 AI Import' },
  { id: 'ai_advice', label: '🤖 AI Advice' },
  { id: 'ai_direct_report', label: '📋 AI Report' },
];

// stripBase64 is imported from photoUpload

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobsView, setJobsView] = useState('list');
  const [dashSubTab, setDashSubTab] = useState('jobs');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [tabMemory, setTabMemory] = useState({});
  const [aiConversations, setAiConversations] = useState({}); // jobId -> messages[]
  const [unlockedJobs, setUnlockedJobs] = useState({}); // jobId -> true when unlocked
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const UNLOCK_PIN = '1234'; // simple 4-digit PIN to unlock a completed/reviewed report
  const queryClient = useQueryClient();



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

  // Real-time subscription: update jobs list when another device saves
  // Do NOT overwrite localJob from subscription — it causes status reversion bugs
  useEffect(() => {
    const unsubscribe = base44.entities.Job.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    });
    return unsubscribe;
  }, [queryClient]);

  const selectedJob = jobs.find(j => j.id === (currentId || jobs[0]?.id)) || jobs[0] || null;

  useEffect(() => {
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
      setActiveTab('overview');
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
    onError: () => {
      setSaveState('idle');
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
    const nextJob = jobs.find(j => j.id === id);
    if (nextJob) {
      localJobRef.current = nextJob;
      setLocalJob(nextJob);
    }
    setCurrentId(id);
    // Restore remembered tab for this job, or default to overview (never restore dashboard)
    const remembered = tabMemory[id];
    setActiveTab(remembered && remembered !== 'dashboard' ? remembered : 'overview');
    setDashSubTab('jobs');
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

  // Remember the active tab per job — flush pending save immediately on tab switch
  const handleTabChange = (tab) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      if (localJobRef.current && navigator.onLine) {
        updateMutation.mutate({ id: localJobRef.current.id, data: stripBase64(localJobRef.current) });
      }
    }
    setActiveTab(tab);
    if (currentId) setTabMemory(m => ({ ...m, [currentId]: tab }));
  };


    const handleChange = useCallback((changes) => {
    const current = localJobRef.current;
    if (!current) return;
    let updated;

    // Auto-set cqc_mode based on property type so temperature thresholds are correct
    if (changes.property_type && !current.risk_override) {
      const pt = changes.property_type;
      const isCare = pt === 'Nursing Home' || pt === 'Care Home';
      if (!changes.hasOwnProperty('cqc_mode')) {
        changes = { ...changes, cqc_mode: isCare };
      }
    }

    // Add a single new photo without overwriting concurrent additions
    if (changes.__addPhoto) {
      updated = { ...current, photos: [...(current.photos || []), changes.__addPhoto] };
    // Safe patch: upgrade a single photo's url by id (avoids stale closure overwriting new photos)
    } else if (changes.__photoUpgrade) {
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

    // CDN upgrades: save immediately without debounce
    if (changes.__photoUpgrade || changes.__buildingPhotoUpgrade || changes.__buildingOutletPhotoUpgrade) {
      clearTimeout(debounceRef.current);
      if (localJobRef.current?.id === jobId) {
        updateMutation.mutate({ id: jobId, data: stripBase64(localJobRef.current) });
      }
    } else {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (localJobRef.current?.id === jobId) {
          updateMutation.mutate({ id: jobId, data: stripBase64(localJobRef.current) });
        }
      }, 800);
    }
  }, [updateMutation]);

  const isLocked = localJob &&
    (localJob.status === 'Completed' || localJob.status === 'Reviewed') &&
    !unlockedJobs[localJob.id];

  const handleUnlockSubmit = () => {
    if (unlockPin === UNLOCK_PIN) {
      setUnlockedJobs(prev => ({ ...prev, [localJob.id]: true }));
      setShowUnlockModal(false);
      setUnlockPin('');
      setUnlockError('');
    } else {
      setUnlockError('Incorrect PIN. Please try again.');
      setUnlockPin('');
    }
  };

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
      <OfflineBanner />
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



      {/* Floating AI Advice button — always visible when a job is open */}
      {localJob && activeTab !== 'ai_advice' && (
        <button
          onClick={() => handleTabChange('ai_advice')}
          className="fixed bottom-6 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-white font-bold text-sm"
          style={{ background: '#d71920' }}
        >
          🤖 <span>AI Advice</span>
        </button>
      )}

      {localJob && activeTab !== 'dashboard' && (
        <div className="max-w-6xl mx-auto px-3 py-0 pb-24">
          {/* Mobile: stacked. Desktop: side-by-side */}
          <div className="flex flex-col lg:flex-row gap-3 items-start">

            {/* Sidebar — full width on mobile, fixed 280px on desktop */}
            <div className="w-full lg:w-[280px] lg:flex-shrink-0">
              <MetricsBar job={localJob} />
              <ReportChecks job={localJob} />
            </div>

            {/* Main content */}
            <div key={localJob.id} className="w-full lg:flex-1 min-w-0">
              {/* Lock banner for completed/reviewed jobs */}
              {isLocked && (
                <div className="mb-3 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-amber-300 bg-amber-50">
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <span className="text-lg">🔒</span>
                    <span><strong>Report locked.</strong> Status is <em>{localJob.status}</em> — data is protected. View the report below or unlock to edit.</span>
                  </div>
                  <button
                    onClick={() => { setShowUnlockModal(true); setUnlockError(''); setUnlockPin(''); }}
                    className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold text-white flex-shrink-0"
                    style={{ background: '#d71920' }}
                  >🔓 Unlock</button>
                </div>
              )}
              {isLocked ? (
                <div className="space-y-3">
                  <SchematicTab job={localJob} onChange={() => {}} />
                  <ReportTab job={localJob} onPrint={handlePrint} onChange={null} />
                </div>
              ) : (
                <>
                  {activeTab === 'buildings' && <BuildingsTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'overview' && <OverviewTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'management' && <ManagementTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'systems' && <SystemsTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'tmvs' && <TmvsTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'outlets' && <OutletsTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'rooms' && <RoomsTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'dead_legs' && <DeadLegsTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'showers' && <ShowersTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'issues' && <IssuesTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'actions' && <ActionsTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'photos' && <PhotosTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'logbook' && <LogbookTab job={localJob} onChange={handleChange} />}
                  {activeTab === 'ai_photo_import' && <AiPhotoImportTab job={localJob} onChange={(updatedJob) => {
                    // AiPhotoImportTab passes a full updated job object — apply it directly
                    const withRisk = { ...updatedJob, risk: updatedJob.risk_override ? updatedJob.risk : calculateRisk(updatedJob) };
                    localJobRef.current = withRisk;
                    setLocalJob(withRisk);
                    setSaveState('saving');
                    clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                      updateMutation.mutate({ id: withRisk.id, data: stripBase64(withRisk) });
                    }, 800);
                  }} />}
                  {activeTab === 'ai_direct_report' && <AiDirectReportTab job={localJob} />}
                  {activeTab === 'ai_advice' && <AiAdviceTab job={localJob} onChange={handleChange} messages={aiConversations[localJob.id]} onMessagesChange={(msgs) => setAiConversations(prev => ({ ...prev, [localJob.id]: msgs }))} />}
                  {activeTab === 'report' && (
                    <div className="space-y-3">
                      <SchematicTab job={localJob} onChange={handleChange} />
                      <ReportTab job={localJob} onPrint={handlePrint} onChange={handleChange} />
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🔒</div>
              <h2 className="text-lg font-bold">Unlock Report</h2>
              <p className="text-sm text-gray-500 mt-1">This report is <strong>{localJob?.status}</strong>. Enter the PIN to unlock editing.</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Enter 4-digit PIN"
              value={unlockPin}
              onChange={e => setUnlockPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlockSubmit()}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-red-400 mb-2"
              autoFocus
            />
            {unlockError && <p className="text-red-600 text-sm text-center mb-2">{unlockError}</p>}
            <div className="flex gap-3 mt-3">
              <button onClick={() => { setShowUnlockModal(false); setUnlockPin(''); setUnlockError(''); }} className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleUnlockSubmit} className="flex-1 px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: '#d71920' }}>Unlock</button>
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