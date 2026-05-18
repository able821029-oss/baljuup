/**
 * AI가 생성한 제안서 미리보기
 *
 * 액션: 다시 생성 / 저장 / PDF 다운로드
 * 인쇄 시 깨지지 않도록 print:* 클래스 일부 사용.
 */

'use client';

import { CheckCircle2, RefreshCw, Download, Save, Check, Sparkles, Loader2 } from 'lucide-react';
import type { GeneratedProposal } from '@/lib/claude';

export interface ProposalPreviewProps {
  proposal: GeneratedProposal;
  complexName: string;
  companyName: string;
  onRegenerate?: () => void;
  onDownloadPdf?: () => void;
  onSave?: () => void;
  saving?: boolean;
  saved?: boolean;
}

export function ProposalPreview({
  proposal,
  complexName,
  companyName,
  onRegenerate,
  onDownloadPdf,
  onSave,
  saving = false,
  saved = false,
}: ProposalPreviewProps) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* 액션 바 */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-6 print:hidden">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Sparkles size={14} className="text-[#FF6B35]" />
          <span>AI 생성 — 내용 검토 후 사용하세요</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRegenerate && (
            <ActionBtn icon={<RefreshCw size={14} />} onClick={onRegenerate}>
              다시 생성
            </ActionBtn>
          )}
          {onSave && (
            <ActionBtn
              icon={saved ? <Check size={14} /> : saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              onClick={onSave}
              disabled={saving || saved}
              variant={saved ? 'success' : 'default'}
            >
              {saved ? '저장됨' : saving ? '저장 중' : '저장'}
            </ActionBtn>
          )}
          {onDownloadPdf && (
            <ActionBtn icon={<Download size={14} />} onClick={onDownloadPdf} variant="primary">
              PDF 다운로드
            </ActionBtn>
          )}
        </div>
      </header>

      {/* 본문 */}
      <div className="space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <div className="border-b border-gray-100 pb-5">
          <div className="text-xs font-medium text-[#FF6B35]">방수 공사 제안서</div>
          <h1 className="mt-1 text-xl font-bold leading-snug text-gray-900 sm:text-2xl">
            {proposal.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>대상: <strong className="font-medium text-gray-700">{complexName}</strong></span>
            <span>제출: <strong className="font-medium text-gray-700">{companyName}</strong></span>
            <span>작성일: {new Date().toLocaleDateString('ko-KR')}</span>
          </div>
        </div>

        <Block label="핵심 요약">
          <p className="text-sm leading-relaxed text-gray-700 sm:text-[15px]">{proposal.summary}</p>
        </Block>

        <Block label="노후도 진단 및 방수 필요성">
          <p className="text-sm leading-relaxed text-gray-700 sm:text-[15px]">{proposal.urgency_diagnosis}</p>
        </Block>

        <Block label="제안 공사 내용">
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 sm:text-[15px]">{proposal.solution}</p>
        </Block>

        <Block label={`${companyName}의 차별화 강점`}>
          <ul className="space-y-2.5">
            {proposal.why_us.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 sm:text-[15px]">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#0F4C8A]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block label="장기수선충당금 활용 방법">
          <p className="text-sm leading-relaxed text-gray-700 sm:text-[15px]">{proposal.fund_usage}</p>
        </Block>

        <Block label="하자보증 및 AS 정책">
          <div className="rounded-lg bg-blue-50 p-4 text-sm leading-relaxed text-gray-700 sm:text-[15px]">
            {proposal.warranty}
          </div>
        </Block>

        <div className="rounded-lg border border-[#FF6B35]/30 bg-[#FFF5F0] p-4 text-center sm:p-5">
          <p className="text-sm font-semibold text-[#0F1E36] sm:text-base">{proposal.cta}</p>
        </div>
      </div>
    </article>
  );
}

// ============================================================
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#0F4C8A]">{label}</h2>
      {children}
    </section>
  );
}

function ActionBtn({
  icon,
  children,
  onClick,
  variant = 'default',
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'success';
  disabled?: boolean;
}) {
  const cls =
    variant === 'primary'
      ? 'bg-[#FF6B35] text-white hover:bg-[#FF8C5A]'
      : variant === 'success'
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : '',
        cls,
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
}
