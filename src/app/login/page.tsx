'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard')
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 to-brand-50 p-4">
      {/* 背景装飾 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-40" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* ロゴ・ヘッダー */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 shadow-lg mb-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z" fill="white" fillOpacity=".2"/>
              <path d="M16 8c-4.418 0-8 3.582-8 8 0 3.326 2.03 6.186 4.95 7.411L16 16V8z" fill="white"/>
              <path d="M16 8v8l3.05 7.411C21.97 22.186 24 19.326 24 16c0-4.418-3.582-8-8-8z" fill="white" fillOpacity=".7"/>
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-surface-900">MEO管理ツール</h1>
          <p className="text-surface-500 text-sm mt-1">Googleビジネスプロフィール 統合管理</p>
        </div>

        {/* ログインカード */}
        <div className="card shadow-card-hover">
          <h2 className="text-lg font-bold text-surface-800 mb-1">ログイン</h2>
          <p className="text-sm text-surface-500 mb-6">
            Googleアカウントでサインインしてください。<br />
            ビジネスプロフィールの管理権限が必要です。
          </p>

          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 active:bg-surface-100 transition-colors duration-150 font-medium text-surface-800 shadow-sm"
          >
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
              <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0 0 10 20z" fill="#34A853"/>
              <path d="M4.405 11.9A6.01 6.01 0 0 1 4.09 10c0-.659.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 0 0 0 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
              <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0A9.996 9.996 0 0 0 1.064 5.51l3.34 2.59C5.192 5.736 7.396 3.977 10 3.977z" fill="#EA4335"/>
            </svg>
            Googleでサインイン
          </button>

          <p className="mt-4 text-xs text-surface-400 text-center leading-relaxed">
            サインインすることで、Googleビジネスプロフィールの
            データへのアクセスを許可します。
          </p>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">
          MEO管理ツール — Powered by Google Business Profile API
        </p>
      </div>
    </div>
  )
}
