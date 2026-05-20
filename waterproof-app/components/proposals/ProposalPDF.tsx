/**
 * 제안서 PDF 생성기
 *
 * - @react-pdf/renderer 로 클라이언트에서 PDF 생성
 * - 한글 폰트: 네이버 공식 CDN 의 NanumGothic (TTF) 사용
 *   (@react-pdf/renderer 는 TTF 만 안정적으로 지원)
 * - 번들이 큼 (~1MB) → new/page.tsx 에서 동적 import 로 분리 로드
 *
 * 외부 사용:
 *   const { downloadProposalPdf } = await import('@/components/proposals/ProposalPDF');
 *   await downloadProposalPdf({ proposal, complexName, companyName, ownerName, workScope });
 */

'use client';

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  pdf,
} from '@react-pdf/renderer';
import type { GeneratedProposal } from '@/lib/claude';

// ============================================================
// 한글 폰트 등록 (모듈 로드 시 1회)
// ============================================================
// 네이버 한글 캠페인의 공식 정적 CDN — 라이선스: OFL (자유 사용)
let FONTS_REGISTERED = false;
function registerFontsOnce() {
  if (FONTS_REGISTERED) return;
  Font.register({
    family: 'NanumGothic',
    fonts: [
      { src: 'https://hangeul.pstatic.net/hangeul_static/webfont/nanumgothic/NanumGothic.ttf', fontWeight: 400 },
      { src: 'https://hangeul.pstatic.net/hangeul_static/webfont/nanumgothic/NanumGothicBold.ttf', fontWeight: 700 },
    ],
  });
  // 자동 줄바꿈 hyphenation 비활성화 (한국어는 어절 단위가 자연스러움)
  Font.registerHyphenationCallback((word) => [word]);
  FONTS_REGISTERED = true;
}

// ============================================================
// 색상 / 스타일
// ============================================================
const COLORS = {
  navy: '#0F4C8A',
  navyDark: '#0F1E36',
  accent: '#FF6B35',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#E5E7EB',
  surface: '#F9FAFB',
  accentBg: '#FFF5F0',
  blueBg: '#EFF6FF',
};

// 강조 포인트 컬러 (요청 사양: #1d4ed8)
const EMPH_BLUE = '#1d4ed8';

// 페이지 여백 — 인쇄 시 잘림 방지 안전 영역
// 좌우 50pt, 상하 40pt 기준에 헤더(상단 약 50pt)/푸터(하단 약 20pt) 공간 확보
const PAGE_PADDING_TOP = 90;       // 40 (안전 여백) + ~50 (헤더 차지 영역)
const PAGE_PADDING_BOTTOM = 60;    // 40 (안전 여백) + ~20 (푸터 차지 영역)
const PAGE_PADDING_X = 50;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NanumGothic',
    fontSize: 10,
    color: COLORS.text,
    paddingTop: PAGE_PADDING_TOP,
    paddingBottom: PAGE_PADDING_BOTTOM,
    paddingLeft: PAGE_PADDING_X,
    paddingRight: PAGE_PADDING_X,
    lineHeight: 1.5,
  },

  // 상단 헤더 바 (모든 페이지 반복 — absolute + fixed)
  headerBar: {
    position: 'absolute',
    top: 40,
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navy,
    paddingBottom: 8,
  },
  headerBrand: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  logo: {
    width: 70,
    height: 21,
    objectFit: 'contain',
  },
  headerKicker: {
    fontSize: 9,
    color: COLORS.accent,
    fontWeight: 700,
    letterSpacing: 1,
  },
  headerMeta: {
    fontSize: 8,
    color: COLORS.muted,
    textAlign: 'right',
  },
  headerMetaStrong: {
    color: COLORS.text,
    fontWeight: 700,
  },

  // 제목
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: COLORS.navyDark,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 18,
  },

  // 섹션
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.navyDark,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.5,
  },

  // 강조 수치 (견적액, 충당금 등) — 12pt Bold, 포인트 컬러
  emphNumber: {
    fontSize: 12,
    fontWeight: 700,
    color: EMPH_BLUE,
  },

  // 요약 박스
  summaryBox: {
    backgroundColor: COLORS.surface,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.navy,
    padding: 12,
    marginBottom: 18,
  },
  summaryText: {
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.5,
    color: COLORS.navyDark,
  },

  // 강점 리스트
  whyItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  whyBullet: {
    width: 14,
    fontSize: 10,
    color: COLORS.accent,
    fontWeight: 700,
  },
  whyText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
  },

  // 하자보증 박스
  warrantyBox: {
    backgroundColor: COLORS.blueBg,
    borderRadius: 4,
    padding: 10,
  },
  warrantyText: {
    fontSize: 10,
    lineHeight: 1.5,
  },

  // CTA 박스
  ctaBox: {
    marginTop: 20,
    backgroundColor: COLORS.accentBg,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 4,
    padding: 14,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.navyDark,
    textAlign: 'center',
  },

  // 푸터 (모든 페이지 반복 — absolute + fixed)
  footer: {
    position: 'absolute',
    bottom: 25,
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.muted,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
});

// ============================================================
// PDF 문서 컴포넌트
// ============================================================
export interface ProposalPDFProps {
  proposal: GeneratedProposal;
  complexName: string;
  companyName: string;
  ownerName: string;
  workScope: string;
}

export function ProposalPDFDocument({
  proposal,
  complexName,
  companyName,
  ownerName,
  workScope,
}: ProposalPDFProps) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document
      title={proposal.title}
      author={companyName}
      subject={`${complexName} ${workScope} 제안서`}
    >
      <Page size="A4" style={styles.page}>
        {/* 헤더 (모든 페이지 반복 — fixed) */}
        <View style={styles.headerBar} fixed>
          <View style={styles.headerBrand}>
            {/* 로고 — react-pdf 는 SVG 의 글로우/필터 미지원이므로 PNG 사용 */}
            <Image src="/logo.png" style={styles.logo} />
            <Text style={styles.headerKicker}>방수 공사 제안서</Text>
          </View>
          <View>
            <Text style={styles.headerMeta}>
              제출: <Text style={styles.headerMetaStrong}>{companyName}</Text> · {ownerName} 대표
            </Text>
            <Text style={styles.headerMeta}>작성일: {today}</Text>
          </View>
        </View>

        {/* 제목 */}
        <Text style={styles.title}>{proposal.title}</Text>
        <Text style={styles.subtitle}>대상 단지: {complexName} · 공사 범위: {workScope}</Text>

        {/* 요약 */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{proposal.summary}</Text>
        </View>

        {/* 노후도 진단 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>1. 노후도 진단 및 방수 필요성</Text>
          <Text style={styles.sectionBody}>{proposal.urgency_diagnosis}</Text>
        </View>

        {/* 제안 내용 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>2. 제안 공사 내용</Text>
          <Text style={styles.sectionBody}>{proposal.solution}</Text>
        </View>

        {/* 차별화 강점 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>3. {companyName}의 차별화 강점</Text>
          {proposal.why_us.map((item, i) => (
            <View key={i} style={styles.whyItem}>
              <Text style={styles.whyBullet}>{i + 1}.</Text>
              <Text style={styles.whyText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* 충당금 활용 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>4. 장기수선충당금 활용 방법</Text>
          <Text style={styles.sectionBody}>{proposal.fund_usage}</Text>
        </View>

        {/* 하자보증 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>5. 하자보증 및 AS 정책</Text>
          <View style={styles.warrantyBox}>
            <Text style={styles.warrantyText}>{proposal.warranty}</Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaBox}>
          <Text style={styles.ctaText}>{proposal.cta}</Text>
        </View>

        {/* 푸터 (절대 위치 — 모든 페이지에 고정) */}
        <View style={styles.footer} fixed>
          <Text>{companyName} · {ownerName} 대표</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// ============================================================
// 다운로드 트리거 — 외부에서 호출하는 함수
// =================
// ============================================================
// 다운로드 트리거 — 외부에서 호출하는 함수
// ============================================================
export async function downloadProposalPdf(props: ProposalPDFProps): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(<ProposalPDFDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `발주Up_제안서_${props.complexName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
