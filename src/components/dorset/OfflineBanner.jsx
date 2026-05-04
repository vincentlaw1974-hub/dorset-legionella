import React, { useState, useEffect } from 'react';

export default function OfflineBanner({ pendingSync, onRetry }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [justReturned, setJustReturned] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setJustReturned(true);
      setTimeout(() => setJustReturned(false), 3000);
    };
    const handleOffline = () => {
      setOnline(false);
      setJustReturned(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online && !justReturned && !pendingSync) return null;

  if (!online) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white" style={{ background: '#1d1d1d', maxWidth: '90vw' }}>
        <span className="text-lg">📵</span>
        <div>
          <div>You're offline — photos &amp; data saved to device</div>
          <div className="text-xs text-gray-400 font-normal">Will upload automatically when signal returns</div>
        </div>
      </div>
    );
  }

  if (justReturned) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white" style={{ background: '#15803d', maxWidth: '90vw' }}>
        <span className="text-lg">✅</span>
        <div>Back online — changes saved</div>
      </div>
    );
  }

  if (pendingSync) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white" style={{ background: '#d97706', maxWidth: '90vw' }}>
        <span className="text-lg">⚠️</span>
        <div>
          <div>Photos pending upload</div>
          <div className="text-xs font-normal opacity-80">Tap "Retry now" or they'll upload automatically</div>
        </div>
        {online && (
          <button
            onClick={onRetry}
            className="ml-2 px-3 py-1 rounded-xl bg-white text-orange-700 font-bold text-xs hover:bg-orange-50"
          >Retry now</button>
        )}
      </div>
    );
  }

  return null;
}