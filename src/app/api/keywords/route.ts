import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAdminAccessToken } from '@/lib/admin-token'
import { authOptions } from '@/lib/auth'

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText'

interface PlaceResult {
  id: string
  displayName?: {
    text?: string
  }
  formattedAddress?: string
}

const DEFAULT_KEYWORDS = [
  '徳島 肉通販',
  '北島町 精肉店',
  '徳島市 切り落とし',
  '徳島市 国産タン',
  '徳島市 国産ハラミ',
  '徳島市 肉セール',
]

async function searchPlaces(
  apiKey: string,
  textQuery: string,
  maxResultCount = 20
): Promise<PlaceResult[]> {
  const res = await fetch(PLACES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount,
      languageCode: 'ja',
      locationBias: {
        circle: {
          center: {
            latitude: 34.0703,
            longitude: 134.5547,
          },
          radius: 30000,
        },
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('PLACES API ERROR:', text)
    throw new Error(`Places API error: ${res.status} - ${text}`)
  }

  const data = await res.json()
  return data.places ?? []
}

function isTargetStore(place: PlaceResult) {
  const name = place.displayName?.text ?? ''
  const address = place.formattedAddress ?? ''

  return (
    name.includes('北島藤原精肉店') ||
    name.includes('藤原精肉店') ||
    address.includes('北島町')
  )
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_PLACES_API_KEY is not configured' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)

  const keywordsParam = searchParams.get('keywords')

  const keywords = keywordsParam
    ? keywordsParam.split(',').map((k) => k.trim()).filter(Boolean)
    : DEFAULT_KEYWORDS

  const adminToken = adminToken
  try {
    const rankings = await Promise.all(
      keywords.map(async (keyword) => {
        const places = await searchPlaces(apiKey, keyword, 20)
        const index = places.findIndex(isTargetStore)

        return {
          keyword,
          currentRank: index >= 0 ? index + 1 : null,
          previousRank: null,
          change: null,
          lastChecked: new Date().toISOString(),
          locationId: 'kitajima-fujiwara-seinikuten',
        }
      })
    )

    return NextResponse.json({
      locationName: '株式会社北島藤原精肉店',
      rankings,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('keywords API error:', err)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


