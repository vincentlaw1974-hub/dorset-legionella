import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';

export default function InviteModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // 'sending' | 'done' | 'error'
  const [message, setMessage] = useState('');

  const handleInvite = async () => {
    if (!email.trim()) return;
    setStatus('sending');
    try {
      await base44.users.inviteUser(email.trim(), 'user');
      setMessage(`Invite sent to ${email.trim()}`);
      setStatus('done');
      setEmail('');
    } catch (e) {
      setMessage(e?.message || 'Failed to send invite.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Invite a user</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Enter an email address to send an invitation to join the app.</p>
        <input
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleInvite()}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        {message && (
          <p className={`text-sm mb-3 ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Close</button>
          <button
            onClick={handleInvite}
            disabled={status === 'sending'}
            className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60"
            style={{ background: '#d71920' }}
          >
            {status === 'sending' ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  );
}