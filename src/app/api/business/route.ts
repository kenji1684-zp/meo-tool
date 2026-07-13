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
    const accounts = await listAccounts(await getAdminAccessToken())

    if (!accounts?.length) {
      return NextResponse.json({
        accounts: [],
        locations: [],
      })
    }

    const allLocations = await Promise.all(
      accounts.map((account) =>
        listLocations(await getAdminAccessToken(), account.name)
      )
    )

    return NextResponse.json({
      accounts,
      locations: allLocations.flat(),
    })
  } catch (err) {
    console.error('business API error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message.includes('429')) {
      return NextResponse.json({
        demo: true,
        accounts: [
          {
            name: 'accounts/demo',
            accountName: 'デモアカウント',
            type: 'PERSONAL',
          },
        ],
        locations: [
          {
            name: 'locations/demo-001',
            title: '株式会社ZEROPLUS デモ店舗',
            websiteUri: 'https://zeroplustokushima.com',
            storefrontAddress: {
              regionCode: 'JP',
              postalCode: '770-0000',
              administrativeArea: '徳島県',
              locality: '徳島市',
              addressLines: ['デモ住所1-2-3'],
            },
            metadata: {
              mapsUri: 'https://maps.google.com/',
            },
          },
        ],
        warning:
          'Google Business Profile APIのQuotaが0のため、デモデータを表示しています。',
      })
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}