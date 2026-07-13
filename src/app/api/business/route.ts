import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAdminAccessToken } from '@/lib/admin-token'
import { authOptions } from '@/lib/auth'
import { listAccounts, listLocations } from '@/lib/gbp-client'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const adminToken = await getAdminAccessToken()
    const accounts = await listAccounts(adminToken)
    if (!accounts?.length) {
      return NextResponse.json({ locations: [] })
    }
    const allLocations = await Promise.all(
      accounts.map((account) => listLocations(adminToken, account.name))
    )
    return NextResponse.json({ accounts, locations: allLocations.flat() })
  } catch (err) {
    console.error('business API error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('429')) {
      return NextResponse.json({ locations: [], warning: 'Quota exceeded' })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
