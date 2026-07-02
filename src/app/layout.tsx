import type { Metadata } from 'next'
import { Noto_Sans_JP, Syne } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto',
  display: 'swap',
})

const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MEO管理ツール',
  description: 'Googleビジネスプロフィール 統合管理・分析ダッシュボード',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${syne.variable}`}>
      <body className="font-sans bg-surface-50 text-surface-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
