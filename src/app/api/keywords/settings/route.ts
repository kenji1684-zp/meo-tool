import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getAllCompanySettings,
  updateCompanyKeywords,
  saveKeywordSettings,
} from '@/lib/keyword-store'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const companies = getAllCompanySettings()
  return NextResponse.json({ companies })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  if (typeof body.id === 'string' && Array.isArray(body.keywords)) {
    // 新形式: 特定企業のキーワードを更新
    updateCompanyKeywords(body.id, body.keywords)
  } else if (body.locationName) {
    // 旧形式: 単一企業として保存
    saveKeywordSettings(body)
  }

  return NextResponse.json({ ok: true })
}
