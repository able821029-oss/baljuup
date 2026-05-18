# 사전 모집 랜딩 페이지 (별도 배포)

광고 트래픽 분리 측정을 위해 메인 앱(`baljuup.vercel.app`)과 분리된 Vercel 프로젝트로 배포합니다.

## 파일 구조

```
landing/
├── index.html       사전 모집 LP (landing_v2_사전모집.html 의 사본)
├── vercel.json      보안 헤더 + cleanUrls 설정
└── README.md        이 문서
```

> 루트의 `landing_v2_사전모집.html` 은 원본 작업본입니다. 변경 후 `cp landing_v2_사전모집.html landing/index.html` 로 동기화하거나, 이 폴더의 `index.html` 만 직접 편집해도 됩니다.

## Vercel 별도 프로젝트 생성 절차

1. Vercel 대시보드 → **Add New → Project**
2. 같은 GitHub 레포(`able821029-oss/baljuup`) 선택 → **Import**
3. **Configure Project** 에서:
   - **Project Name**: `baljuup-welcome` (또는 원하는 이름)
   - **Framework Preset**: `Other`
   - **Root Directory**: `landing` ← 중요
   - **Build Command**: 비워둠
   - **Output Directory**: 비워둠 (기본 = root)
   - **Install Command**: 비워둠
4. **Deploy** 클릭

배포 후 도메인 예: `baljuup-welcome.vercel.app`

## 커스텀 도메인 (선택)

브랜드 통일을 원하면 `welcome.baljuup.com` 같은 서브도메인 연결:

1. Vercel 프로젝트 → **Settings → Domains**
2. `welcome.baljuup.com` 입력 → DNS 안내대로 CNAME 추가

## GA / Meta Pixel 분리 측정 권장

- 메인 앱과 **다른** GA4 속성 ID / Meta Pixel ID 사용
- UTM 파라미터로 광고 소스 구분: `?utm_source=meta&utm_campaign=pre_30`
- 전환 정의: 폼 제출 성공 시 GAS 응답 후 `gtag('event', 'sign_up_lead')` 발화

## TODO (배포 후 작업)

- [ ] Google Apps Script 배포 → URL 받아 `index.html` line ~917 `GAS_ENDPOINT` 교체
- [ ] OG 이미지 (`og:image`) 추가
- [ ] favicon 추가
- [ ] (선택) GA4 / Meta Pixel 스니펫 삽입
