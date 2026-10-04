import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignIn } from '@clerk/clerk-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, isLoaded, setActive } = useSignIn();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/");
      } else {
        setError("Invalid credentials");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'An error occurred during login');
    }
  };

  return (
    <div>
      <h2 className="mb-6 text-center text-xl font-bold text-[var(--ink)]">Sign in to your account</h2>
      {error && (
        <div className="mb-4 rounded bg-[var(--critical-tint)] p-3 text-sm text-[var(--critical)]">
          {error}
        </div>
      )}
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--ink-2)]" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] p-2 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--ink-2)]" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] p-2 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            required
          />
        </div>
        <button
          type="submit"
          className="mt-2 w-full rounded bg-[var(--brand)] py-2 text-white font-semibold hover:bg-[var(--brand-hover)]"
        >
          Sign In
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-[var(--ink-3)]">
        Don't have an account?{' '}
        <button onClick={() => navigate('/register')} className="font-semibold text-[var(--brand)] hover:underline">
          Register
        </button>
      </div>
    </div>
  );
}
