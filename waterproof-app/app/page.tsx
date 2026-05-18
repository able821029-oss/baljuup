/**
 * 루트 경로 / — 진입점
 *
 * 로그인 상태에 따라 분기:
 *   - 로그인 됨   → /dashboard
 *   - 로그인 안 됨 → /login
 *
 * (추후 마케팅 랜딩페이지로 교체 가능)
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }
  redirect('/login');
}
