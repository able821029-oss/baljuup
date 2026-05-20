/**
 * 제안서 PDF — 서버 사이드 렌더러
 *
 * 왜 별도 모듈인가?
 *   components/proposals/ProposalPDF.tsx 는 `'use client'` 로 표시되어 있다.
 *   해당 파일에는 `document.body.appendChild`, `URL.createObjectURL` 처럼
 *   브라우저 전용 API 를 사용하는 `downloadProposalPdf` 가 있기 때문이다.
 *   Next.js Route Handler 에서 그 파일을 임포트하면 'use client' 경계 때문에
 *   런타임에서 함수 참조가 제대로 동작하지 않을 수 있다.
 *
 *   따라서 PDF Document 컴포넌트 자체는 여기에 서버 전용으로 정의한다.
 *   레이아웃/스타일은 클라이언트 다운로드 버전과 동일하게 유지한다.
 *
 *   ※ 레이아웃/스타일 변경이 있다면 components/proposals/ProposalPDF.tsx 와
 *     동기화해야 한다 (현 시점 동일 — 2026-05-19 기준).
 */

import { Buffer } from 'node:buffer';
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
// 한글 폰트 — 모듈 로드 시 1회만 등록
// ============================================================
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
  Font.registerHyphenationCallback((word) => [word]);
  FONTS_REGISTERED = true;
}

// ============================================================
// 색상 / 스타일 — ProposalPDF.tsx 와 동일하게 유지
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
  warrantyBox: {
    backgroundColor: COLORS.blueBg,
    borderRadius: 4,
    padding: 10,
  },
  warrantyText: {
    fontSize: 10,
    lineHeight: 1.55,
  },
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
// PDF Document — 서버 전용 (브라우저 API 미사용)
// ============================================================
export interface ServerProposalPdfProps {
  proposal: GeneratedProposal;
  complexName: string;
  companyName: string;
  ownerName: string;
  workScope: string;
  /** 로고 절대 경로 (퍼블릭 URL) — 서버에서는 상대 경로(/logo.png)를 못 읽으므로 호출 측이 주입 */
  logoUrl?: string;
}

function ProposalDocument({
  proposal,
  complexName,
  companyName,
  ownerName,
  workScope,
  logoUrl,
}: ServerProposalPdfProps) {
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
        <View style={styles.headerBar}>
          <View style={styles.headerBrand}>
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            <Text style={styles.headerKicker}>방수 공사 제안서</Text>
          </View>
          <View>
            <Text style={styles.headerMeta}>
              제출: <Text style={styles.headerMetaStrong}>{companyName}</Text> · {ownerName} 대표
            </Text>
            <Text style={styles.headerMeta}>작성일: {today}</Text>
          </View>
        </View>

        <Text style={styles.title}>{proposal.title}</Text>
        <Text style={styles.subtitle}>대상 단지: {complexName} · 공사 범위: {workScope}</Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{proposal.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>1. 노후도 진단 및 방수 필요성</Text>
          <Text style={styles.sectionBody}>{proposal.urgency_diagnosis}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>2. 제안 공사 내용</Text>
          <Text style={styles.sectionBody}>{proposal.solution}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>3. {companyName}의 차별화 강점</Text>
          {proposal.why_us.map((item, i) => (
            <View key={i} style={styles.whyItem}>
              <Text style={styles.whyBullet}>{i + 1}.</Text>
              <Text style={styles.whyText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>4. 장기수선충당금 활용 방법</Text>
          <Text style={styles.sectionBody}>{proposal.fund_usage}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>5. 하자보증 및 AS 정책</Text>
          <View style={styles.warrantyBox}>
            <Text style={styles.warrantyText}>{proposal.warranty}</Text>
          </View>
        </View>

        <View style={styles.ctaBox}>
          <Text style={styles.ctaText}>{proposal.cta}</Text>
        </View>

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
// 외부 진입점 — Buffer 반환
// ============================================================
export async function renderProposalPdfBuffer(
  props: ServerProposalPdfProps,
): Promise<Buffer> {
  registerFontsOnce();

  // @react-pdf/renderer 의 pdf().toBlob() 은 Node 18+ 의 글로벌 Blob 을 통해
  // 서버 환경에서도 동작한다.
  const blob = await pdf(<ProposalDocument {...props} />).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================
// 파일명 생성기 — API/UI 공통 사용
// ============================================================
export function buildProposalPdfFilename(complexName: string): string {
  const yyyymmdd = new Date().toISOString().slice(0, 10);
  const safeName = complexName.replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  return `${safeName}_제안서_${yyyymmdd}.pdf`;
}
