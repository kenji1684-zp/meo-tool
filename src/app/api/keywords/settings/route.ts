import { NextRequest, NextResponse } from 'next/server'
import { getKeywordSettings, saveKeywordSettings } from '@/lib/keyword-store'

export async function GET() {
  const settings = getKeywordSettings()
  return NextResponse.json(settings)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { locationName: string; keywords: string[] }
  saveKeywordSettings(body)
  return NextResponse.json({ ok: true })
}
