'use client';

/**
 * 제안서 상세 화면 (클라이언트 래퍼)
 *
 *   - 상단: 메타 + 상태 변경 + 이메일 전송 + PDF 재다운로드 + 삭제
 *   - 본문: ProposalPreview 재사용 (저장 버튼은 안 보이게)
 *   - 발송 이력: sent_at / sent_to / sent_count 표시
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Mail,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  Trophy,
  Send,
} from 'lucide-react';
import { ProposalPreview } from './ProposalPreview';
import { ProposalShareCard } from './ProposalShareCard';
import { SendProposalDialog } from './SendProposalDialog';
import {
  updateProposalStatus,
  deleteProposal,
  type ProposalStatus,
} from '@/app/(dashboard)/proposals/actions';
import type { GeneratedProposal } from '@/lib/claude';

const STATUS_OPTIONS: { value: ProposalStatus; label: string; color: string }[] = [
  { value: 'draft', label: '초안', color: '#0F4C8A' },
  { value: 'sent',  label: '발송', color: '#FF6B35' },
  { value: 'won',   label: '수주', color: '#16A34A' },
  { value: 'lost',  label: '실패', color: '#9CA3AF' },
];

export interface ProposalDetailViewProps {
  id: string;
  proposal: GeneratedProposal;
  status: ProposalStatus;
  complexName: string;
  companyName: string;
  ownerName: string;
  workScope: string;
  createdAt: string;
  wonAt: string | null;
  /** 이메일 발송 이력 — 한 번도 발송 안 했으면 모두 null/0 */
  sentAt: string | null;
  sentTo: string | null;
  sentCount: number;
  /** 외부 공유 링크 — 한 번도 생성 안 했으면 null */
  shareUrl?: string | null;
  shareExpiresAt?: string | null;
}

export function ProposalDetailView(props: ProposalDetailViewProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ProposalStatus>(props.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  // 발송 이력 — 다이얼로그 성공 후 즉시 반영 (전체 페이지 새로고침 없이도 사용자가 결과 확인)
  const [sendInfo, setSendInfo] = useState<{
    sentAt: string | null;
    sentTo: string | null;
    sentCount: number;
  }>({
    sentAt: props.sentAt,
    sentTo: props.sentTo,
    sentCount: props.sentCount,
  });

  function handleStatusChange(next: ProposalStatus) {
    if (next === status) return;
    setError(null);
    startTransition(async () => {
      const result = await updateProposalStatus(props.id, next);
      if (!result.ok) {
        setError(result.error ?? '상태 변경 실패');
        return;
      }
      setStatus(next);
    });
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    setError(null);
    try {
      const { downloadProposalPdf } = await import('./ProposalPDF');
      await downloadProposalPdf({
        proposal: props.proposal,
        complexName: props.complexName,
        companyName: props.companyName,
        ownerName: props.ownerName,
        workScope: props.workScope,
      });
    } catch (e) {
      const err = e as Error;
      setError('PDF 생성 실패: ' + (err?.message || '알 수 없는 오류'));
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteProposal(props.id);
    if (!result.ok) {
      setError(result.error ?? '삭제 실패');
      setDeleting(false);
      return;
    }
    router.push('/proposals');
  }

  function handleSent(info: { sentAt: string; sentTo: string; sentCount: number }) {
    setSendInfo({ sentAt: info.sentAt, sentTo: info.sentTo, sentCount: info.sentCount });
    // 초안 상태였다면 서버에서 'sent' 로 끌어올렸을 것 — UI 도 맞춰준다
    if (status === 'draft') setStatus('sent');
    // 다른 화면(목록 등) 캐시 재검증
    router.refresh();
  }

  const metaDate = props.wonAt
    ? `수주 ${formatDate(props.wonAt)}`
    : `작성 ${formatDate(props.createdAt)}`;

  return (
    <div className="space-y-4">
      {/* 메타 + 액션 패널 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900 sm:text-lg">상태 관리</h2>
              {pending && <Loader2 size={14} className="animate-spin text-gray-400" />}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <Calendar size={11} />
              {metaDate}
              {status === 'won' && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                  <Trophy size={11} />
                  수주 성공
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSendOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C8A] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0d3f73]"
            >
              <Mail size={14} />
              이메일 전송
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? '생성 중' : 'PDF 다운로드'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              <Trash2 size={14} />
              삭제
            </button>
          </div>
        </div>

        {/* 상태 변경 탭 */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const on = status === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => handleStatusChange(s.value)}
                disabled={pending}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  on ? 'text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                  pending ? 'opacity-60' : '',
                ].join(' ')}
                style={on ? { backgroundColor: s.color } : undefined}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* 발송 이력 */}
        {sendInfo.sentAt && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <Send size={12} className="shrink-0" />
            <span>
                     마지막 발송{' '}
              <strong className="font-semibold">{formatDateTime(sendInfo.sentAt)}</strong>
              {sendInfo.sentTo && (
                <> → <span className="font-medium">{sendInfo.sentTo}</span></>
              )}
              {sendInfo.sentCount > 1 && (
                <> (총 {sendInfo.sentCount}회)</>
              )}
            </span>
          </div>
        )}

        {/* 오류 메시지 */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle size={12} className="shrink-0" />
            {error}
          </div>
        )}

        {/* 삭제 확인 */}
        {confirmDelete && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <p className="font-medium">이 제안서를 삭제하시겠습니까?</p>
            <p className="mt-0.5 text-red-500">삭제 후 복구할 수 없습니다.</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {deleting ? '삭제 중' : '삭제 확인'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 외부 공유 링크 카드 */}
      {props.shareUrl && (
        <ProposalShareCard
          proposalId={props.id}
          complexName={props.complexName}
          workScope={props.workScope}
          initialShareUrl={props.shareUrl}
          initialExpiresAt={props.shareExpiresAt ?? null}
        />
      )}

      {/* 제안서 본문 미리보기 */}
      <ProposalPreview
        proposal={props.proposal}
        complexName={props.complexName}
        companyName={props.companyName}
      />

      {/* 이메일 전송 다이얼로그 */}
      <SendProposalDialog
        proposalId={props.id}
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onSent={handleSent}
      />
    </div>
  );
}

// ─── 날짜 헬퍼 ─────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
