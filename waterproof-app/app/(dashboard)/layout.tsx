/**
 * 대시보드 공통 레이아웃 (Server Component)
 *
 * 책임:
 *   1) 로그인 여부 확인 (안 됐으면 /login 으로 리다이렉트)
 *   2) user_profiles 에서 회사 정보 조회
 *   3) 인터랙티브 셸(DashboardShell) 에 props 로 전달
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import type { UserProfile } from '@/lib/supabase/database.types';

// 모든 대시보드 페이지는 인증 / 쿠키 / URL 쿼리에 의존하므로 정적 prerender 불필요.
// (자식 컴포넌트의 useSearchParams 가 prerender 단계에서 충돌하는 문제도 함께 회피)
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 회사 정보 조회 (없어도 페이지는 보여야 하므로 optional).
  // supabase-js 의 select 문자열 타입 추론이 일부 환경에서 좁혀지지 못하는 이슈가 있어
  // 결과를 명시적으로 단언한다. 런타임에는 정상 동작.
  const { data } = await supabase
    .from('user_profiles')
    .select('company_name,owner_name,plan')
    .eq('id', user.id)
    .maybeSingle();
  const profile = data as Pick<UserProfile, 'company_name' | 'owner_name' | 'plan'> | null;

  return (
    <DashboardShell
      user={{
        email: user.email ?? '',
        companyName: profile?.company_name ?? null,
        ownerName: profile?.owner_name ?? null,
        plan: profile?.plan ?? 'trial',
      }}
    >
      {children}
    </DashboardShell>
  );
}
