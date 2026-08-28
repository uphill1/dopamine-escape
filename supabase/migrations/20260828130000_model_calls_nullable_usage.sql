-- CNU 멀티LLM 게이트웨이 응답의 usage 필드가 null로 올 수 있어
-- input_tokens/output_tokens를 NOT NULL로 강제할 수 없다. nullable로 완화한다.
-- 실측 결과 credits 필드도 게이트웨이 응답(body/헤더 어디에도)에 실려오지 않는 경우가 있어 함께 nullable로 완화한다.
-- (latency_ms는 우리 쪽에서 직접 측정하는 값이라 항상 채워지므로 NOT NULL 유지)
alter table model_calls alter column input_tokens drop not null;
alter table model_calls alter column output_tokens drop not null;
alter table model_calls alter column credits drop not null;
