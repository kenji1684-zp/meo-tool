import NextAuth, { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            // Google Business Profile API のスコープ
            'https://www.googleapis.com/auth/business.manage',
          ].join(' '),
          prompt: 'consent',
          access_type: 'offline', // refresh_token を取得するため
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // アクセス制限（ALLOWED_EMAILS が設定されている場合）
      const allowedEmails = process.env.ALLOWED_EMAILS
      if (allowedEmails) {
        const allowed = allowedEmails.split(',').map(e => e.trim())
        if (!user.email || !allowed.includes(user.email)) {
          return false
        }
      }
      return true
    },
    async jwt({ token, account }) {
      // 初回ログイン時にアクセストークンを保存
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      // セッションにアクセストークンを追加
      session.accessToken = token.accessToken as string
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
