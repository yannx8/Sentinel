import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function RegisterPage() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="mb-6 text-center text-xl font-bold text-[var(--ink)]">Register Organization</h2>
      
      <div className="mb-6 flex justify-between gap-2">
        <div className={`h-2 flex-1 rounded ${step >= 1 ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'}`} />
        <div className={`h-2 flex-1 rounded ${step >= 2 ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'}`} />
        <div className={`h-2 flex-1 rounded ${step >= 3 ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'}`} />
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">Company Details</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--ink-2)]">Organization Name</label>
            <input className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] p-2 focus:border-[var(--brand)]" placeholder="Acme Corp" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--ink-2)]">Industry</label>
            <select className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] p-2 focus:border-[var(--brand)]">
              <option>Construction</option>
              <option>Manufacturing</option>
              <option>Logistics</option>
            </select>
          </div>
          <button onClick={() => setStep(2)} className="mt-4 w-full rounded bg-[var(--brand)] py-2 font-semibold text-white hover:bg-[var(--brand-hover)]">Next</button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">Primary Contact</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--ink-2)]">Full Name</label>
            <input className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] p-2 focus:border-[var(--brand)]" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--ink-2)]">Email</label>
            <input className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] p-2 focus:border-[var(--brand)]" type="email" placeholder="jane@acme.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--ink-2)]">Password</label>
            <input className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] p-2 focus:border-[var(--brand)]" type="password" />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 rounded border border-[var(--border)] bg-transparent py-2 font-semibold text-[var(--ink)] hover:bg-[var(--surface-sunken)]">Back</button>
            <button onClick={() => setStep(3)} className="flex-1 rounded bg-[var(--brand)] py-2 font-semibold text-white hover:bg-[var(--brand-hover)]">Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">Review & Submit</h3>
          <div className="rounded bg-[var(--canvas)] p-4 text-sm">
            <p><strong>Organization:</strong> Acme Corp</p>
            <p><strong>Admin:</strong> Jane Doe</p>
          </div>
          <p className="text-sm text-[var(--ink-disabled)]">By submitting, you agree to the Terms of Service.</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 rounded border border-[var(--border)] bg-transparent py-2 font-semibold text-[var(--ink)] hover:bg-[var(--surface-sunken)]">Back</button>
            <button onClick={() => {
              alert('Mock Registration Complete');
              navigate('/login');
            }} className="flex-1 rounded bg-[var(--success)] py-2 font-semibold text-white hover:bg-[#0f603f]">Register</button>
          </div>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-[var(--ink-3)]">
        Already have an account?{' '}
        <button onClick={() => navigate('/login')} className="font-semibold text-[var(--brand)] hover:underline">
          Sign in
        </button>
      </div>
    </div>
  );
}
