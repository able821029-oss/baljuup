/**
 * /signup/check-email — 가입 완료 + 이메일 확인 안내 (Server Component)
 *
 * Stitch 디자인 반영:
 *   - 좌측 파랑 보더 카드
 *   - 큰 체크 아이콘 (원형 배경)
 *   - 헤딩 + 본문 2단
 *   - 벤토 그리드 3종 (정밀 AI 분석 / 실시간 알림 / 신뢰 기반 비즈니스)
 *   - CTA "로그인하기" + 보조 "이메일 다시 보내기"
 *   - 푸터 고객센터 번호
 *
 * Supabase Confirm email 이 OFF 인 경우 가입 직후 /dashboard 로 직접 이동하므로
 * 이 페이지는 이메일 확인이 ON 인 경우의 안내 화면 역할.
 */

import Link from "next/link";
import {
  CheckCircle2,
  BarChart3,
  BellRing,
  Shield,
  ArrowRight,
  Mail,
} from "lucide-react";

export default function CheckEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams.email ?? "입력하신 이메일";

  return (
    <div className="flex w-full max-w-2xl flex-col items-center lg:max-w-4xl">
      {/* 메인 카드 — 좌측 파랑 보더 강조 */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm md:p-10">
        <span className="absolute bottom-0 left-0 top-0 w-1 bg-accent" />

        {/* 중앙 체크 아이콘 */}
        <div className="mb-6 flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-blue-50 md:size-24">
            <CheckCircle2 size={56} className="text-accent" fill="white" strokeWidth={2} />
          </div>
        </div>

        {/* 헤딩 */}
        <h1 className="text-2xl font-bold tracking-tight text-on-surface md:text-4xl">
          가입 신청을 받았습니다
        </h1>

        {/* 설명 */}
        <div className="mx-auto mb-8 mt-3 max-w-2xl">
          <p className="text-base leading-relaxed text-on-surface-var md:text-lg">
            <Mail size={16} className="-mt-1 mr-1.5 inline text-accent" />
            <span className="font-semibold text-on-surface">{email}</span> 로 보낸 인증 메일을
            <br className="md:hidden" /> 클릭하면 가입이 완료됩니다.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            인증 후 대시보드에서 AI 분석 결과와 맞춤 발주 정보를 바로 확인할 수 있습니다.
          </p>
        </div>

        {/* 벤토 그리드 — 가입 혜택 3종 */}
        <div className="mb-8 grid w-full grid-cols-1 gap-3 md:grid-cols-3 md:gap-5">
          <BenefitCard
            icon={BarChart3}
            title="정밀 AI 분석"
            description="수도권 1.7만 단지의 발주 가능성을 점수로 자동 분석"
          />
          <BenefitCard
            icon={BellRing}
            title="실시간 알림"
            description="신규 입찰공고와 점수 변화를 가장 빠르게 알림"
          />
          <BenefitCard
            icon={Shield}
            title="신뢰 기반"
            description="검증된 공공데이터와 사실 기반의 안전한 영업"
          />
        </div>

        {/* CTA */}
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/login"
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-accent text-base font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
          >
            <span>로그인 페이지로</span>
            <ArrowRight size={20} />
          </Link>
        </div>

        {/* 보조 텍스트 — 메일이 안 올 때 안내 */}
        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-left text-xs leading-relaxed text-on-surface-var">
          <p className="mb-2 font-semibold text-on-surface">메일이 오지 않나요?</p>
          <ul className="space-y-1 pl-4">
            <li className="list-disc">스팸함 또는 프로모션 탭을 확인해보세요.</li>
            <li className="list-disc">이메일 주소에 오타가 없는지 확인해주세요.</li>
            <li className="list-disc">5분 이상 안 오면 회원가입을 다시 시도해보세요.</li>
          </ul>
        </div>
      </div>

      {/* 푸터 — 고객센터 */}
      <footer className="mt-6 text-center">
        <p className="text-xs text-slate-400">
          도움이 필요하신가요? 고객센터{" "}
          <a href="mailto:support@baljuup.co.kr" className="font-semibold text-on-surface-var hover:text-accent">
            support@baljuup.co.kr
          </a>
          {" "} (평일 09:00~18:00)
        </p>
      </footer>
    </div>
  );
}

// ============================================================
// 벤토 카드
// ============================================================
import type { LucideIcon } from "lucide-react";

function BenefitCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-start rounded-lg border border-slate-200/60 bg-slate-50/70 p-4 text-left transition-colors hover:bg-slate-100">
      <Icon size={22} className="mb-3 text-accent" />
      <span className="mb-1 text-base font-bold text-on-surface">{title}</span>
      <p className="text-xs leading-relaxed text-on-surface-var">{description}</p>
    </div>
  );
}
