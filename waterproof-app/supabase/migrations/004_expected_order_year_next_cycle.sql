-- 004_expected_order_year_next_cycle.sql
--
-- 목적: complexes.expected_order_year 가 과거 연도(예: 2013, 2019)로 저장된
--       단지들을 "다음 사이클"로 일괄 보정. 17년 주기로 현재 연도 이상이
--       될 때까지 가산.
--
-- 배경: lib/prediction.ts 의 calcPredictionScore 는 (마지막 방수 연도 + 17) 을
--       expectedOrderYear 로 산출했었기 때문에, 첫 사이클이 이미 지나간 단지는
--       과거 연도가 그대로 저장됨. UI 측에는 nextOrderYearFromStored() 로 화면
--       보정을 추가했으나, DB 값 자체도 정리해 두면 향후 모든 호출자가 정상.
--
-- 안전성:
--   - 멱등(idempotent): 이미 미래 연도면 변화 없음.
--   - 17년 주기 가산만 수행 → 사이클 의미 보존.
--   - WHERE 절로 과거 행만 업데이트하므로 미래 행은 그대로.

DO $$
DECLARE
  v_current_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_cycle integer := 17;
  v_updated integer;
BEGIN
  UPDATE complexes
  SET expected_order_year =
    expected_order_year +
    CEIL((v_current_year - expected_order_year)::numeric / v_cycle)::integer * v_cycle
  WHERE expected_order_year IS NOT NULL
    AND expected_order_year < v_current_year;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '[004] expected_order_year normalized rows: %', v_updated;
END $$;
