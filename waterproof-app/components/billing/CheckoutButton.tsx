'use client';

/**
 * 토스 카드 등록(빌링) 위젯을 호출하는 버튼
 *
 * 사용자가 클릭하면:
 *   1) Toss SDK 스크립트 로드 (없으면)
 *   2) tossPayments(clientKey).requestBillingAuth('카드', {...}) 호출
 *   3) 토스 페이지로 이동 → 카드 입력 → /billing/success?authKey=...&customerKey=... 로 리다이렉트
 *
 * 빌링키 발급은 /billing/success 서버 라우트에서 처리.
 */

import { useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import { PLANS, type PlanCode } from '@/lib/toss';

// Toss SDK 전역 타입 선언
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestBillingAuth: (
        method: '카드',
        options: {
          customerKey: string;
          successUrl: string;
          failUrl: string;
          customerEmail?: string;
          customerName?: string;
        }
      ) => Promise<void>;
    };
  }
}

const TOSS_SDK_URL = 'https://js.tosspayments.com/v1/payment';

export interface CheckoutButtonProps {
  plan: PlanCode;
  customerKey: string;
  customerEmail?: string;
  customerName?: string;
  disabled?: boolean;
  variant?: 'primary' | 'default';
}

export function CheckoutButton({
  plan,
  customerKey,
  customerEmail,
  customerName,
  disabled,
  variant = 'primary',
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planMeta = PLANS[plan];

  async function loadSdk(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (window.TossPayments) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TOSS_SDK_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Toss SDK 로드 실패'));
      document.head.appendChild(script);
    });
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) throw new Error('NEXT_PUBLIC_TOSS_CLIENT_KEY 가 설정되지 않았습니다.');

      await loadSdk();
      if (!window.TossPayments) throw new Error('Toss SDK 로드 실패');

      const origin = window.location.origin;
      const tp = window.TossPayments(clientKey);
      await tp.requestBillingAuth('카드', {
        customerKey,
        customerEmail,
        customerName,
        successUrl: `${origin}/billing/success?plan=${plan}`,
        failUrl:    `${origin}/billing/fail`,
      });
      // SDK 가 페이지를 이동시킴 — 여기 도달하면 사용자가 취소한 케이스
    } catch (e) {
      const err = e as Error;
      setError(err?.message || '카드 등록 실패');
      setLoading(false);
    }
  }

  const cls =
    variant === 'primary'
      ? 'bg-[#FF6B35] text-white hover:bg-[#FF8C5A]'
      : 'bg-white text-[#0F4C8A] border border-[#0F4C8A] hover:bg-blue-50';

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={[
          'inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          cls,
        ].join(' ')}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {loading ? '토스로 이동 중...' : `${planMeta.name} 구독 시작 (월 ${planMeta.amount.toLocaleString()}원)`}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
