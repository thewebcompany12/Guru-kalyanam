'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';

function isRealSession(session: Session | null): session is Session {
  return Boolean(session && session.user.is_anonymous !== true);
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const recoveryInUrl = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
    if (recoveryInUrl) setRecoveryMode(true);

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!recoveryInUrl) setSession(isRealSession(data.session) ? data.session : null);
      setChecking(false);
    };

    void loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || (recoveryInUrl && event !== 'USER_UPDATED' && event !== 'SIGNED_OUT')) {
        setRecoveryMode(true);
        setResetMode(false);
        setSession(null);
      } else {
        setSession(isRealSession(nextSession) ? nextSession : null);
        if (event === 'USER_UPDATED' || (!recoveryInUrl && isRealSession(nextSession))) setRecoveryMode(false);
      }
      setChecking(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (recoveryMode) {
        if (password.length < 8) {
          setError('Choose a password with at least 8 characters.');
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          setError('The password could not be updated. Request a new reset link and try again.');
          return;
        }
        const { data } = await supabase.auth.getSession();
        setSession(isRealSession(data.session) ? data.session : null);
        setRecoveryMode(false);
        setPassword('');
        setNotice('Password updated successfully.');
        return;
      }

      if (resetMode) {
        if (!email.trim()) {
          setError('Enter your account email first.');
          return;
        }
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (resetError) {
          setError('The reset email could not be sent. Check the email address or contact your workspace administrator.');
          return;
        }
        setNotice('If that email belongs to an account, a password-reset link has been sent.');
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError || !isRealSession(data.session)) {
        setError('Sign-in failed. Check your email and password, or use the password-reset link.');
        return;
      }
      setSession(data.session);
      setPassword('');
    } catch {
      setError('Could not reach the authentication service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-5">
        <section className="card w-full max-w-sm p-7 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-500 text-white shadow-lg">🏫</div>
          <h1 className="text-xl font-bold text-slate-900">Checking secure access…</h1>
          <p className="mt-2 text-sm text-slate-500">Opening your private workspace.</p>
        </section>
      </main>
    );
  }

  if (session && !recoveryMode) return <>{children}</>;

  const heading = recoveryMode ? 'Set a new password' : resetMode ? 'Reset your password' : 'Sign in to your workspace';
  const description = recoveryMode
    ? 'Choose a new password to secure your account.'
    : resetMode
      ? 'We’ll email a secure password-reset link if the account exists.'
      : 'Use your registered workspace-owner account to access business records.';

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 px-4 py-8 sm:p-6">
      <section className="card w-full max-w-md p-6 sm:p-8">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-500 text-2xl text-white shadow-lg">🏫</div>
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Guru Kalyanam</p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900">{heading}</h1>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-600">{description}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {!recoveryMode && (
            <div>
              <label htmlFor="workspace-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Account email</label>
              <input
                id="workspace-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                placeholder="you@example.com"
              />
            </div>
          )}
          {(!resetMode || recoveryMode) && (
            <div>
              <label htmlFor="workspace-password" className="mb-1.5 block text-sm font-semibold text-slate-700">{recoveryMode ? 'New password' : 'Password'}</label>
              <input
                id="workspace-password"
                type="password"
                autoComplete={recoveryMode ? 'new-password' : 'current-password'}
                minLength={recoveryMode ? 8 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                placeholder={recoveryMode ? 'At least 8 characters' : 'Enter your password'}
              />
            </div>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{notice}</p>}

          <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Please wait…' : recoveryMode ? 'Update password' : resetMode ? 'Send reset link' : 'Sign in securely'}
          </button>
        </form>

        {!recoveryMode && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => { setResetMode((value) => !value); setError(''); setNotice(''); setPassword(''); }}
              className="min-h-10 px-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              {resetMode ? 'Back to sign in' : 'Forgot password?'}
            </button>
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4 text-center">
          <p className="text-xs leading-5 text-slate-500">Private business data is available only to registered accounts. Temporary guest sessions are not permitted.</p>
          <p className="mt-2 text-xs text-slate-400">Need access? Contact the workspace owner.</p>
        </div>
      </section>
    </main>
  );
}
