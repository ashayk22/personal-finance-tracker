'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

const FinancePage = dynamic(
  () => import('./finance/FinancePage').then((module) => module.FinancePage),
  { ssr: false, loading: () => <div className="ft-center">Loading your finances…</div> },
);

export default function FinanceShell() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FinancePage />} />
        <Route path="/app/finance/*" element={<FinancePage />} />
      </Routes>
    </BrowserRouter>
  );
}
