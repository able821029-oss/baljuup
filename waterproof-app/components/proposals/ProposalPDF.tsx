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

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NanumGothic',
    fontSize: 10,
    color: COLORS.text,
    padding: 40,
    lineHeight: 1.5,
  },

  // 상단 헤더 바
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navy,
    paddingBottom: 8,
    marginBottom: 18,
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
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.navy,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.6,
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
    lineHeight: 1.6,
    color: COLORS.navyDark,
  },

  // 강점 리스트
  whyItem: {
    flexDirection: 'row',
    marginBottom: 5,
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
    lineHeight: 1.55,
  },

  // 하자보증 박스
  warrantyBox: {
    backgroundColor: COLORS.blueBg,
    borderRadius: 4,
    padding: 10,
  },
  warrantyText: {
    fontSize: 10,
    lineHeight: 1.55,
  },

  // CTA 박스
  ctaBox: {
    marginTop: 20,
    backgroundColor: COLORS.accentBg,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 4,
    padding: 14,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.navyDark,
  },

  // 푸터
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
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
        {/* 헤더 */}
        <View style={styles.headerBar}>
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
// ============================================================
export async function downloadProposalPdf(props: ProposalPDFProps): Promise<void> {
  registerFontsOnce();

  // PDF 렌더링 → Blob
  const blob = await pdf(<ProposalPDFDocument {...props} />).toBlob();

  // 파일명: '{단지명}_제안서_{YYYY-MM-DD}.pdf'
  const yyyymmdd = new Date().toISOString().slice(0, 10);
  const safeName = props.complexName.replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  const filename = `${safeName}_제안서_${yyyymmdd}.pdf`;

  // 다운로드 트리거
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 메모리 해제 (즉시 revoke 하면 일부 브라우저에서 다운로드 취소될 수 있어 약간 지연)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
