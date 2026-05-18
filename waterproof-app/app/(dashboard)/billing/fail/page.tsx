import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function BillingFailPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = decodeURIComponent(searchParams.reason ?? '알 수 없는 오류');

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-red-50">
        <AlertCircle size={26} className="text-red-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">구독을 시작하지 못했습니다</h1>
      <p className="mt-2 text-sm text-gray-600">{reason}</p>
      <p className="mt-1 text-xs text-gray-500">
        카드 정보를 확인하거나 다른 카드로 다시 시도해주세요. 문제가 계속되면 고객센터로 문의하세요.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/billing"
          className="rounded-lg bg-[#0F4C8A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1A5FA8]"
        >
          다시 시도
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          대시보드로
        </Link>
      </div>
    </div>
  );
}
