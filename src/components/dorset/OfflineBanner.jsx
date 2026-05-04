import React, { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (online) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white" style={{ background: '#1d1d1d', maxWidth: '90vw' }}>
      <span className="text-lg">📵</span>
      <div>
        <div>You're offline — changes cannot be saved</div>
        <div className="text-xs text-gray-400 font-normal">Reconnect to continue working</div>
      </div>
    </div>
  );
}