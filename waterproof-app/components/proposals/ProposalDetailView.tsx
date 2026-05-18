'use client';

/**
 * 제안서 상세 화면 (클라이언트 래퍼)
 *
 *   - 상단: 메타 + 상태 변경 + PDF 재다운로드 + 삭제
 *   - 본문: ProposalPreview 재사용 (저장 버튼은 안 보이게)
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  Trophy,
} from 'lucide-react';
import { ProposalPreview } from './ProposalPreview';
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
}

export function ProposalDetailView(props: ProposalDetailViewProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ProposalStatus>(props.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

        {/* 삭제 확인 인라인 */}
        {confirmDelete && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-800">정말 삭제할까요? 되돌릴 수 없습니다.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting && <Loader2 size={12} className="animate-spin" />}
                삭제 확정
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* 본문 — ProposalPreview 재사용 (저장 버튼 미노출) */}
      <ProposalPreview
        proposal={props.proposal}
        complexName={props.complexName}
        companyName={props.companyName}
      />
    </div>
  );
}

// ============================================================
function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
