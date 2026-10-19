import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveClientByToken } from '@/lib/client-access'
import ClientDashboard from './ClientDashboard'

export const dynamic = 'force-dynamic'

// 検索エンジンに載せない・URLを他サイトへ漏らさない
export const metadata: Metadata = {
  title: 'MEOレポート',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

export default function ClientPage({ params }: { params: { token: string } }) {
  const company = resolveClientByToken(params.token)
  if (!company) notFound()

  return <ClientDashboard token={params.token} companyName={company.businessTitle} />
}
