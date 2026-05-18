import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { PLANS, type PlanCode } from '@/lib/toss';

export default function BillingCompletePage({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  const plan = (searchParams.plan ?? 'pro') as PlanCode;
  const meta = PLANS[plan];

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 size={26} className="text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">구독이 시작되었습니다</h1>
      <p className="mt-2 text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{meta?.name}</span> 플랜이 활성화되고
        첫 결제 (월 {meta?.amount.toLocaleString()}원) 가 완료되었습니다.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        다음 결제는 한 달 뒤 같은 카드로 자동 진행됩니다.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/dashboard"
          className="rounded-lg bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#FF8C5A]"
        >
          대시보드로
        </Link>
        <Link
          href="/billing"
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          구독 정보 확인
        </Link>
      </div>
    </div>
  );
}
