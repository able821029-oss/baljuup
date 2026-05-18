/**
 * /billing — 구독 시작 및 관리 (Server Component)
 *
 *   - 비구독자: 플랜 비교 표 + 구독 시작 버튼 (CheckoutButton)
 *   - 구독자: 카드 정보 + 다음 결제일 + 결제 이력 + 취소 버튼
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PLANS, type PlanCode } from '@/lib/toss';
import { CheckoutButton } from '@/components/billing/CheckoutButton';
import { Check, CreditCard, Calendar } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

const FEATURES: Record<PlanCode, string[]> = {
  starter: [
    '서울 단지 전체 DB',
    'AI 제안서 무제한 생성',
    'PDF 다운로드',
    '기본 알림',
  ],
  pro: [
    '수도권 전체 (서울+경기+인천) 1.7만 단지',
    'AI 제안서 + 비포/애프터 이미지 무제한',
    '입찰공고 실시간 카카오 알림',
    '1:1 전화 온보딩',
    '기능 요청 우선 반영',
  ],
  enterprise: [
    '전국 전체 단지 DB',
    '멀티 공정 (방수 + 도장 + 창호 + 단열)',
    '다중 사용자 계정 (10명까지)',
    '전담 CS 매니저',
    'API 액세스',
  ],
};

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 현재 구독 조회
  const { data: subData } = await supabase
    .from('subscriptions')
    .select('plan, amount, card_company, card_number_masked, status, next_billing_at, last_billed_at, canceled_at')
    .eq('user_id', user.id)
    .maybeSingle();

  type Sub = {
    plan: string;
    amount: number;
    card_company: string | null;
    card_number_masked: string | null;
    status: string;
    next_billing_at: string | null;
    last_billed_at: string | null;
    canceled_at: string | null;
  };
  const sub = (subData as unknown) as Sub | null;

  const customerKey = `cust_${user.id.replace(/-/g, '')}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">구독</h2>
        <p className="mt-1 text-sm text-gray-500">
          {sub && sub.status === 'active'
            ? '현재 구독 정보를 확인하고 관리할 수 있습니다.'
            : '발주Up의 모든 기능을 사용하려면 구독을 시작하세요.'}
        </p>
      </div>

      {sub && sub.status === 'active' ? (
        <CurrentSubscription sub={sub} />
      ) : (
        <PlanGrid customerKey={customerKey} email={user.email ?? undefined} />
      )}
    </div>
  );
}

// ============================================================
// 활성 구독 표시
// ============================================================
function CurrentSubscription({ sub }: { sub: {
  plan: string; amount: number;
  card_company: string | null; card_number_masked: string | null;
  status: string; next_billing_at: string | null; last_billed_at: string | null;
} }) {
  const planMeta = PLANS[sub.plan as PlanCode];
  return (
    <div className="space-y-4">
      <section className="rounded-xl border-2 border-[#0F4C8A] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-block rounded-full bg-[#0F4C8A] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              현재 플랜
            </span>
            <h3 className="mt-2 text-2xl font-bold text-gray-900">
              {planMeta?.name ?? sub.plan}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              월 <span className="font-semibold text-gray-900">{sub.amount.toLocaleString()}</span>원
            </p>
          </div>
          <Link
            href="/billing/cancel"
            className="text-xs font-medium text-gray-500 underline hover:text-red-600"
          >
            구독 취소
          </Link>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <Item icon={CreditCard} label="결제 카드"
                value={`${sub.card_company ?? '카드'} · ${sub.card_number_masked ?? '****'}`} />
          <Item icon={Calendar} label="다음 결제일"
                value={sub.next_billing_at ? formatDate(sub.next_billing_at) : '미정'} />
          {sub.last_billed_at && (
            <Item icon={Calendar} label="최근 결제일"
                  value={formatDate(sub.last_billed_at)} />
          )}
        </dl>
      </section>

      <BillingHistory />
    </div>
  );
}

// ============================================================
// 비구독자 — 플랜 그리드
// ============================================================
function PlanGrid({ customerKey, email }: { customerKey: string; email?: string }) {
  const codes: PlanCode[] = ['starter', 'pro', 'enterprise'];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {codes.map((code) => {
        const plan = PLANS[code];
        const featured = code === 'pro';
        return (
          <div
            key={code}
            className={[
              'flex flex-col rounded-xl border bg-white p-6 transition-shadow hover:shadow-md',
              featured ? 'border-[#FF6B35] ring-2 ring-[#FF6B35]/20' : 'border-gray-200',
            ].join(' ')}
          >
            {featured && (
              <span className="mb-2 self-start rounded-full bg-[#FF6B35] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                추천
              </span>
            )}
            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
            <p className="mt-1 text-xs text-gray-500">{plan.description}</p>

            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-gray-900">
                {plan.amount.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">원 / 월</span>
            </div>

            <ul className="mt-4 flex-1 space-y-2 text-xs text-gray-700">
              {FEATURES[code].map((f, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Check size={13} className="mt-0.5 shrink-0 text-[#16A34A]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              {code === 'enterprise' ? (
                <a
                  href="mailto:sales@baljuup.co.kr?subject=엔터프라이즈 문의"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F1E36] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1A2E50]"
                >
                  영업팀 문의
                </a>
              ) : (
                <CheckoutButton
                  plan={code}
                  customerKey={customerKey}
                  customerEmail={email}
                  variant={featured ? 'primary' : 'default'}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 결제 이력 (최근 6건)
// ============================================================
async function BillingHistory() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('billing_logs')
    .select('amount, status, order_id, failure_message, attempted_at')
    .order('attempted_at', { ascending: false })
    .limit(6);

  type LogRow = {
    amount: number; status: string; order_id: string | null;
    failure_message: string | null; attempted_at: string;
  };
  const rows = ((data ?? []) as unknown) as LogRow[];

  if (!rows.length) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="border-b border-gray-100 px-5 py-3">
        <h3 className="text-sm font-bold text-gray-900">최근 결제 이력</h3>
      </header>
      <ul className="divide-y divide-gray-100">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">{formatDate(r.attempted_at)}</div>
              <div className="mt-0.5 font-medium text-gray-900">
                {r.amount.toLocaleString()}원
              </div>
              {r.failure_message && (
                <div className="mt-0.5 text-xs text-red-600">{r.failure_message}</div>
              )}
            </div>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                r.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
              ].join(' ')}
            >
              {r.status === 'success' ? '성공' : '실패'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================================================
import type { LucideIcon } from 'lucide-react';

function Item({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-gray-100">
        <Icon size={14} className="text-gray-600" />
      </span>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
