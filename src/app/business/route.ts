import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAdminAccessToken } from '@/lib/admin-token'
import { authOptions } from '@/lib/auth'
import { listAccounts, listLocations } from '@/lib/gbp-client'
import { DEMO_LOCATION } from '@/lib/demo-data'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (DEMO_MODE) {
    return NextResponse.json({
      accounts: [{ name: 'accounts/demo', accountName: '株式会社ZEROPLUS', type: 'PERSONAL' }],
      locations: [DEMO_LOCATION],
      demo: true,
    })
  }

  try {
    const accounts = await listAccounts(await getAdminAccessToken())
    if (!accounts?.length) {
      return NextResponse.json({ locations: [] })
    }
    const allLocations = await Promise.all(
      accounts.map(account => listLocations(await getAdminAccessToken(), account.name))
    )
    return NextResponse.json({ accounts, locations: allLocations.flat() })
  } catch (err) {
    console.error('business API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
