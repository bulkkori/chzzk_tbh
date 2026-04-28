/**
 * Helpers for triggering the official chzzk OAuth flow served by the API
 * server (see artifacts/api-server/src/routes/auth-chzzk.ts).
 */

// 프론트엔드/백엔드 분리 배포 시: VITE_API_BASE_URL 환경변수에 백엔드 URL 설정
// 예: VITE_API_BASE_URL=https://your-api.vercel.app
const API_ORIGIN = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Send the browser to the chzzk OAuth start endpoint. After the user grants
 * access on chzzk.naver.com, the API server will redirect them back to
 * `/auth/callback#token=...` so the SPA can finish signing them in.
 *
 * @param returnTo  Path inside the SPA to land on after sign-in succeeds.
 */
export function startChzzkOAuth(returnTo: string = "/"): void {
  const url = new URL(`${API_ORIGIN}/api/auth/chzzk/start`);
  url.searchParams.set("returnTo", returnTo);
  window.location.href = url.toString();
}
