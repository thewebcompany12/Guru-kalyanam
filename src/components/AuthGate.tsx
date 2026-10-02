'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';

function isRealSession(session: Session | null): session is Session {
  return Boolean(session && session.user.is_anonymous !== true);
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [signUpMode, setSignUpMode] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const verifyWorkspaceAccess = useCallback(async (candidate: Session | null) => {
    if (!isRealSession(candidate)) {
      setSession(null);
      setPendingApproval(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', candidate.user.id)
      .maybeSingle();

    if (profileError || !data) {
      setSession(null);
      setPendingApproval(false);
      setError('We could not verify workspace access. Refresh the page or contact the workspace owner.');
    } else if (!data.is_active) {
      setSession(null);
      setPendingApproval(true);
      setError('');
    } else {
      setSession(candidate);
      setPendingApproval(false);
      setError('');
    }
    setChecking(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    const recoveryInUrl = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
    if (recoveryInUrl) setRecoveryMode(true);

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (recoveryInUrl) {
        setChecking(false);
        return;
      }
      await verifyWorkspaceAccess(data.session);
    };

    void loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || (recoveryInUrl && event !== 'USER_UPDATED' && event !== 'SIGNED_OUT')) {
        setRecoveryMode(true);
        setResetMode(false);
        setSignUpMode(false);
        setSession(null);
        setChecking(false);
      } else {
        if (event === 'USER_UPDATED') setRecoveryMode(false);
        void verifyWorkspaceAccess(nextSession);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, verifyWorkspaceAccess]);

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
        setRecoveryMode(false);
        setPassword('');
        await verifyWorkspaceAccess(data.session);
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

      if (signUpMode) {
        if (password.length < 8) {
          setError('Choose a password with at least 8 characters.');
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: email.trim().split('@')[0] } },
        });
        if (signUpError) {
          setError('Account registration failed. Check the email address or contact the workspace owner.');
          return;
        }
        setPassword('');
        if (data.session) {
          await verifyWorkspaceAccess(data.session);
          setNotice('Account created. Workspace access is pending owner approval.');
        } else {
          setNotice('Check your email to confirm your account. The workspace owner must approve access before business data is available.');
        }
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
      setPassword('');
      await verifyWorkspaceAccess(data.session);
    } catch {
      setError('Could not reach the authentication service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError('Could not sign out. Please try again.');
    setBusy(false);
  };

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-5">
        <section className="card w-full max-w-sm p-7 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-500 text-white shadow-lg">🏫</div>
          <h1 className="text-xl font-bold text-slate-900">Checking secure access…</h1>
          <p className="mt-2 text-sm text-slate-500">Verifying your workspace membership.</p>
        </section>
      </main>
    );
  }

  if (pendingApproval && !session && !recoveryMode) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 px-4 py-8 sm:p-6">
        <section className="card w-full max-w-md p-7 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-2xl">🔐</div>
          <h1 className="text-xl font-bold text-slate-900">Access awaiting approval</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your account is registered, but a workspace owner or administrator must approve it before you can view school, order, supplier, or financial records.</p>
          <button type="button" onClick={signOut} disabled={busy} className="mt-6 min-h-11 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Please wait…' : 'Sign out'}</button>
        </section>
      </main>
    );
  }

  if (session && !recoveryMode) return <>{children}</>;

  const heading = recoveryMode ? 'Set a new password' : resetMode ? 'Reset your password' : signUpMode ? 'Request workspace access' : 'Sign in to your workspace';
  const description = recoveryMode
    ? 'Choose a new password to secure your account.'
    : resetMode
      ? 'We’ll email a secure password-reset link if the account exists.'
      : signUpMode
        ? 'Create an account. It will remain locked until a workspace owner approves access.'
        : 'Use your registered workspace account to access business records.';

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
                autoComplete={recoveryMode || signUpMode ? 'new-password' : 'current-password'}
                minLength={recoveryMode || signUpMode ? 8 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                placeholder={recoveryMode || signUpMode ? 'At least 8 characters' : 'Enter your password'}
              />
            </div>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{notice}</p>}

          <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Please wait…' : recoveryMode ? 'Update password' : resetMode ? 'Send reset link' : signUpMode ? 'Create account' : 'Sign in securely'}
          </button>
        </form>

        {!recoveryMode && (
          <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {!signUpMode && !resetMode && (
              <button type="button" onClick={() => { setResetMode(true); setError(''); setNotice(''); setPassword(''); }} className="min-h-10 px-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                Forgot password?
              </button>
            )}
            {!resetMode && (
              <button
                type="button"
                onClick={() => { setSignUpMode((value) => !value); setError(''); setNotice(''); setPassword(''); }}
                className="min-h-10 px-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              >
                {signUpMode ? 'Already have an account? Sign in' : 'Request workspace access'}
              </button>
            )}
            {resetMode && (
              <button type="button" onClick={() => { setResetMode(false); setError(''); setNotice(''); }} className="min-h-10 px-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                Back to sign in
              </button>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4 text-center">
          <p className="text-xs leading-5 text-slate-500">Business records are available only to approved workspace members. New accounts cannot view records until approved.</p>
          <p className="mt-2 text-xs text-slate-400">Need access? Contact the workspace owner.</p>
        </div>
      </section>
    </main>
  );
}
