/**
 * 미들웨어용 세션 갱신 헬퍼
 *
 * Next.js 의 middleware.ts 에서 호출되어
 *   1) Supabase 세션 쿠키를 자동 갱신 (만료된 토큰 → 리프레시)
 *   2) 미인증 사용자가 보호된 경로 접근 시 /login 으로 리다이렉트
 *
 * 사용 — waterproof-app/middleware.ts:
 *   import { type NextRequest } from 'next/server';
 *   import { updateSession } from '@/lib/supabase/middleware';
 *
 *   export async function middleware(request: NextRequest) {
 *     return await updateSession(request);
 *   }
 *
 *   export const config = {
 *     matcher: [
 *       '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
 *     ],
 *   };
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';

// 인증 없이 접근 가능한 경로 — 정확 일치 또는 prefix 매칭
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',  // 비밀번호 재설정 메일 요청
  '/reset-password',   // 메일 링크 클릭 후 새 비밀번호 입력 (세션은 콜백에서 자동 생성)
  '/auth',             // /auth/callback 등 OAuth 콜백
  '/api/public',       // 공개 API (있다면)
  '/api/toss',         // Toss webhook (서명 검증으로 보호)
  '/terms',            // 이용약관 — 로그인 전에도 접근 가능해야 가입 동의 흐름 성립
  '/privacy',          // 개인정보처리방침
  '/refund',           // 환불·청약철회 정책
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ⚠️ getUser() 는 매번 Supabase Auth 서버에 검증 요청을 보내므로
  // 미들웨어에서 호출하면 라우트 응답 속도가 100~300ms 정도 늘어남.
  // 인증이 필요 없는 페이지 비중이 높다면 위 PUBLIC_PATHS 분기로 스킵.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 미인증 사용자가 보호된 경로 접근 시 /login 으로
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 이미 로그인한 사용자가 /login 또는 /signup 접근 시 /dashboard 로
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
