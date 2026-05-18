# 발주Up — Claude 아티팩트용 디자인 프롬프트

레퍼런스 두 장 (Product UI Styleguide / JUSTUI Onboarding) 을 바탕으로 추출한 디자인 시스템과,
claude.ai 아티팩트에 그대로 붙여넣을 수 있는 한국어 프롬프트입니다.

사용법: claude.ai 새 대화 → 아래 "프롬프트 1" 전체 복사·붙여넣기 → 아티팩트 생성 → 마음에 들면 "프롬프트 2~6" 으로 페이지별 화면을 이어서 생성.

---

## 프롬프트 0 — 공통 시스템 컨텍스트 (모든 프롬프트 앞에 붙임)

```
당신은 한국 B2B SaaS의 시니어 프로덕트 디자이너 겸 프론트엔드 개발자입니다.
아래 제품에 대한 화면을 React + Tailwind CSS 단일 파일 아티팩트로 작성하세요.

[제품]
- 이름: 발주Up
- 한 줄 소개: 수도권 방수 전문업체가 아파트 발주 시점을 6개월 전에 예측하고 AI 제안서를 30분 만에 만드는 B2B SaaS
- 타겟 사용자: 방수업체 대표 (40~55세, 직원 3~15명)
- 핵심 가치: "공고 올라오면 이미 늦다. 6개월 전에 먼저 알고 단독 접촉하라"
- 사용 환경: 데스크탑 60% / 모바일 40% / 한국어

[디자인 원칙 — 절대 어기지 말 것]
1. 이모지 절대 금지. 표정·손짓 등 모든 이모지(👋🎉🔥📊 등) 사용 금지.
2. 모든 아이콘은 lucide-react 의 굵은 라인 아이콘만 사용. (Building2, Bell, FileText, TrendingUp, AlertCircle, Calendar, CreditCard, Settings, LayoutDashboard, Users, MapPin, Phone, Wrench, Wallet, Megaphone, Sparkles, Plus, Search, Filter, ArrowRight, ArrowLeft, CheckCircle2, Loader2, Download, Save, Check, Trash2, Trophy, Mail, LogOut, RefreshCw, Menu, X, User, Flame, ChevronLeft, ChevronRight 등)
3. 한국어 표시. 영문은 데이터(URL, 이메일) 또는 약어만.
4. 모든 색은 아래 정의된 토큰에서만. 임의 hex 사용 금지.
5. 모든 spacing 은 4/8/12/16/20/24/32/40/48/64 중에서만.
6. 모든 radius 는 4/8/12/16/9999 중에서만.
7. 데이터는 모두 실제 같은 한국어 더미 데이터 (단지명: 강남 래미안 1차, 분당 파크뷰, 송파 헬리오시티 3단지 등 사실적으로)
8. 폰트: Pretendard Variable (시스템 폴백). 숫자 강조 시 tabular-nums 클래스.

[디자인 토큰]
색상:
  --bg:           #F4F6FA  (앱 배경)
  --surface:      #FFFFFF  (카드)
  --surface-2:    #F9FAFB  (서브 카드, 호버 배경)
  --border:       #E5E7EB
  --border-strong:#D1D5DB
  --text:         #111827  (본문)
  --text-muted:   #6B7280  (라벨, 보조)
  --text-faint:   #9CA3AF
  --primary:      #2563EB  (액션 — 파랑)
  --primary-hover:#1D4ED8
  --primary-soft: #EFF6FF  (배경 강조)
  --accent:       #FF6B35  (긴급·경고 한정 — 발주 임박/에러 상태만)
  --success:      #16A34A
  --warning:      #CA8A04
  --danger:       #DC2626
  --sidebar:      #0F1E36  (좌측 사이드바 다크)
  --sidebar-text: #FFFFFF
  --sidebar-muted:rgba(255,255,255,0.6)

타이포 스케일:
  display:    text-[32px] sm:text-[40px] font-bold  leading-tight tracking-tight
  heading-lg: text-[24px] sm:text-[28px] font-bold  leading-snug
  heading-md: text-[18px] sm:text-[20px] font-semibold leading-snug
  subtitle:   text-[15px] sm:text-[16px] font-medium leading-normal
  body:       text-[14px] sm:text-[15px] font-normal leading-relaxed
  body-sm:    text-[13px] font-normal
  caption:    text-[12px] font-medium text-muted
  label:      text-[11px] font-bold uppercase tracking-wider text-primary

스페이싱 (8px 그리드): 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64

라운드:
  sm: rounded             (4px)
  md: rounded-lg          (8px)
  lg: rounded-xl          (12px)
  xl: rounded-2xl         (16px)
  pill: rounded-full

그림자 (Elevation):
  e0: 없음
  e1: shadow-[0_1px_2px_rgba(15,30,54,0.06)]
  e2: shadow-[0_4px_12px_rgba(15,30,54,0.08)]
  e3: shadow-[0_12px_32px_rgba(15,30,54,0.12)]

[컴포넌트 표준]
Button Primary:    h-10 px-5 rounded-lg bg-[--primary] text-white text-[14px] font-semibold hover:bg-[--primary-hover] active:scale-[0.98] transition
Button Secondary:  h-10 px-5 rounded-lg bg-white border border-[--border-strong] text-[--text] hover:bg-[--surface-2]
Button Ghost:      h-10 px-4 rounded-lg text-[--text-muted] hover:bg-[--surface-2]
Button Danger:     h-10 px-5 rounded-lg bg-[--danger] text-white hover:bg-red-700
Button Pill:       h-11 px-6 rounded-full (특별 CTA — 랜딩, 온보딩 한정)

Input:           h-10 px-3 rounded-lg border border-[--border] bg-white text-[14px] focus:border-[--primary] focus:ring-2 focus:ring-[--primary-soft]
Input Error:     border-[--danger] focus:ring-red-100
Chip Filter:     h-8 px-3 rounded-full text-[12px] bg-white border border-[--border-strong]
Chip Selected:   bg-[--primary] text-white border-transparent
Tab Underline:   pb-2 border-b-2 (활성: border-[--primary] text-[--text], 비활성: border-transparent text-[--text-muted])

Card Flat:       bg-white border border-[--border] rounded-xl p-5
Card Elevated:   bg-white rounded-xl p-5 shadow-e1 hover:shadow-e2 transition
Card Interactive: 위와 동일 + cursor-pointer + active:scale-[0.99]

Alert Success:   bg-emerald-50 border-l-4 border-[--success] rounded-lg px-4 py-3 + CheckCircle2 icon
Alert Info:      bg-blue-50    border-l-4 border-[--primary] rounded-lg px-4 py-3 + Info icon
Alert Warning:   bg-amber-50   border-l-4 border-[--warning] rounded-lg px-4 py-3 + AlertTriangle icon
Alert Error:     bg-red-50     border-l-4 border-[--danger]  rounded-lg px-4 py-3 + AlertCircle icon

Avatar:          size-9 rounded-full bg-[--primary-soft] flex items-center justify-center text-[--primary] text-[13px] font-semibold

Skeleton:        bg-[--surface-2] animate-pulse rounded

[반응형 원칙]
- 모바일 first. md(768px) 부터 데스크탑 레이아웃 적용
- 사이드바: 데스크탑 고정 / 모바일 햄버거 + 드로어 + 오버레이
- 카드 그리드: 모바일 1열 → sm 2열 → lg 3~4열
- 폰트: 모바일 1단계 작게 (display 32px → sm 40px 식)

[출력]
- 단일 React 함수 컴포넌트 (default export)
- Tailwind 클래스만 사용 (인라인 스타일 최소)
- 더미 데이터는 컴포넌트 상단에 const 로
- export default function ComponentName() { ... } 형태
- 코멘트는 한국어
```

---

## 프롬프트 1 — 대시보드 메인

```
[프롬프트 0 의 전체 시스템 컨텍스트를 먼저 따른 뒤]

다음 화면을 만들어주세요:

화면: /dashboard — 사용자 로그인 후 첫 화면

레이아웃:
- 좌측 사이드바 (--sidebar 배경, 데스크탑 너비 256px, 모바일 드로어)
- 상단 탑바 (높이 64px, 흰색 배경, 페이지 제목 + 알림 벨 + 사용자 메뉴)
- 본문: --bg 배경

본문 구성 (위에서 아래):
1. 페이지 헤더 한 줄: 좌측 "오늘의 상황" heading-lg + 우측 [Plus 아이콘 + "제안서 만들기"] Primary 버튼
   서브 한 줄: "마지막 갱신 2026-05-18 06:00" body-sm text-muted

2. 지표 카드 4개 (Card Elevated, 그리드 sm 2열 / lg 4열):
   - 모니터링 단지 : 847 단지 (Building2 아이콘, primary 색)
   - 즉시 접촉 필요 : 23 단지 (Flame 아이콘, accent 색) — 숫자가 가장 큰 강조
   - 이번 달 알림 : 7 건 (Bell 아이콘, primary 색)
   - 수주 성공 : 2 건 (Trophy 아이콘, success 색)
   각 카드: 좌측 상단 라벨(caption), 중앙 큰 숫자(display, tabular-nums), 우측 상단 아이콘(size-5)
   하단 작은 변동 표시 "지난주 +12" (success 색) 또는 "-2" (danger 색)

3. 본문 2단 그리드 (lg:grid-cols-3):
   좌측 2열 — 알림 피드 카드:
     - 헤더: "이번 주 알림" heading-md + 우측 "전체 보기" text link
     - 리스트 4건 (Card Flat 안에서 divide-y):
       - AlertCircle 아이콘(--accent) | "강남 래미안 1차" 단지명 | "옥상방수 입찰공고 발생 · 마감 D-7" body-sm | 우측 "3시간 전" caption
       - TrendingUp 아이콘(--warning) | "분당 파크뷰" | "예측 점수 82점 돌파 (75 → 82)" | "어제"
       - Clock 아이콘(--warning) | "송파 헬리오시티 3단지" | "입찰 마감 임박 (D-3)" | "2일 전"
       - Trophy 아이콘(--success) | "은평 뉴타운 8단지" | "수주 성공 — 옥상방수 1.8억" | "5일 전"
   우측 1열 — 즉시 접촉 TOP 5 카드:
     - 헤더: "즉시 접촉 TOP 5" heading-md + "모두 보기" link
     - 5개 단지 카드 (mini card, 각각):
       - 좌측: 단지명(subtitle) + "예상 발주 2026년" caption + "충당금 3.2억" caption
       - 우측: 큰 점수(display, 색은 점수별 — 80+ accent, 60+ warning, 40+ 노랑, 그 외 회색) + "즉시 접촉" label
       - 점수 1) 강남 래미안 1차 92 (accent)
              2) 분당 파크뷰 87 (accent)
              3) 송파 헬리오시티 3단지 84 (accent)
              4) 용산 더센트럴 82 (accent)
              5) 마포 래미안 푸르지오 81 (accent)

4. 하단 CTA 카드 (border-dashed, 가운데 정렬):
   "수도권 1.7만 단지 중 발주 임박 단지를 한눈에" subtitle
   "예측 점수, 충당금 잔액, 입찰공고를 필터링해 영업 우선순위를 정하세요." body-sm
   "단지 목록으로 →" text link (ArrowRight 아이콘)

사이드바 메뉴 (위에서 아래, 아이콘 + 라벨):
  - LayoutDashboard | 대시보드 (활성 — bg primary 안에 흰색)
  - Building2       | 단지 목록
  - FileText        | 제안서
  - Bell            | 알림 (badge "3" 우측)
  - Settings        | 설정
사이드바 상단: "발주Up" 워드마크 (display 톤다운, 흰색)
사이드바 하단: 사용자 영역 (Avatar + "한일방수 / 김방수 대표" + LogOut 아이콘)

탑바: 좌측 햄버거(모바일만) + 페이지 제목 "대시보드" + 우측 Bell(빨강 점) + Avatar

이모지 절대 금지. 모든 아이콘은 lucide-react.
```

---

## 프롬프트 2 — 단지 목록 (필터 + 테이블)

```
[프롬프트 0 시스템 컨텍스트 사용]

화면: /complexes — 단지 검색 목록

상단:
- 페이지 헤더: "단지 목록" heading-lg + 서브 "예측 점수, 지역, 정렬 기준으로 영업 우선순위를 정하세요." body-sm

필터 바 카드 (Card Flat, 가로 정렬):
- 좌측: Filter 아이콘 + 4개 칩 [전체 점수] [80+ 즉시] [60+ 6개월] [40+ 1년] (Chip Filter, 선택 시 색이 점수별)
- 가운데: 지역 select [전 지역 / 서울 / 경기 / 인천]
- 가운데: 정렬 select (ArrowUpDown 아이콘) [점수 높은 순 / 준공 오래된 순 / 단지명 순]
- 우측: "총 1,234 단지" body-sm

테이블 (데스크탑, Card Flat 안):
| 단지 | 준공 | 세대수 | 예상 발주 | 예측 점수 |
|---|---|---|---|---|
| 단지명 (subtitle, 색 text) / 주소 (caption, text-muted) | 2001 | 1,200 | 2026 | [점수 배지 92 즉시] |
... 10행 더미 데이터
헤더 행: bg-surface-2, 라벨 폰트
짝수 행: hover bg-surface-2
점수 배지: rounded-md, 좌측 컬러 도트 + 숫자 + tabular-nums

모바일 (md 미만): 테이블 대신 PredictionScore mini 카드 세로 나열

페이지네이션 하단 가운데:
- ChevronLeft 버튼 (비활성)
- 1 2 3 4 5 ... 12 (활성: bg-primary 흰글자, 비활성: text-muted hover bg surface-2)
- ChevronRight 버튼

이모지 없음. lucide 아이콘만.
```

---

## 프롬프트 3 — 단지 상세 (점수 breakdown + 타임라인 + 차트)

```
[프롬프트 0 시스템 컨텍스트 사용]

화면: /complexes/[id] — 단지 상세

상단:
- ArrowLeft 아이콘 + "단지 목록으로" text link (text-muted)

헤더 카드 (Card Flat, 큰):
- 좌측: 작은 tier 배지 "즉시 접촉" (rounded-full px-2.5, bg-accent/10 text-accent) → 큰 단지명 display "강남 래미안 1차" → 주소 "서울 강남구 ..." (MapPin 아이콘 + body-sm muted)
- 우측: Primary 버튼 [Sparkles 아이콘 + "이 단지로 제안서 만들기"]

본문 2단 그리드 (lg:grid-cols-3):
좌측 1열: 단지 정보 4개 카드 (각각 Card Flat 작은 사이즈):
  - Calendar 아이콘 | "준공연도" label + "2001년" subtitle + "25년 경과" caption
  - Users 아이콘 | "세대수" label + "1,200세대" subtitle + "12개 동" caption
  - Building2 아이콘 | "관리방식" label + "위탁관리" subtitle + "한국주택관리(주)" caption
  - Phone 아이콘 | "관리사무소" label + "02-1234-5678" subtitle + "클릭하여 전화" caption (호버 시 primary)

우측 2열: 4개 섹션
1) 점수 큰 카드 (Card Flat, accent 색 보더):
   상단 좌측: "예측 점수" label
   상단 좌측 큰 숫자: display 사이즈의 2배 (text-[64px]) "92" — accent 색, tabular-nums
   숫자 옆 "즉시 접촉" subtitle bold accent
   하단: "예상 발주 2026년 (0년 후)" caption
   우측: 4개 막대 차트 (가로 progress bar, 2열 그리드):
     - "사이클" label + "73/100" caption | bg-primary bar 73%
     - "노후" label + "62/50" caption | bg-primary bar 100%
     - "충당금" label + "20/20" caption | bg-success bar 100%
     - "입찰" label + "15/15" caption | bg-accent bar 100%
   카드 하단 (divide-y): 산출 근거 4줄 caption text-muted

2) 유지관리 이력 카드 (Card Flat):
   헤더: Wrench 아이콘 + "유지관리 이력" heading-md + 우측 "8건" caption
   리스트 (divide-y, 5건):
     - 작은 컬러 도트(accent) + "2018년" tabular | "옥상방수" body bold + 작은 배지 "방수" (accent bg) | 우측 "1.2억" tabular caption
     - 회색 도트 + "2020년" | "외벽 보수" body | "0.8억"
     - 회색 도트 + "2015년" | "도장" body | "—"
     - 회색 도트 + "2012년" | "엘리베이터 교체" body | "3.5억"
     - 회색 도트 + "2010년" | "단열 개선" body | "0.6억"

3) 충당금 추이 카드 (Card Flat):
   헤더: Wallet 아이콘 + "장기수선충당금 추이" heading-md + "12건" caption
   본문: 상단 큰 숫자 "3.2" display + "억원 (최근)" caption
   하단 막대 차트: 12개 막대 (primary 색), 호버 시 hover:bg-primary-hover, 마지막이 가장 높게
   막대 아래 양끝에 "2025-06" / "2026-05" caption muted

4) 입찰공고 카드 (Card Flat):
   헤더: Megaphone 아이콘 + "입찰공고" heading-md + "2건" caption
   리스트 2건:
     - "진행 중" label(accent) + "옥상방수 공사" body bold / "공고 2026-05-18 · 마감 2026-05-28 · 예가 1.8억" caption
     - "종료" label(text-muted) + "외벽 보수" body / "공고 2024-03-10 · 마감 2024-03-25 · 예가 0.5억" caption

이모지 없음. 모든 아이콘 lucide.
```

---

## 프롬프트 4 — 제안서 생성 + 미리보기

```
[프롬프트 0 시스템 컨텍스트 사용]

화면: /proposals/new — AI 제안서 생성

상단:
- "제안서 만들기" heading-lg + 서브 "단지 정보와 공사 범위를 입력하면 AI가 관리소장 맞춤 제안서를 작성합니다." body-sm

진행 단계 표시 (ol):
- Step 1 "정보 입력" (활성: 동그라미 bg-accent 안에 흰색 "1", 라벨 bold)
- 화살표 (text-faint)
- Step 2 "AI 생성"
- 화살표
- Step 3 "검토 / 저장 / PDF"

본문: 폼 3개 섹션 (각각 Card Flat):

[섹션 1] "1. 단지 정보" + 우측 "단지 검색" text link with Search 아이콘
  - 2열 그리드: 단지명* / 주소
  - 2열 그리드: 준공연도* (number) / 세대수* (number)
  - 2열 그리드: 마지막 방수공사 (연도) / 장기수선충당금 (억원)
  Input 컴포넌트: 작은 라벨 위 + Input 표준 + 필수 표시 별표 accent

[섹션 2] "2. 시공업체 정보"
  - 2열: 업체명* / 대표자*
  - 1열: 업력 (년)
  - 전문 공종 칩 선택: [옥상방수] [외벽방수] [지하방수] [우레탄] [시트방수] [실링/코킹]
    선택 시 bg-primary 흰색 텍스트, 비선택 시 흰색 + 보더

[섹션 3] "3. 공사 범위"
  - 2열: 공사 종류 select (옥상방수/외벽방수/지하방수/복합공사) / 공사 면적 (m²)
  - 1열: 예상 금액 (억원)
  - textarea: 비고

하단: Primary 버튼 큰 사이즈 (h-12 px-6) "AI 제안서 생성"
모바일에서는 sticky bottom bar.

생성 후 (별도 변형으로):
- 진행 단계 Step 2 활성 표시
- 로딩 카드: Loader2 spin + "AI가 제안서를 작성하고 있습니다. 보통 15~20초..."

완료 후 (별도 변형으로):
미리보기 카드 (Card Elevated):
- 액션 바: 좌측 Sparkles + "AI 생성 — 내용 검토 후 사용하세요" caption
           우측: [RefreshCw "다시 생성"] [Save "저장"] [Download "PDF 다운로드"] Primary
- 본문:
  - "방수 공사 제안서" label accent
  - 큰 제목 heading-lg "강남 래미안 1차 옥상방수 공사 제안서"
  - 메타: "대상: 강남 래미안 1차 · 제출: 한일방수 · 작성일: 2026-05-18" caption
  - 섹션 6개 (Block 컴포넌트: 라벨 + 본문 body):
    1. 핵심 요약 — 더미 2줄
    2. 노후도 진단 및 방수 필요성 — 더미 4줄
    3. 제안 공사 내용 — 더미 5줄
    4. {업체명}의 차별화 강점 — CheckCircle2 + 3개 항목 리스트
    5. 장기수선충당금 활용 방법 — 더미 3줄
    6. 하자보증 및 AS 정책 — blue-50 박스 안에 더미 2줄
  - 하단 CTA 박스 (accent 보더 + 옅은 accent 배경): "즉시 방수 진단 미팅을 잡아드리겠습니다." subtitle bold 가운데 정렬

이모지 없음. 아이콘 lucide.
```

---

## 프롬프트 5 — 로그인 / 회원가입

```
[프롬프트 0 시스템 컨텍스트 사용]

두 화면을 같은 아티팩트에 탭으로 나란히 보여주세요.

공통 레이아웃:
- 데스크탑 2열 grid (lg:grid-cols-2):
  좌측 — 브랜드 패널 (bg-sidebar 다크):
    상단: "발주Up" 워드마크 흰색 큰 사이즈
    중앙: heading-lg 흰색 2줄 "공고 올라오면 / 이미 늦습니다." 두 번째 줄 accent 색
    부제: body 라이트 흰색 "수도권 1.7만 단지의 발주 시점을 6개월 전에 예측하고..."
    하단: "© 2026 발주Up" caption 흰색 30%
  우측 — 폼 패널 (bg surface):
    중앙 정렬 max-w-md
- 모바일: 좌측 패널 숨김, 우측만 + 상단 로고

[로그인]
- "다시 오신 것을 환영합니다" heading-md
- "이메일과 비밀번호를 입력해 발주Up에 접속하세요." body-sm
- 폼:
  - 이메일 input (라벨 + 별표)
  - 비밀번호 input (라벨 + 별표 + 우측 "비밀번호 찾기" text link 작은 사이즈)
- Primary 버튼 full width "로그인"
- 하단 divider + "계정이 없으신가요? 얼리버드 가입하기" text link

[회원가입]
- "발주Up 시작하기" heading-md
- "7일 무료 체험 · 카드 등록 없이 바로 사용 가능합니다." body-sm
- 폼:
  - 이메일 input
  - 비밀번호 input (placeholder "8자 이상")
  - 2열 그리드: 사업체명 / 대표자명
  - 연락처 input (placeholder "010-1234-5678")
  - 관심 지역 (다중 선택, Chip Filter 8개): 서울 경기 인천 강원 충청 전라 경상 제주
- Primary 버튼 full width "무료 가입하기"
- 약관 동의 caption text-muted 가운데
- 하단 "이미 계정이 있으신가요? 로그인" link

이모지 없음.
```

---

## 프롬프트 6 — 모바일 온보딩 3장

```
[프롬프트 0 시스템 컨텍스트 사용 — 다만 알약 버튼 + 솔리드 컬러 화면 활용]

발주Up의 신규 가입 후 3페이지 온보딩 화면 (모바일 사이즈, 가로 3분할 그리드로 나란히):

공통: iPhone 프레임 (둥근 모서리 rounded-[40px], 상단 status bar 텍스트 "9:41 KST"),
도트 페이지네이션 하단 가운데 (활성 도트는 길고 진하게)

[페이지 1 — 솔리드 primary 배경, 흰색 콘텐츠]
- 중앙 상단: 큰 둥근 원 (size-32, bg-white) 안에 Building2 아이콘 (size-12, primary 색)
- "1.7만 단지를 매주 분석합니다" heading-lg 흰색 가운데
- "수도권 의무관리 아파트의 준공·이력·충당금을 매주 자동으로 갱신합니다." body 흰색 80% 가운데
- 도트 3개 (현재 1번째 활성)
- 하단 알약 버튼 흰색 bg + primary text: "다음"

[페이지 2 — 흰색 배경, primary 콘텐츠]
- 큰 픽토그램 카드 (rounded-2xl size-40, bg-primary-soft 안에 큰 점수 숫자 "92" display 사이즈) — accent 색
- "발주 6개월 전에 알려드립니다" heading-lg
- "예측 점수가 80점을 넘으면 즉시 알림. 경쟁사가 모르는 시점에 단독 접촉이 가능합니다." body
- 도트 3개 (2번째 활성)
- 하단 알약 버튼 primary bg + 흰색 text: "다음"

[페이지 3 — 솔리드 primary 배경, 흰색 콘텐츠]
- 중앙: Sparkles 아이콘 size-20 흰색 + 아래 작은 "AI" 라벨 흰색
- "AI 제안서를 30초에" heading-lg 흰색
- "단지 정보만 입력하면 관리소장 맞춤 제안서가 자동으로 작성됩니다. PDF 다운로드까지 한 번에." body 흰색 80%
- 도트 3개 (3번째 활성)
- 하단 두 버튼:
  - 알약 ghost (흰 보더, 흰 text, 투명 bg): "둘러보기"
  - 알약 흰색 bg + primary text: "시작하기"

이모지 없음.
```

---

## 사용 흐름 권장

1. claude.ai 새 대화 시작
2. 프롬프트 0 + 프롬프트 1 (대시보드) 함께 붙여넣기 → 첫 아티팩트 생성
3. 결과 검토 → 시각 토큰이 마음에 들면 "위 디자인을 그대로 유지하면서 [프롬프트 2]를 추가로 그려줘" 형태로 이어서 요청
4. 5~7개 화면을 같은 디자인 토큰으로 생성 → 본 코드 베이스에 점진 반영

## 반영 시 우선순위

1. 색 토큰 통일 (모든 `bg-[#0F4C8A]` → CSS 변수 또는 Tailwind theme 확장)
2. 이모지 8군데 제거 (위 표 참고)
3. 카드 그림자 4단계 도입 (Card Elevated 클래스 일관 적용)
4. 타이포 스케일 7단계 적용 (현재 ad-hoc text-xl 등을 시스템화)
5. 컴포넌트 8종 추출 (Button/Input/Card/Chip/Tab/Alert/Avatar/Skeleton)
