import React from 'react';
import { useNavigate } from 'react-router-dom';

export function InviteAcceptancePage() {
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="mb-6 text-center text-xl font-bold text-[var(--ink)]">Accept Invitation</h2>
      
      <div className="mb-6 rounded bg-[var(--canvas)] p-4 text-center">
        <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand)] text-white font-bold text-lg">
          N
        </div>
        <p className="text-sm font-medium">You have been invited to join</p>
        <p className="text-lg font-bold">Nexus Inc.</p>
        <p className="mt-2 text-xs text-[var(--ink-disabled)]">Role: Intervenant</p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--ink-2)]">Full Name</label>
          <input className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] p-2 focus:border-[var(--brand)]" placeholder="John Smith" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--ink-2)]">Set Password</label>
          <input className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] p-2 focus:border-[var(--brand)]" type="password" />
        </div>
        <button onClick={() => {
          alert('Mock Invite Acceptance Complete');
          navigate('/login');
        }} className="mt-4 w-full rounded bg-[var(--brand)] py-2 font-semibold text-white hover:bg-[var(--brand-hover)]">
          Join Organization
        </button>
      </div>
    </div>
  );
}
