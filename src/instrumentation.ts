/**
 * Next.js Instrumentation Hook
 * サーバー起動時に node-cron でキーワード自動チェックをスケジュール
 */

export async function register() {
  // 自動チェックは GitHub Actions が毎日実行するため
  // サーバー起動時のチェックは不要
  // データは git pull で取得してください
}
