'use client';

/**
 * 제안서 이메일 발송 다이얼로그
 *
 *   - 관리소장 이메일 입력 + 본문 메모(선택)
 *   - POST /api/proposals/[id]/send 호출
 *   - 성공 시 부모에게 sentAt/sentTo/sentCount 전달
 *
 * shadcn-ui Dialog 가 프로젝트에 없으므로 Tailwind 로 직접 구성.
 */

import { useEffect, useRef, useState } from 'react';
import { X, Mail, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface SendProposalDialogProps {
  proposalId: string;
  open: boolean;
  defaultTo?: string;            // 마지막에 보냈던 주소 자동 입력
  onClose: () => void;
  onSent: (info: { sentAt: string; sentTo: string; sentCount: number }) => void;
}

type ApiResponse =
  | { ok: true; messageId?: string; sentAt: string; sentTo: string; sentCount: number }
  | { ok: false; error: string; code?: string };

export function SendProposalDialog({
  proposalId,
  open,
  defaultTo,
  onClose,
  onSent,
}: SendProposalDialogProps) {
  const [to, setTo] = useState(defaultTo ?? '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 다이얼로그 열릴 때 마지막 상태 초기화 + 포커스
  useEffect(() => {
    if (!open) return;
    setTo(defaultTo ?? '');
    setMessage('');
    setError(null);
    setOkMessage(null);
    // 다음 tick 에 포커스 (모달 트랜지션 직후)
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, defaultTo]);

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !sending) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sending, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    const trimmed = to.trim();
    if (!trimmed) {
      setError('수신자 이메일을 입력해주세요.');
      return;
    }
    if (!isEmail(trimmed)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }

    setSending(true);
    setError(null);
    setOkMessage(null);

    try {
      const res = await fetch(`/api/proposals/${proposalId}/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: trimmed,
          message: message.trim() || undefined,
        }),
      });

      const body = (await res.json()) as ApiResponse;
      if (!res.ok || !body.ok) {
        const errorMessage = !body.ok ? body.error : `발송 실패 (HTTP ${res.status})`;
        setError(errorMessage);
        setSending(false);
        return;
      }

      setOkMessage('이메일이 정상 발송되었습니다.');
      onSent({
        sentAt: body.sentAt,
        sentTo: body.sentTo,
        sentCount: body.sentCount,
      });

      // 0.8초 뒤 자동 닫기 (피드백 보여주고)
      setTimeout(() => {
        setSending(false);
        onClose();
      }, 800);
    } catch (e) {
      const err = e as Error;
      setError(`네트워크 오류: ${err.message}`);
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-proposal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* 배경 dim */}
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={() => !sending && onClose()}
      />

      {/* 모달 본체 */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="send-proposal-title" className="text-base font-semibold text-gray-900">
              이메일로 제안서 보내기
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              관리소장 이메일을 입력하면 PDF 가 첨부된 메일이 즉시 발송됩니다.
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => !sending && onClose()}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            disabled={sending}
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="send-to" className="block text-xs font-medium text-gray-700">
              수신자 이메일 <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              id="send-to"
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="manager@example.com"
              disabled={sending}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[#0F4C8A] focus:outline-none focus:ring-1 focus:ring-[#0F4C8A] disabled:bg-gray-50"
            />
          </div>

          <div>
            <label htmlFor="send-message" className="block text-xs font-medium text-gray-700">
              본문 메모 <span className="text-gray-400">(선택)</span>
            </label>
            <textarea
              id="send-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예) 안녕하세요 소장님, 지난번 통화 드린 ○○입니다. 검토 부탁드립니다."
              disabled={sending}
              maxLength={2000}
              className="mt-1 block w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[#0F4C8A] focus:outline-none focus:ring-1 focus:ring-[#0F4C8A] disabled:bg-gray-50"
            />
            <p className="mt-1 text-[11px] text-gray-400">{message.length} / 2000</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {okMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <span>{okMessage}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => !sending && onClose()}
              disabled={sending}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C8A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d3f73] disabled:opacity-60"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {sending ? '전송 중' : '전송'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
