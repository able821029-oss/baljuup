/**
 * dotenv 로더 — 스크립트 직접 실행(tsx) 시 .env.local 자동 로드
 *
 * 사용:
 *   import './_loadEnv';   // ← 다른 어떤 import 보다도 먼저!
 *
 * 왜 별도 파일인가:
 *   ESM 에서는 import 문 사이에 top-level statement 를 두면
 *   import 평가 순서가 hoisting 으로 꼬일 수 있다. 별도 모듈로 분리하면
 *   "이 모듈을 가장 먼저 import 한다 = 가장 먼저 평가된다" 가 보장됨.
 *
 * 우선순위: .env.local → .env (둘 다 있으면 .env.local 이 후속 호출에서 override)
 * Note: dotenv 기본 동작은 첫 호출에서 set 된 키를 두 번째 호출에서 덮어쓰지 않음.
 *       먼저 .env.local 호출 → 이후 .env 의 같은 키는 무시됨 (의도).
 */

import { config as loadDotenv } from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

for (const fname of ['.env.local', '.env']) {
  const p = path.resolve(__dirname, '..', fname);
  if (existsSync(p)) loadDotenv({ path: p });
}
