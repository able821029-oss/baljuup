'use client';

/**
 * 제안서 공유 카드
 *
 *   - "공유 링크 생성" 버튼 → POST /api/proposals/[id]/share
 *   - 생성된 URL 표시 + 클립보드 복사 + 카카오톡 공유 + Web Share API
 *   - 이미 share_url 이 있으면 (만료 전) 즉시 표시 — 재생성 버튼만 노출
 *
 * 카카오 공유 전략:
 *   1) Kakao SDK 가 로드되어 있고 NEXT_PUBLIC_KAKAO_APP_KEY 가 있으면 sendDefault
 *   2) 모바일이면 카카오톡 스킴 직접 호출 (Kakao SDK 미설치 환경)
 *   3) 그것도 안 되면 navigator.share 폴백 (모바일 Safari/Chrome)
 *   4) 마지막은 URL 복사 후 사용자가 직접 붙여넣기
 */

import { useState } from 'react';
import {
  Link2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Share2,
  RefreshCw,
  Clock,
} from 'lucide-react';

export interface ProposalShareCardProps {
  proposalId: string;
  complexName: string;
  workScope: string;
  initialShareUrl?: string | null;
  initialExpiresAt?: string | null;
}

type ShareApiResponse =
  | {
      ok: true;
      url: string;
      token: string;
      pdfUrl: string;
      expiresAt: string | null;
      filename?: string;
    }
  | { ok: false; error: string; code?: string };

export function ProposalShareCard(props: ProposalShareCardProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(props.initialShareUrl ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(props.initialExpiresAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function callShareApi(regenerate: boolean) {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/proposals/${props.proposalId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      });
      const json: ShareApiResponse = await res.json();
      if (!res.ok || !json.ok) {
        const msg = json.ok === false ? json.error : `요청 실패 (${res.status})`;
        setError(msg);
        return;
      }
      setShareUrl(json.url);
      setExpiresAt(json.expiresAt);
    } catch (e) {
      const err = e as Error;
      setError(`네트워크 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 API 미지원 — fallback: 선택 후 사용자 복사
      setError('복사 실패 — URL을 직접 선택해 복사해 주세요.');
    }
  }

  function handleKakaoShare() {
    if (!shareUrl) return;

    const title = `${props.complexName} ${props.workScope || '방수공사'} 제안서`;
    const description = '관리소장님께 전달드릴 제안서입니다. 링크를 눌러 PDF를 확인해 보세요.';

    // 1) Kakao JS SDK 가 있으면 우선 사용 (가장 깔끔한 카카오톡 카드 공유)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Kakao = (typeof window !== 'undefined' ? (window as any).Kakao : undefined);
    if (Kakao?.Share?.sendDefault && Kakao?.isInitialized?.()) {
      try {
        Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title,
            description,
            imageUrl: `${window.location.origin}/og-image.png`,
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
          buttons: [
            { title: '제안서 열기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
          ],
        });
        return;
      } catch {
        // SDK 호출 실패 시 다음 단계로 폴백
      }
    }

    // 2) Web Share API (모바일 Chrome/Safari) — 시스템 공유 시트 → 카카오톡 선택
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({ title, text: description, url: shareUrl })
        .catch(() => {
          // 취소된 경우 등 — 무시
        });
      return;
    }

    // 3) 마지막 폴백: 카카오스토리 공유 (브라우저에서 동작)
    const url = `https://story.kakao.com/share?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=600');
  }

  const expiresText = expiresAt ? formatDateTime(expiresAt) : null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Share2 size={16} className="text-[#FF6B35]" />
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">제안서 공유 링크</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        PDF 를 외부에서 받아볼 수 있는 공개 링크를 만들어 카카오톡으로 바로 전달할 수 있습니다.
      </p>

      {/* URL 표시 + 액션 */}
      {shareUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs">
            <Link2 size={14} className="shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1 truncate text-gray-700">{shareUrl}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              {copied ? '복사됨' : '복사'}
            </button>
          </div>

          {expiresText && (
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <Clock size={11} />
              만료: {expiresText}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleKakaoShare}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FEE500] px-3 py-2 text-xs font-semibold text-[#191600] transition-colors hover:bg-[#F2D700]"
            >
              <KakaoIcon />
              카카오톡으로 보내기
            </button>
            <button
              type="button"
              onClick={() => callShareApi(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {loading ? '재생성 중' : 'PDF 재생성'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => callShareApi(false)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C8A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0c3d6e] disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
          {loading ? '링크 생성 중' : '공유 링크 생성'}
        </button>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}

// ============================================================
function KakaoIcon() {
  // 카카오 공식 심볼 단순화 (말풍선) — 16x16
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 2C4.13 2 1 4.42 1 7.4c0 1.9 1.3 3.57 3.27 4.5l-.69 2.5a.25.25 0 0 0 .38.28L7 12.8c.33.03.66.05 1 .05 3.87 0 7-2.42 7-5.4S11.87 2 8 2z" />
    </svg>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}
