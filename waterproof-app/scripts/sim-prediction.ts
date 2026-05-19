// 임시 검증 스크립트 — 새 예측 알고리즘의 변동성 확인
import { calcPredictionScore, type PredictionInput } from '../lib/prediction';

const samples: { name: string; input: PredictionInput }[] = [
  { name: '청계미소지움(2004,286)',         input: { builtYear: 2004, households: 286, buildings: 4, currentYear: 2026 } },
  { name: '자양현대홈타운8차(2001,1200)',   input: { builtYear: 2001, households: 1200, buildings: 8, currentYear: 2026 } },
  { name: '청계벽산(2013,600)',             input: { builtYear: 2013, households: 600, buildings: 5, currentYear: 2026 } },
  { name: '휘경현대(2009,800)',             input: { builtYear: 2009, households: 800, buildings: 6, currentYear: 2026 } },
  { name: '강남래미안1차(1998+WP2010+3.2억)', input: { builtYear: 1998, lastWaterproofYear: 2010, fundBalance: 320_000_000, households: 1500, buildings: 10, currentYear: 2026 } },
  { name: '신축(2021,400)',                 input: { builtYear: 2021, households: 400, buildings: 4, currentYear: 2026 } },
  { name: '재건축직전(1990,1800,12동)',     input: { builtYear: 1990, households: 1800, buildings: 12, currentYear: 2026 } },
  { name: '활성입찰(2003,700)',             input: { builtYear: 2003, households: 700, buildings: 6, activeBids: 1, currentYear: 2026 } },
  { name: '동점기A(2005,500)',              input: { builtYear: 2005, households: 500, buildings: 5, currentYear: 2026 } },
  { name: '동점기B(2005,600)',              input: { builtYear: 2005, households: 600, buildings: 6, currentYear: 2026 } },
];

for (const s of samples) {
  const r = calcPredictionScore(s.input);
  console.log(s.name.padEnd(40), '→', String(r.score).padStart(3), `(${r.tierLabel})`);
}
