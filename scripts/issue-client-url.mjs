#!/usr/bin/env node
/**
 * クライアント用 閲覧URL 発行スクリプト
 *
 * 使い方:
 *   node scripts/issue-client-url.mjs            … 登録済み会社ID一覧を表示
 *   node scripts/issue-client-url.mjs ecolease   … エコリース用のトークンとURLを発行
 *
 * 出力された「CLIENT_ACCESS に追加する値」を Vercel の環境変数に追記して再デプロイすると URL が有効になる。
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const BASE_URL = process.env.CLIENT_BASE_URL ?? 'https://meo-tool-nine.vercel.app'
const settingsFile = path.join(process.cwd(), 'data', 'keyword-settings.json')
const { companies = [] } = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))

const id = process.argv[2]

if (!id) {
  console.log('\n登録済みの会社ID:\n')
  for (const c of companies) console.log(`  ${c.id.padEnd(22)} ${c.businessTitle}`)
  console.log('\n例) node scripts/issue-client-url.mjs ecolease\n')
  process.exit(0)
}

const company = companies.find((c) => c.id === id)
if (!company) {
  console.error(`\n✗ 会社ID "${id}" は data/keyword-settings.json にありません。先に会社を登録してください。\n`)
  process.exit(1)
}

// 24バイト → URLセーフな32文字
const token = crypto.randomBytes(24).toString('base64url')

console.log(`
==============================================
 ${company.businessTitle} 様 閲覧専用URL
==============================================

▼ クライアントに送るURL
${BASE_URL}/c/${token}

▼ Vercel 環境変数 CLIENT_ACCESS に追加する値
${id}:${token}

  ※ すでに他社が登録済みなら、カンマ区切りで末尾に追記:
     既存の値,${id}:${token}

  ※ 追加後、Vercel で Redeploy すると有効になります。
`)
