/**
 * /billing/cancel — 구독 취소 확인 (Server Component + 인라인 클라이언트 폼)
 *
 * 흐름:
 *   1) 현재 활성 구독을 조회해 다음 결제일 / 잔여 기간 표시
 *   2) 취소 사유(선택) 라디오 + 자유 입력
 *   3) "취소 확정" 또는 "환불도 함께 신청" 분기 선택
 *      - 일반 취소: 다음 결제 전까지 사용 가능
 *      - 즉시 환불: 7일 + 미사용 조건 충족 시 자동 환불 (refundLastPayment)
 *   4) 결과 페이지로 redirect
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanCode } from "@/lib/toss";
import { CancelForm } from "./CancelForm";

export const dynamic = "force-dynamic";

export default async function CancelSubscriptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subData } = await supabase
    .from("subscriptions")
    .select("plan, amount, next_billing_at, last_billed_at, status")
    .eq("user_id", user.id)
    .maybeSingle();

  type Sub = {
    plan: string; amount: number;
    next_billing_at: string | null; last_billed_at: string | null;
    status: string;
  };
  const sub = (subData as unknown) as Sub | null;

  // 활성 구독이 없으면 구독 페이지로 돌려보냄
  if (!sub || sub.status !== "active") {
    redirect("/billing");
  }

  const planMeta = PLANS[sub.plan as PlanCode];
  const nextBillingDate = sub.next_billing_at ? formatDate(sub.next_billing_at) : "미정";
  const lastBilledDate = sub.last_billed_at ? formatDate(sub.last_billed_at) : null;

  // 7일 이내 결제 여부 (즉시 환불 자격 미리보기 — 실제 검증은 서버 액션이 다시 수행)
  const refundEligible = sub.last_billed_at
    ? (Date.now() - new Date(sub.last_billed_at).getTime()) / 86_400_000 <= 7
    : false;

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12">
      {/* 상단 — 뒤로 가기 */}
      <div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-var hover:text-accent"
        >
          <ArrowLeft size={14} />
          구독 페이지로 돌아가기
        </Link>
      </div>

      {/* 타이틀 */}
      <header>
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">구독 취소</h2>
        <p className="mt-1 text-sm text-gray-500">
          취소하기 전에 잔여 기간과 환불 가능 여부를 확인해주세요.
        </p>
      </header>

      {/* 현재 구독 요약 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
              현재 플랜
            </p>
            <h3 className="mt-1 text-xl font-bold text-on-surface">
              {planMeta?.name ?? sub.plan}
              <span className="ml-2 text-sm font-medium text-on-surface-var">
                월 {sub.amount.toLocaleString()}원
              </span>
            </h3>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
              다음 결제일
            </p>
            <p className="mt-1 text-base font-bold tabular-nums text-on-surface">
              {nextBillingDate}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm text-on-surface-var">
          <li>• 취소 즉시 자동결제 갱신이 중지됩니다.</li>
          <li>• 다음 결제일({nextBillingDate})까지는 모든 기능을 그대로 이용하실 수 있습니다.</li>
          {refundEligible && lastBilledDate && (
            <li className="text-emerald-700">
              • 최근 결제일({lastBilledDate})로부터 7일이 지나지 않았습니다 — 미사용 시 즉시 환불 신청 가능.
            </li>
          )}
        </ul>
      </section>

      {/* 취소 폼 (Client) */}
      <CancelForm refundEligible={refundEligible} amount={sub.amount} />

      {/* 환불 정책 안내 */}
      <p className="text-center text-xs text-on-surface-var">
        자세한 환불 기준은{" "}
        <Link href="/refund" className="font-semibold text-accent underline">환불·청약철회 정책</Link>{" "}
        을 확인해주세요.
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
