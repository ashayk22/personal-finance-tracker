'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/lib/auth';
import { InteractionPreferencesProvider } from '../src/lib/interactionPreferences';
import { AuthCallback, LandingPage, LoginPage, ProtectedFinance } from './finance/AuthPages';

const FinancePage = dynamic(
  () => import('./finance/FinancePage').then((module) => module.FinancePage),
  { ssr: false, loading: () => <div className="ft-center">Loading your finances…</div> },
);

export default function FinanceShell() {
  return (
    <AuthProvider>
      <InteractionPreferencesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/app/finance/*" element={<ProtectedFinance><FinancePage /></ProtectedFinance>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </InteractionPreferencesProvider>
    </AuthProvider>
  );
}
