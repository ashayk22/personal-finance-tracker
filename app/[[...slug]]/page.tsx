import { redirect } from 'next/navigation';
import ClientFinanceShell from '../ClientFinanceShell';

export default async function FinanceRoute({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  if (slug?.[0] === 'login') redirect('/');
  return <ClientFinanceShell />;
}
