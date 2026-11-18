'use client';
import dynamic from 'next/dynamic';

const FinanceShell = dynamic(() => import('./FinanceShell'), {
  ssr: false,
  loading: () => <div className="ft-center">Loading your finances…</div>,
});

export default function ClientFinanceShell() {
  return <FinanceShell />;
}
