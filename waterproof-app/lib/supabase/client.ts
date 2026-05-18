/**
 * 브라우저(클라이언트 컴포넌트) 전용 Supabase 클라이언트
 *
 * 사용:
 *   'use client';
 *   import { createClient } from '@/lib/supabase/client';
 *
 *   export function MyButton() {
 *     const supabase = createClient();
 *     async function handleClick() {
 *       const { data, error } = await supabase.from('complexes').select('*').limit(10);
 *     }
 *     return <button onClick={handleClick}>조회</button>;
 *   }
 *
 * 주의:
 *   - 이 클라이언트는 anon key 만 사용. RLS 가 켜진 테이블만 안전.
 *   - 서버 컴포넌트/route handler 에서는 './server' 의 createClient 를 사용.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
