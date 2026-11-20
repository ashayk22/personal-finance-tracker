'use client';

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, LoaderCircle, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabaseClient';
import './auth.css';

export function ProtectedFinance({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="ft-center"><LoaderCircle className="ft-spin"/><span>Checking your Moneta session…</span></div>;
  if (!user) return <Navigate to="/login" replace/>;
  return <>{children}</>;
}

export function LandingPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/app/finance" replace/>;
  return <main className="ft-auth-page"><header className="ft-auth-nav"><a className="ft-auth-brand" href="/"><span><Wallet size={20}/></span>Moneta</a><a className="ft-auth-login-link" href="/login">Sign in <ArrowRight size={15}/></a></header><section className="ft-auth-hero"><div className="ft-auth-copy"><span className="ft-auth-kicker"><span/> PERSONAL FINANCE, WITH CLARITY</span><h1>A calmer way to<br/><em>manage your money.</em></h1><p>One private place for everyday spending, savings goals, investments, and the commitments ahead.</p><a href="/login" className="ft-auth-cta">Get started <ArrowRight size={17}/></a><div className="ft-auth-assurance"><ShieldCheck size={16}/><span>Your financial records stay private to your account.</span></div></div><div className="ft-auth-orbit" aria-hidden="true"><div className="ft-auth-orbit-ring ring-one"/><div className="ft-auth-orbit-ring ring-two"/><div className="ft-auth-orbit-dot dot-one"/><div className="ft-auth-orbit-dot dot-two"/><div className="ft-auth-orbit-card"><span>MONETA / YOUR MONEY</span><strong>Clarity in every<br/>financial decision.</strong><div><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><small><Check size={13}/> Private by design</small></div></div></section><footer className="ft-auth-footer"><span>MONETA</span><span>Private workspace · Built for real life</span></footer></main>;
}

export function LoginPage() {
  const { user, signInWithGoogle, error: configError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  if (user) return <Navigate to="/app/finance" replace/>;
  const stateError = (location.state as { message?: string } | null)?.message;
  const signIn = async () => {
    setBusy(true); setError('');
    try { await signInWithGoogle(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Google sign-in could not be started.'); setBusy(false); }
  };
  return <main className="ft-auth-page ft-auth-page-login"><a className="ft-auth-brand ft-auth-login-brand" href="/"><span><Wallet size={20}/></span>Moneta</a><section className="ft-auth-card"><div className="ft-auth-card-mark"><Wallet size={21}/></div><span className="ft-auth-kicker">YOUR FINANCES, IN FOCUS</span><h1>Welcome to Moneta</h1><p>Sign in or create your private finance workspace.</p><button type="button" className="ft-auth-google" onClick={()=>void signIn()} disabled={busy||Boolean(configError)}><GoogleMark/>{busy?<><LoaderCircle className="ft-spin" size={17}/>Connecting…</>:'Continue with Google'}</button>{(error||configError||stateError)&&<div className="ft-auth-error" role="alert">{error||configError||stateError}</div>}<div className="ft-auth-privacy"><ShieldCheck size={15}/> Your financial data is private to your account.</div></section><p className="ft-auth-back"><a href="/">Back to Moneta</a></p></main>;
}

type CallbackResult = { ok: true } | { ok: false; message: string };

const exchangeAttempts = new Map<string, Promise<CallbackResult>>();

function callbackFailure(message: string): string {
  if (/flow state|pkce|code verifier|verifier/i.test(message)) {
    return 'This sign-in link has expired or its browser verification state is unavailable. Return to sign in and start again in the same browser and site address.';
  }
  return message || 'Google sign-in could not be completed. Return to sign in and try again.';
}

function exchangeAuthorizationCodeOnce(code: string): Promise<CallbackResult> {
  const existing = exchangeAttempts.get(code);
  if (existing) return existing;

  const attempt = (async (): Promise<CallbackResult> => {
    if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, message: callbackFailure(error.message) };

    // Confirm Supabase persisted the session before allowing the protected route.
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return { ok: false, message: callbackFailure(sessionError.message) };
    if (!data.session || !sessionData.session) {
      return { ok: false, message: 'Google sign-in did not establish a session. Return to sign in and try again.' };
    }
    return { ok: true };
  })().catch((cause: unknown) => ({
    ok: false as const,
    message: callbackFailure(cause instanceof Error ? cause.message : ''),
  }));

  // Keep only the outcome promise in memory. This prevents Strict Mode/remounts
  // from exchanging the same one-time PKCE code twice; no tokens are retained here.
  exchangeAttempts.set(code, attempt);
  return attempt;
}

export function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Securing your Moneta session...');
  useEffect(() => {
    let active = true;
    const finish = async () => {
      if (!supabase) {
        if (active) setMessage('Supabase is not configured.');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const authError = params.get('error_description') || params.get('error');
      if (authError) {
        if (active) setMessage(callbackFailure(authError));
        return;
      }

      const code = params.get('code');
      if (code) {
        const result = await exchangeAuthorizationCodeOnce(code);
        if (!active) return;
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
      } else {
        // A callback without a code is accepted only when a session already exists.
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error || !data.session) {
          setMessage(callbackFailure(error?.message || 'No authorization code or active session was found.'));
          return;
        }
      }

      if (active) navigate('/app/finance', { replace: true });
    };

    void finish().catch((cause: unknown) => {
      if (active) setMessage(callbackFailure(cause instanceof Error ? cause.message : ''));
    });
    return () => { active = false; };
  }, [navigate]);

  return <main className="ft-auth-page ft-auth-callback"><div className="ft-auth-card-mark"><Wallet size={21}/></div><LoaderCircle className="ft-spin" size={22}/><p>{message}</p>{message !== 'Securing your Moneta session...'&&<a className="ft-auth-cta" href="/login">Return to sign in <ArrowRight size={16}/></a>}</main>;
}
function GoogleMark() { return <svg aria-hidden="true" viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.64 5.94c4.46-4.11 7.14-10.16 7.14-17.59z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.55 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.81l-7.64-5.94c-2.13 1.43-4.85 2.27-8.27 2.27-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>; }
