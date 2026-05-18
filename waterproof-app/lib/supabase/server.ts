/**
 * 서버(Server Component / Route Handler / Server Action) 전용 Supabase 클라이언트
 *
 * 사용 — Server Component:
 *   import { createClient } from '@/lib/supabase/server';
 *
 *   export default async function ComplexesPage() {
 *     const supabase = await createClient();
 *     const { data } = await supabase
 *       .from('complex_predictions')
 *       .select('*')
 *       .order('prediction_score', { ascending: false })
 *       .limit(20);
 *     return <ComplexList items={data ?? []} />;
 *   }
 *
 * 사용 — Route Handler:
 *   export async function GET() {
 *     const supabase = await createClient();
 *     const { data: { user } } = await supabase.auth.getUser();
 *     if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
 *     ...
 *   }
 *
 * 사용 — 관리자 작업 (RLS 우회 필요할 때):
 *   import { createAdminClient } from '@/lib/supabase/server';
 *   const admin = createAdminClient();   // service_role 키 사용 — 절대 클라이언트로 응답에 노출 금지
 *
 * 동작 원리:
 *   - cookies() 로 Next.js 의 요청 쿠키를 읽고 씀
 *   - getAll/setAll 패턴 (@supabase/ssr ≥0.5)
 *   - Server Component 에서 setAll 호출 시 try/catch 로 무시 — 미들웨어가 처리하므로 OK
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * 일반 서버 작업용 — 사용자 세션을 따라간다 (RLS 적용)
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component 에서 호출된 경우 set 이 불가능 — 미들웨어가 세션을 갱신하므로 무시 OK
          }
        },
      },
    }
  );
}

/**
 * 관리자 작업용 — service_role 키 사용 (RLS 우회)
 *
 * ⚠️ 사용 시 주의사항:
 *   - 반드시 서버 환경에서만 호출 (route handler, server action, cron 등)
 *   - 응답 본문에 service_role 키가 섞이지 않도록 주의
 *   - 사용자 본인 확인이 끝난 뒤에만 호출 권장
 *
 * 사용 예 — 공공데이터 수집 스크립트, 카카오 알림 발송, 회원 강제 탈퇴 등
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'createAdminClient: SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_URL 누락'
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
