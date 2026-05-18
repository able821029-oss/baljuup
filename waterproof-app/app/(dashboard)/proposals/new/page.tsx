/**
 * /proposals/new — AI 제안서 생성 페이지
 *
 * 흐름:
 *   1) ProposalForm 입력 →
 *   2) POST /api/proposals/generate (15~20초) →
 *   3) ProposalPreview 표시 (다시 생성 / 저장 / PDF 다운로드)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  ProposalForm,
  type ProposalFormValues,
} from '@/components/proposals/ProposalForm';
import { ProposalPreview } from '@/components/proposals/ProposalPreview';
import type { GeneratedProposal } from '@/lib/claude';
import { saveProposal } from '@/app/(dashboard)/proposals/actions';

export default function NewProposalPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState<GeneratedProposal | null>(null);
  const [lastValues, setLastValues] = useState<ProposalFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleGenerate(values: ProposalFormValues) {
    setSubmitting(true);
    setError(null);
    setSaved(false);
    setLastValues(values);

    try {
      const res = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        const msg = json?.error || `요청 실패 (HTTP ${res.status})`;
        const hint =
          json?.code === 'overloaded' || json?.code === 'rate_limit'
            ? ' — 잠시 후 다시 시도해주세요.'
            : '';
        throw new Error(msg + hint);
      }

      setProposal(json.proposal as GeneratedProposal);
      setTimeout(() => {
        document.getElementById('proposal-preview')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 50);
    } catch (e) {
      const err = e as Error;
      setError(err?.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRegenerate() {
    if (lastValues) handleGenerate(lastValues);
  }

  async function handleSave() {
    if (!proposal || !lastValues) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveProposal({
        proposal,
        complex: {
          name: lastValues.complex.name,
          address: lastValues.complex.address,
          built_year: lastValues.complex.built_year,
          households: lastValues.complex.households,
        },
        userCompany: lastValues.userCompany,
        workScope: lastValues.workScope,
      });
      if (!result.ok) throw new Error(result.error);
      setSaved(true);
      // 저장 후 잠깐 머무르다 목록으로 이동
      setTimeout(() => router.push('/proposals'), 800);
    } catch (e) {
      const err = e as Error;
      setError('저장 실패: ' + (err?.message || '알 수 없는 오류'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!proposal || !lastValues) return;
    setExportingPdf(true);
    setError(null);
    try {
      const { downloadProposalPdf } = await import('@/components/proposals/ProposalPDF');
      await downloadProposalPdf({
        proposal,
        complexName: lastValues.complex.name,
        companyName: lastValues.userCompany.name,
        ownerName: lastValues.userCompany.owner,
        workScope: lastValues.workScope.scope,
      });
    } catch (e) {
      const err = e as Error;
      setError('PDF 생성 실패: ' + (err?.message || '알 수 없는 오류') +
        ' (한글 폰트 로드 차단 환경일 수 있습니다)');
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">제안서 만들기</h2>
        <p className="mt-1 text-sm text-gray-500">
          단지 정보와 공사 범위를 입력하면 AI가 관리소장 맞춤 제안서를 작성합니다.
        </p>
      </div>

      <ol className="flex items-center gap-2 text-xs text-gray-500">
        <Step n={1} label="정보 입력" active={!proposal} />
        <Arrow />
        <Step n={2} label="AI 생성" active={submitting} />
        <Arrow />
        <Step n={3} label="검토 / 저장 / PDF" active={!!proposal && !submitting} />
      </ol>

      <ProposalForm onSubmit={handleGenerate} submitting={submitting} defaultValues={lastValues ?? undefined} />

      {submitting && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin text-[#FF6B35]" />
          AI가 제안서를 작성하고 있습니다. 보통 15~20초 정도 걸립니다...
        </div>
      )}

      {error && !submitting && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">오류</div>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
        </div>
      )}

      {exportingPdf && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin text-[#0F4C8A]" />
          PDF를 만들고 있습니다. 한글 폰트 로드에 잠시 시간이 걸릴 수 있습니다...
        </div>
      )}

      {proposal && !submitting && lastValues && (
        <div id="proposal-preview" className="scroll-mt-6">
          <ProposalPreview
            proposal={proposal}
            complexName={lastValues.complex.name}
            companyName={lastValues.userCompany.name}
            onRegenerate={handleRegenerate}
            onSave={handleSave}
            saving={saving}
            saved={saved}
            onDownloadPdf={handleDownloadPdf}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
function Step({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={[
          'flex size-6 items-center justify-center rounded-full text-[11px] font-bold',
          active ? 'bg-[#FF6B35] text-white' : 'bg-gray-200 text-gray-500',
        ].join(' ')}
      >
        {n}
      </span>
      <span className={active ? 'font-semibold text-gray-900' : ''}>{label}</span>
    </li>
  );
}

function Arrow() {
  return <span className="text-gray-300">→</span>;
}
