/**
 * Next.js 미들웨어 — 모든 요청에 대해 Supabase 세션 갱신
 *
 * 자세한 동작: lib/supabase/middleware.ts 의 updateSession 참조
 */

import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 다음 경로를 제외한 모든 요청에 적용:
    //   - _next/static (정적 파일)
    //   - _next/image (이미지 최적화)
    //   - favicon.ico
    //   - 정적 이미지 확장자 (svg, png, jpg, jpeg, gif, webp)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
