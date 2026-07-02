'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard, TrendingUp, Search, MessageSquare,
  MapPin, LogOut, ChevronDown, Building2
} from 'lucide-react'
import clsx from 'clsx'
import Image from 'next/image'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { href: '/dashboard',             label: 'ダッシュボード', icon: <LayoutDashboard size={18} /> },
  { href: '/dashboard/performance', label: 'パフォーマンス', icon: <TrendingUp size={18} /> },
  { href: '/dashboard/keywords',    label: 'キーワード順位', icon: <Search size={18} /> },
  { href: '/dashboard/reviews',     label: 'クチコミ管理',   icon: <MessageSquare size={18} /> },
]

interface SidebarProps {
  locationName?: string
}

export function Sidebar({ locationName }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex flex-col bg-surface-950 text-white"
           style={{ width: 'var(--sidebar-width)' }}>

      {/* ロゴ */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500 flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7" stroke="white" strokeWidth="1.5"/>
            <path d="M9 4v5l3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="leading-tight min-w-0">
          <div className="font-display text-sm font-bold truncate">MEO管理ツール</div>
          <div className="text-white/40 text-xs truncate">Analytics Dashboard</div>
        </div>
      </div>

      {/* 店舗セレクター */}
      {locationName && (
        <div className="mx-3 mt-3">
          <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/8 hover:bg-white/12 transition-colors text-left">
            <MapPin size={15} className="text-brand-400 flex-shrink-0" />
            <span className="text-sm text-white/80 truncate flex-1 font-medium">{locationName}</span>
            <ChevronDown size={14} className="text-white/40 flex-shrink-0" />
          </button>
        </div>
      )}

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
              )}
            >
              <span className={active ? 'text-white' : 'text-white/50'}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ユーザー情報 */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          {session?.user?.image ? (
            <Image src={session.user.image} alt="" width={32} height={32} className="rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold">
              {session?.user?.name?.[0] ?? 'U'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">{session?.user?.name}</div>
            <div className="text-xs text-white/40 truncate">{session?.user?.email}</div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/8 transition-colors"
        >
          <LogOut size={15} />
          ログアウト
        </button>
      </div>
    </aside>
  )
}
