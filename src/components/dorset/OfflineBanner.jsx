import React, { useState, useEffect, useCallback } from 'react';
import { syncAllPendingDrafts, getAllPendingDraftIds } from '@/lib/syncManager';

export default function OfflineBanner({ pendingSync, onRetry }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [justReturned, setJustReturned] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const pendingCount = getAllPendingDraftIds().length;

  const runSync = useCallback(async () => {
    setSyncing(true);
    const result = await syncAllPendingDrafts();
    setSyncResult(result);
    setSyncing(false);
    onRetry?.();
  }, [onRetry]);

  // Listen for Background Sync completion messages from the service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event) => {
      if (event.data?.type === 'SYNC_COMPLETE' && event.data.synced > 0) {
        setSyncResult({ synced: event.data.synced });
        setJustReturned(true);
        onRetry?.();
        setTimeout(() => setJustReturned(false), 4000);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [onRetry]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setJustReturned(true);
      runSync();
      setTimeout(() => setJustReturned(false), 4000);
    };
    const handleOffline = () => { setOnline(false); setJustReturned(false); setSyncResult(null); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runSync]);

  if (online && !justReturned && !pendingSync) return null;

  if (!online) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white" style={{ background: '#1d1d1d', maxWidth: '90vw' }}>
        <span className="text-lg">📵</span>
        <div>
          <div>You're offline — changes are saved locally</div>
          <div className="text-xs text-gray-400 font-normal">Will sync automatically when signal returns</div>
        </div>
      </div>
    );
  }

  if (justReturned) {
    const msg = syncing
      ? `Syncing ${pendingCount} pending change${pendingCount !== 1 ? 's' : ''}...`
      : syncResult?.synced > 0
        ? `✅ ${syncResult.synced} job${syncResult.synced !== 1 ? 's' : ''} synced successfully`
        : 'Back online — all changes saved';
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white" style={{ background: syncing ? '#1d4ed8' : '#15803d', maxWidth: '90vw' }}>
        <span className="text-lg">{syncing ? '🔄' : '✅'}</span>
        <div>{msg}</div>
      </div>
    );
  }

  if (pendingSync) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white" style={{ background: '#d97706', maxWidth: '90vw' }}>
        <span className="text-lg">🔄</span>
        <div>Syncing unsaved changes...</div>
      </div>
    );
  }

  return null;
}