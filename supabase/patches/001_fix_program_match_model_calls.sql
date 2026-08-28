-- 원인: seed.sql에서 program_match model_calls INSERT가 programs INSERT보다 먼저 실행돼서
-- "select ... from programs"가 빈 테이블을 읽어 0건이 삽입됐음 (seed.sql은 이미 순서를 고쳐뒀음).
-- 이미 programs 10건은 정상 적재된 상태이므로, 이 블록만 단독으로 다시 실행하면 된다.
-- 재실행해도 안전하도록 기존 program_match 행을 먼저 지우고 다시 채운다.

delete from model_calls where purpose = 'program_match';

insert into model_calls (purpose, model_name, input_tokens, output_tokens, credits, latency_ms, created_at)
select
  'program_match',
  'LGAI-EXAONE/K-EXAONE-2.0-750B-A37B',
  2200 + (rn * 53) % 1300,
  120 + (rn * 17) % 130,
  round((0.018 + (rn % 5) * 0.0035)::numeric, 4),
  1400 + (rn * 41) % 900,
  timestamptz '2026-08-28 07:00:00+09' + (rn * interval '4 minutes')
from (
  select id, row_number() over (order by title) as rn
  from programs
) p;
