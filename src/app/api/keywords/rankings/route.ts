import { NextRequest, NextResponse } from 'next/server'
import { loadMonthRankings } from '@/lib/keyword-store'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const location  = searchParams.get('location')  ?? ''
  const yearmonth = searchParams.get('yearmonth') ?? ''

  if (!location || !yearmonth) {
    return NextResponse.json({ rankings: {} })
  }

  const [y, m] = yearmonth.split('/').map(Number)
  const rankings = loadMonthRankings(location, y, m)
  return NextResponse.json({ rankings })
}
