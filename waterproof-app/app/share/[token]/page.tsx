/**
 * /share/[token] — 비로그인 제안서 뷰어 (Public)
 *
 *   - share_token 으로 proposals 행 조회 (anon RLS 정책으로 접근 가능)
 *   - 만료된 토큰이면 404
 *   - 표시: 회사명 / 단지명 / 작성일 / 요약 / 강점 + PDF 다운로드 버튼
 *   - 카톡으로 열린 경우(인앱 브라우저 포함) 그대로 보이도록 인증 미요구
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Download, FileText, Building2, CalendarDays, Sparkles, CheckCircle2 } from 'lucide-react';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { GeneratedProposal } from '@/lib/claude';

export const revalidate = 0;          // 항상 최신 (만료 체크 즉시 반영)
export const dynamic = 'force-dynamic';

// 비공개 데이터를 노출하지 않기 위해 noindex
export const metadata = {
  robots: { index: false, follow: false },
};

type ProposalShareRow = {
  id: string;
  title: string | null;
  status: string;
  content: {
    proposal?: GeneratedProposal;
    input?: {
      complex?: { name?: string; address?: string };
      userCompany?: { name?: string; owner?: string };
      workScope?: { scope?: string };
    };
  } | null;
  pdf_url: string | null;
  share_url: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  share_created_at: string | null;
  created_at: string;
  complexes: { name: string } | { name: string }[] | null;
};

export default async function ShareViewerPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const { token } = await Promise.resolve(params);

  if (!token || token.length < 16 || token.length > 64 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    notFound();
  }

  // 비로그인 anon 키로 직접 호출 — 008_proposal_sharing 의 anon SELECT 정책 의존
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  }
  const supabase = createAnonClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('proposals')
    .select(
      'id, title, status, content, pdf_url, share_url, share_token, share_expires_at, share_created_at, created_at, complexes(name)',
    )
    .eq('share_token', token)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const row = data as unknown as ProposalShareRow;

  // RLS 가 이미 만료된 행은 안 줄 텐데, 방어적으로 한 번 더 체크
  if (row.share_expires_at && new Date(row.share_expires_at).getTime() < Date.now()) {
    return <ExpiredCard />;
  }

  if (!row.content?.proposal) {
    return <BrokenCard />;
  }

  const generated = row.content.proposal;
  const complexFromJoin = Array.isArray(row.complexes) ? row.complexes[0] : row.complexes;
  const complexName =
    complexFromJoin?.name ?? row.content.input?.complex?.name ?? '(단지 미지정)';
  const companyName = row.content.input?.userCompany?.name ?? '';
  const ownerName = row.content.input?.userCompany?.owner ?? '';
  const workScope = row.content.input?.workScope?.scope ?? '방수공사';
  const pdfUrl = row.pdf_url;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      {/* 헤더 카드 */}
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#FF6B35]">
          <Sparkles size={14} />
          방수 공사 제안서
        </div>
        <h1 className="mt-2 text-xl font-bold leading-snug text-gray-900 sm:text-2xl">
          {generated.title || `${complexName} ${workScope} 제안`}
        </h1>

        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2 sm:gap-3 sm:text-sm">
          <MetaRow icon={<Building2 size={14} />} label="대상" value={complexName} />
          <MetaRow icon={<FileText size={14} />} label="공사" value={workScope} />
          <MetaRow
            icon={<CalendarDays size={14} />}
            label="작성"
            value={new Date(row.created_at).toLocaleDateString('ko-KR')}
          />
          {companyName && (
            <MetaRow
              icon={<Sparkles size={14} />}
              label="제출"
              value={ownerName ? `${companyName} · ${ownerName} 대표` : companyName}
            />
          )}
        </div>

        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0F4C8A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0c3d6e]"
          >
            <Download size={16} />
            제안서 PDF 다운로드
          </a>
        )}
      </header>

      {/* 본문 — 마케팅 친화적 레이아웃 */}
      <main className="mt-5 space-y-4">
        <Section label="핵심 요약">
          <p className="text-[15px] leading-relaxed text-gray-800">{generated.summary}</p>
        </Section>

        <Section label="노후도 진단 및 방수 필요성">
          <p className="text-[15px] leading-relaxed text-gray-800">{generated.urgency_diagnosis}</p>
        </Section>

        <Section label="제안 공사 내용">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-gray-800">
            {generated.solution}
          </p>
        </Section>

        {generated.why_us?.length > 0 && (
          <Section label={`${companyName || '저희'}의 차별화 강점`}>
            <ul className="space-y-2.5">
              {generated.why_us.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[15px] text-gray-800">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#0F4C8A]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section label="장기수선충당금 활용 방법">
          <p className="text-[15px] leading-relaxed text-gray-800">{generated.fund_usage}</p>
        </Section>

        <Section label="하자보증 및 AS 정책">
          <div className="rounded-lg bg-blue-50 p-4 text-[15px] leading-relaxed text-gray-800">
            {generated.warranty}
          </div>
        </Section>

        <div className="rounded-xl border border-[#FF6B35]/40 bg-[#FFF5F0] p-5 text-center">
          <p className="text-base font-bold text-[#0F1E36]">{generated.cta}</p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#FF8C5A]"
            >
              <Download size={16} />
              PDF 받아보기
            </a>
          )}
        </div>
      </main>

      {/* 푸터 */}
      <footer className="mt-8 border-t border-gray-200 pt-5 text-center text-xs text-gray-500">
        <p>본 제안서는 발주Up 을 통해 자동 생성·전달되었습니다.</p>
        <p className="mt-1">
          <Link href="/" className="text-[#0F4C8A] hover:underline">
            발주Up 알아보기
          </Link>
        </p>
      </footer>
    </div>
  );
}

// ============================================================
function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-400">{icon}</span>
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#0F4C8A]">
        {label}
      </h2>
      {children}
    </section>
  );
}

function ExpiredCard() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-bold text-gray-900">만료된 공유 링크</h1>
      <p className="mt-2 text-sm text-gray-600">
        이 제안서 공유 링크는 만료되었습니다.
        <br />
        제안서를 보내드린 분께 새 링크를 요청해 주세요.
      </p>
    </div>
  );
}

function BrokenCard() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-bold text-gray-900">제안서를 불러올 수 없습니다</h1>
      <p className="mt-2 text-sm text-gray-600">
        제안서 데이터가 손상되었거나 삭제되었습니다.
      </p>
    </div>
  );
}
