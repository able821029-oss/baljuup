'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { deleteAccount } from '@/app/(dashboard)/settings/actions';

export function DangerZone() {
  const [step, setStep] = useState<'idle' | 'confirm'>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const result = await deleteAccount();
      // 정상이면 redirect 가 일어남
      if (!result.ok) {
        setError(result.error ?? '삭제 실패');
      }
    } catch (e) {
      const err = e as Error;
      // redirect 는 Next.js 가 throw 하므로 message 가 NEXT_REDIRECT 면 정상
      if (/NEXT_REDIRECT/i.test(err?.message ?? '')) return;
      setError(err?.message ?? '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border-2 border-red-200 bg-white">
      <header className="border-b border-red-100 px-5 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-red-700">
          <AlertTriangle size={14} />
          위험 영역
        </h3>
      </header>

      <div className="space-y-3 p-5">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">계정 삭제</h4>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            계정을 삭제하면 저장된 모든 제안서와 프로필 정보가 함께 영구 삭제됩니다.
            <br />
            결제 정보가 있는 경우, 사전에 별도로 구독을 해지해야 합니다.
          </p>
        </div>

        {step === 'idle' ? (
          <button
            type="button"
            onClick={() => setStep('confirm')}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
          >
            계정 삭제 진행
          </button>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-xs text-red-900">
              확인을 위해 아래 입력란에 <strong className="font-bold">계정 삭제</strong> 라고 입력해주세요.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="계정 삭제"
              className="mt-2 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => { setStep('idle'); setConfirmText(''); }}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmText !== '계정 삭제' || loading}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <Loader2 size={12} className="animate-spin" />}
                영구 삭제
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-700">{error}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
