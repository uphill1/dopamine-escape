-- dopamine-escape: demo seed data
-- 무작위(random()) 대신 전부 결정론적인 값/식으로 채워서, 재실행해도 항상 같은 그림이 나온다.
-- 스토리: 초반 4일 순항 -> 3일 연속 슬럼프(missed) -> 재계획(replanned_count 1) -> 회복.
-- 재실행 가능하도록 관련 테이블을 먼저 비운다 (FK 관계상 이 순서로 지정하면 CASCADE 없이도 안전).
truncate table model_calls, sessions, nudges, tasks, plan_days, goals, programs;

do $$
declare
  v_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_goal_toeic uuid;
  v_goal_jsis uuid;
begin

  -- ============================================================
  -- goals: 토익 800점(D-45), 정보처리기사(D-30)  (오늘 = 2026-08-28)
  -- ============================================================
  insert into goals (id, user_id, title, target_date, category, created_at)
  values (gen_random_uuid(), v_user_id, '토익 800점 달성', date '2026-10-12', 'language', timestamptz '2026-08-15 09:00:00+09')
  returning id into v_goal_toeic;

  insert into goals (id, user_id, title, target_date, category, created_at)
  values (gen_random_uuid(), v_user_id, '정보처리기사 필기 합격', date '2026-09-27', 'cert', timestamptz '2026-08-15 09:00:00+09')
  returning id into v_goal_jsis;

  -- ============================================================
  -- plan_days: 최근 14일 (2026-08-15 ~ 2026-08-28, 오늘 포함) x 2 goals
  -- 1~4일차 done / 5~7일차 missed(슬럼프 3연속) / 8일차부터 재계획(replanned_count=1)+done(회복) / 14일차(오늘) pending
  -- ============================================================
  insert into plan_days (goal_id, date, planned_minutes, status, replanned_count)
  values
    (v_goal_toeic, date '2026-08-15', 60, 'done', 0),
    (v_goal_toeic, date '2026-08-16', 60, 'done', 0),
    (v_goal_toeic, date '2026-08-17', 90, 'done', 0),
    (v_goal_toeic, date '2026-08-18', 60, 'done', 0),
    (v_goal_toeic, date '2026-08-19', 60, 'missed', 0),
    (v_goal_toeic, date '2026-08-20', 60, 'missed', 0),
    (v_goal_toeic, date '2026-08-21', 90, 'missed', 0),
    (v_goal_toeic, date '2026-08-22', 45, 'done', 1),
    (v_goal_toeic, date '2026-08-23', 60, 'done', 1),
    (v_goal_toeic, date '2026-08-24', 60, 'done', 1),
    (v_goal_toeic, date '2026-08-25', 60, 'done', 1),
    (v_goal_toeic, date '2026-08-26', 75, 'done', 1),
    (v_goal_toeic, date '2026-08-27', 60, 'done', 1),
    (v_goal_toeic, date '2026-08-28', 60, 'pending', 1),

    (v_goal_jsis, date '2026-08-15', 90, 'done', 0),
    (v_goal_jsis, date '2026-08-16', 90, 'done', 0),
    (v_goal_jsis, date '2026-08-17', 60, 'done', 0),
    (v_goal_jsis, date '2026-08-18', 90, 'done', 0),
    (v_goal_jsis, date '2026-08-19', 90, 'missed', 0),
    (v_goal_jsis, date '2026-08-20', 60, 'missed', 0),
    (v_goal_jsis, date '2026-08-21', 90, 'missed', 0),
    (v_goal_jsis, date '2026-08-22', 60, 'done', 1),
    (v_goal_jsis, date '2026-08-23', 90, 'done', 1),
    (v_goal_jsis, date '2026-08-24', 90, 'done', 1),
    (v_goal_jsis, date '2026-08-25', 60, 'done', 1),
    (v_goal_jsis, date '2026-08-26', 90, 'done', 1),
    (v_goal_jsis, date '2026-08-27', 90, 'done', 1),
    (v_goal_jsis, date '2026-08-28', 90, 'pending', 1);

  -- ============================================================
  -- tasks: plan_day 당 3개, 3~15분짜리 마이크로 태스크. 상태는 plan_day 상태를 따른다.
  -- (goal_key, date, title, est_minutes) 를 plan_days/goals와 조인해서 채운다.
  -- ============================================================
  insert into tasks (plan_day_id, title, est_minutes, status, completed_at)
  select
    pd.id,
    v.title,
    v.est_minutes,
    case pd.status when 'done' then 'done' when 'missed' then 'missed' else 'pending' end,
    case when pd.status = 'done'
      then ((pd.date + time '21:00') + (v.est_minutes::text || ' minutes')::interval) at time zone 'Asia/Seoul'
      else null
    end
  from (
    values
      -- 토익: T0=파트5 5문항(5분) T1=리스닝파트2 10문제(10분) T2=단어30개암기(8분) T3=파트7지문1개(12분)
      ('toeic', date '2026-08-15', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-15', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-15', '단어 30개 암기', 8),
      ('toeic', date '2026-08-16', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-16', '단어 30개 암기', 8),
      ('toeic', date '2026-08-16', '파트7 지문 1개 풀이', 12),
      ('toeic', date '2026-08-17', '단어 30개 암기', 8),
      ('toeic', date '2026-08-17', '파트7 지문 1개 풀이', 12),
      ('toeic', date '2026-08-17', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-18', '파트7 지문 1개 풀이', 12),
      ('toeic', date '2026-08-18', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-18', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-19', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-19', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-19', '단어 30개 암기', 8),
      ('toeic', date '2026-08-20', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-20', '단어 30개 암기', 8),
      ('toeic', date '2026-08-20', '파트7 지문 1개 풀이', 12),
      ('toeic', date '2026-08-21', '단어 30개 암기', 8),
      ('toeic', date '2026-08-21', '파트7 지문 1개 풀이', 12),
      ('toeic', date '2026-08-21', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-22', '파트7 지문 1개 풀이', 12),
      ('toeic', date '2026-08-22', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-22', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-23', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-23', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-23', '단어 30개 암기', 8),
      ('toeic', date '2026-08-24', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-24', '단어 30개 암기', 8),
      ('toeic', date '2026-08-24', '파트7 지문 1개 풀이', 12),
      ('toeic', date '2026-08-25', '단어 30개 암기', 8),
      ('toeic', date '2026-08-25', '파트7 지문 1개 풀이', 12),
      ('toeic', date '2026-08-25', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-26', '파트7 지문 1개 풀이', 12),
      ('toeic', date '2026-08-26', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-26', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-27', '토익 파트5 문법 5문항', 5),
      ('toeic', date '2026-08-27', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-27', '단어 30개 암기', 8),
      ('toeic', date '2026-08-28', '리스닝 파트2 10문제', 10),
      ('toeic', date '2026-08-28', '단어 30개 암기', 8),
      ('toeic', date '2026-08-28', '파트7 지문 1개 풀이', 12),

      -- 정보처리기사: J0=기출문제10문항(15분) J1=SQL챕터요약(10분) J2=오답노트정리(8분) J3=네트워크개념복습(12분)
      ('jsis', date '2026-08-15', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-15', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-15', '오답노트 정리', 8),
      ('jsis', date '2026-08-16', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-16', '오답노트 정리', 8),
      ('jsis', date '2026-08-16', '네트워크 개념 복습', 12),
      ('jsis', date '2026-08-17', '오답노트 정리', 8),
      ('jsis', date '2026-08-17', '네트워크 개념 복습', 12),
      ('jsis', date '2026-08-17', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-18', '네트워크 개념 복습', 12),
      ('jsis', date '2026-08-18', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-18', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-19', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-19', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-19', '오답노트 정리', 8),
      ('jsis', date '2026-08-20', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-20', '오답노트 정리', 8),
      ('jsis', date '2026-08-20', '네트워크 개념 복습', 12),
      ('jsis', date '2026-08-21', '오답노트 정리', 8),
      ('jsis', date '2026-08-21', '네트워크 개념 복습', 12),
      ('jsis', date '2026-08-21', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-22', '네트워크 개념 복습', 12),
      ('jsis', date '2026-08-22', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-22', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-23', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-23', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-23', '오답노트 정리', 8),
      ('jsis', date '2026-08-24', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-24', '오답노트 정리', 8),
      ('jsis', date '2026-08-24', '네트워크 개념 복습', 12),
      ('jsis', date '2026-08-25', '오답노트 정리', 8),
      ('jsis', date '2026-08-25', '네트워크 개념 복습', 12),
      ('jsis', date '2026-08-25', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-26', '네트워크 개념 복습', 12),
      ('jsis', date '2026-08-26', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-26', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-27', '기출문제 10문항 풀이', 15),
      ('jsis', date '2026-08-27', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-27', '오답노트 정리', 8),
      ('jsis', date '2026-08-28', 'SQL 챕터 요약 정리', 10),
      ('jsis', date '2026-08-28', '오답노트 정리', 8),
      ('jsis', date '2026-08-28', '네트워크 개념 복습', 12)
  ) as v(goal_key, date, title, est_minutes)
  join plan_days pd
    on pd.date = v.date
   and pd.goal_id = case v.goal_key when 'toeic' then v_goal_toeic else v_goal_jsis end;

  -- ============================================================
  -- nudges: ~64건. 아침(9~11시)/밤(9~11시) 슬롯은 응답률 높게, 오후(2~4시) 슬롯은 낮게.
  -- 응답 여부/종류는 행 번호 기반 모듈로 규칙으로 결정 (random() 미사용, 재실행해도 동일).
  -- ============================================================
  insert into nudges (user_id, task_id, sent_at, channel, message, responded_at, response)
  select
    v_user_id,
    t.id,
    v.sent_at,
    'push',
    case v.slot
      when 'morning' then '아침 루틴 시간이에요. "' || v.task_title || '" 지금 시작해볼까요?'
      when 'afternoon' then '오후에도 잊지 마세요 — "' || v.task_title || '" 어때요?'
      else '오늘 마무리로 "' || v.task_title || '" 딱 한 번만 더!'
    end,
    case when v.response is not null then v.sent_at + v.resp_offset else null end,
    v.response
  from (
    values
      -- 아침(토익, 09:15/10:40 교대)
      ('toeic', date '2026-08-15', '토익 파트5 문법 5문항', 'morning', timestamptz '2026-08-15 09:15:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-16', '리스닝 파트2 10문제', 'morning', timestamptz '2026-08-16 10:40:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-17', '단어 30개 암기', 'morning', timestamptz '2026-08-17 09:15:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-18', '파트7 지문 1개 풀이', 'morning', timestamptz '2026-08-18 10:40:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-19', '토익 파트5 문법 5문항', 'morning', timestamptz '2026-08-19 09:15:00+09', null::text, null::interval),
      ('toeic', date '2026-08-20', '리스닝 파트2 10문제', 'morning', timestamptz '2026-08-20 10:40:00+09', 'snooze', interval '8 minutes'),
      ('toeic', date '2026-08-21', '단어 30개 암기', 'morning', timestamptz '2026-08-21 09:15:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-22', '파트7 지문 1개 풀이', 'morning', timestamptz '2026-08-22 10:40:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-23', '토익 파트5 문법 5문항', 'morning', timestamptz '2026-08-23 09:15:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-24', '리스닝 파트2 10문제', 'morning', timestamptz '2026-08-24 10:40:00+09', null::text, null::interval),
      ('toeic', date '2026-08-25', '단어 30개 암기', 'morning', timestamptz '2026-08-25 09:15:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-26', '파트7 지문 1개 풀이', 'morning', timestamptz '2026-08-26 10:40:00+09', 'snooze', interval '8 minutes'),
      ('toeic', date '2026-08-27', '토익 파트5 문법 5문항', 'morning', timestamptz '2026-08-27 09:15:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-28', '리스닝 파트2 10문제', 'morning', timestamptz '2026-08-28 10:40:00+09', 'start', interval '3 minutes'),

      -- 아침(정보처리기사)
      ('jsis', date '2026-08-15', '기출문제 10문항 풀이', 'morning', timestamptz '2026-08-15 09:15:00+09', null::text, null::interval),
      ('jsis', date '2026-08-16', 'SQL 챕터 요약 정리', 'morning', timestamptz '2026-08-16 10:40:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-17', '오답노트 정리', 'morning', timestamptz '2026-08-17 09:15:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-18', '네트워크 개념 복습', 'morning', timestamptz '2026-08-18 10:40:00+09', 'snooze', interval '8 minutes'),
      ('jsis', date '2026-08-19', '기출문제 10문항 풀이', 'morning', timestamptz '2026-08-19 09:15:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-20', 'SQL 챕터 요약 정리', 'morning', timestamptz '2026-08-20 10:40:00+09', null::text, null::interval),
      ('jsis', date '2026-08-21', '오답노트 정리', 'morning', timestamptz '2026-08-21 09:15:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-22', '네트워크 개념 복습', 'morning', timestamptz '2026-08-22 10:40:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-23', '기출문제 10문항 풀이', 'morning', timestamptz '2026-08-23 09:15:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-24', 'SQL 챕터 요약 정리', 'morning', timestamptz '2026-08-24 10:40:00+09', 'snooze', interval '8 minutes'),
      ('jsis', date '2026-08-25', '오답노트 정리', 'morning', timestamptz '2026-08-25 09:15:00+09', null::text, null::interval),
      ('jsis', date '2026-08-26', '네트워크 개념 복습', 'morning', timestamptz '2026-08-26 10:40:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-27', '기출문제 10문항 풀이', 'morning', timestamptz '2026-08-27 09:15:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-28', 'SQL 챕터 요약 정리', 'morning', timestamptz '2026-08-28 10:40:00+09', 'start', interval '3 minutes'),

      -- 밤(토익, 21:10/22:20 교대)
      ('toeic', date '2026-08-15', '리스닝 파트2 10문제', 'night', timestamptz '2026-08-15 21:10:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-16', '단어 30개 암기', 'night', timestamptz '2026-08-16 22:20:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-17', '파트7 지문 1개 풀이', 'night', timestamptz '2026-08-17 21:10:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-18', '토익 파트5 문법 5문항', 'night', timestamptz '2026-08-18 22:20:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-19', '리스닝 파트2 10문제', 'night', timestamptz '2026-08-19 21:10:00+09', null::text, null::interval),
      ('toeic', date '2026-08-20', '단어 30개 암기', 'night', timestamptz '2026-08-20 22:20:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-21', '파트7 지문 1개 풀이', 'night', timestamptz '2026-08-21 21:10:00+09', 'snooze', interval '8 minutes'),
      ('toeic', date '2026-08-22', '토익 파트5 문법 5문항', 'night', timestamptz '2026-08-22 22:20:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-23', '리스닝 파트2 10문제', 'night', timestamptz '2026-08-23 21:10:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-24', '단어 30개 암기', 'night', timestamptz '2026-08-24 22:20:00+09', null::text, null::interval),
      ('toeic', date '2026-08-25', '파트7 지문 1개 풀이', 'night', timestamptz '2026-08-25 21:10:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-26', '토익 파트5 문법 5문항', 'night', timestamptz '2026-08-26 22:20:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-27', '리스닝 파트2 10문제', 'night', timestamptz '2026-08-27 21:10:00+09', 'start', interval '3 minutes'),
      ('toeic', date '2026-08-28', '단어 30개 암기', 'night', timestamptz '2026-08-28 22:20:00+09', 'snooze', interval '8 minutes'),

      -- 밤(정보처리기사)
      ('jsis', date '2026-08-15', 'SQL 챕터 요약 정리', 'night', timestamptz '2026-08-15 21:10:00+09', null::text, null::interval),
      ('jsis', date '2026-08-16', '오답노트 정리', 'night', timestamptz '2026-08-16 22:20:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-17', '네트워크 개념 복습', 'night', timestamptz '2026-08-17 21:10:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-18', '기출문제 10문항 풀이', 'night', timestamptz '2026-08-18 22:20:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-19', 'SQL 챕터 요약 정리', 'night', timestamptz '2026-08-19 21:10:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-20', '오답노트 정리', 'night', timestamptz '2026-08-20 22:20:00+09', null::text, null::interval),
      ('jsis', date '2026-08-21', '네트워크 개념 복습', 'night', timestamptz '2026-08-21 21:10:00+09', 'snooze', interval '8 minutes'),
      ('jsis', date '2026-08-22', '기출문제 10문항 풀이', 'night', timestamptz '2026-08-22 22:20:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-23', 'SQL 챕터 요약 정리', 'night', timestamptz '2026-08-23 21:10:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-24', '오답노트 정리', 'night', timestamptz '2026-08-24 22:20:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-25', '네트워크 개념 복습', 'night', timestamptz '2026-08-25 21:10:00+09', null::text, null::interval),
      ('jsis', date '2026-08-26', '기출문제 10문항 풀이', 'night', timestamptz '2026-08-26 22:20:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-27', 'SQL 챕터 요약 정리', 'night', timestamptz '2026-08-27 21:10:00+09', 'start', interval '3 minutes'),
      ('jsis', date '2026-08-28', '오답노트 정리', 'night', timestamptz '2026-08-28 22:20:00+09', 'snooze', interval '8 minutes'),

      -- 오후(2~4시, 응답률 낮음): 3/6/9/12일차에만 발송
      ('toeic', date '2026-08-17', '토익 파트5 문법 5문항', 'afternoon', timestamptz '2026-08-17 14:20:00+09', null::text, null::interval),
      ('toeic', date '2026-08-20', '파트7 지문 1개 풀이', 'afternoon', timestamptz '2026-08-20 15:40:00+09', null::text, null::interval),
      ('toeic', date '2026-08-23', '단어 30개 암기', 'afternoon', timestamptz '2026-08-23 14:20:00+09', null::text, null::interval),
      ('toeic', date '2026-08-26', '리스닝 파트2 10문제', 'afternoon', timestamptz '2026-08-26 15:40:00+09', 'ignore', interval '1 minute'),
      ('jsis', date '2026-08-17', '기출문제 10문항 풀이', 'afternoon', timestamptz '2026-08-17 14:20:00+09', null::text, null::interval),
      ('jsis', date '2026-08-20', '네트워크 개념 복습', 'afternoon', timestamptz '2026-08-20 15:40:00+09', null::text, null::interval),
      ('jsis', date '2026-08-23', '오답노트 정리', 'afternoon', timestamptz '2026-08-23 14:20:00+09', null::text, null::interval),
      ('jsis', date '2026-08-26', 'SQL 챕터 요약 정리', 'afternoon', timestamptz '2026-08-26 15:40:00+09', 'start', interval '3 minutes')
  ) as v(goal_key, date, task_title, slot, sent_at, response, resp_offset)
  join plan_days pd
    on pd.date = v.date
   and pd.goal_id = case v.goal_key when 'toeic' then v_goal_toeic else v_goal_jsis end
  join tasks t
    on t.plan_day_id = pd.id
   and t.title = v.task_title;

  -- ============================================================
  -- sessions: response='start'인 nudge에만 1:1 연결.
  -- missed 날은 리추얼만 시작하고 학습은 미완료(abandoned), pending(오늘)은 진행 중, done 날은 완주.
  -- ============================================================
  insert into sessions (user_id, task_id, ritual_started_at, ritual_completed, study_started_at, study_ended_at, focus_minutes)
  select
    v_user_id,
    n.task_id,
    n.responded_at,
    case when pd.status = 'missed' then false else true end,
    case when pd.status = 'missed' then null else n.responded_at + interval '2 minutes' end,
    case when pd.status = 'done' then n.responded_at + interval '2 minutes' + (t.est_minutes::text || ' minutes')::interval else null end,
    case when pd.status = 'done' then t.est_minutes else null end
  from nudges n
  join tasks t on t.id = n.task_id
  join plan_days pd on pd.id = t.plan_day_id
  where n.response = 'start';

  -- ============================================================
  -- programs: 교내 어학/취업 비교과 10건
  -- (model_calls의 program_match가 이 테이블을 참조하므로 그 전에 채워야 한다)
  -- ============================================================
  insert into programs (title, category, deadline, url, summary)
  values
    ('토익 스피킹 집중반', '어학', date '2026-09-10', 'https://cnu.ac.kr/lang/toeic-speaking', '2주 완성 토익스피킹 레벨업 프로그램, 새벽반/저녁반 운영'),
    ('오픽(OPIc) 스터디 그룹', '어학', date '2026-09-15', 'https://cnu.ac.kr/lang/opic-study', '주 2회 소그룹 스터디로 IH 이상을 목표로 하는 자율 스터디'),
    ('정보처리기사 실기 대비반', '자격증', date '2026-09-05', 'https://cnu.ac.kr/cert/jsis-practical', '실기 출제 유형별 특강 및 모의고사 4회 제공'),
    ('자소서 첨삭 클리닉', '취업', date '2026-09-20', 'https://cnu.ac.kr/career/resume-clinic', '1:1 자기소개서 첨삭 및 직무별 작성 가이드 제공'),
    ('모의면접 프로그램', '취업', date '2026-09-25', 'https://cnu.ac.kr/career/mock-interview', '실전형 모의면접 진행 및 피드백 리포트 제공'),
    ('컴퓨터활용능력 1급 단기반', '자격증', date '2026-09-12', 'https://cnu.ac.kr/cert/itq-1', '2주 단기 완성반, 필기와 실기를 동시에 대비'),
    ('토익스피킹 성적 인증 캠프', '어학', date '2026-10-01', 'https://cnu.ac.kr/lang/ts-camp', '해외 교환학생 지원용 스피킹 성적 단기 인증 캠프'),
    ('빅데이터분석기사 스터디', '자격증', date '2026-10-05', 'https://cnu.ac.kr/cert/bigdata-study', '실무 데이터 분석 프로젝트 기반 자격증 대비 스터디'),
    ('직무적성검사(NCS) 대비반', '취업', date '2026-09-18', 'https://cnu.ac.kr/career/ncs-prep', '대기업 인적성 기출 유형 풀이 및 시간관리 훈련'),
    ('이력서·링크드인 브랜딩 워크숍', '취업', date '2026-09-30', 'https://cnu.ac.kr/career/resume-branding', '이력서 및 링크드인 프로필 개선을 돕는 실습 워크숍');

  -- ============================================================
  -- model_calls (용도별 멀티 벤더 라우팅, lib/llm/models.ts의 MODELS와 동일한 문자열)
  -- 크레딧 규모는 자릿수 단위로 벌어지게: plan(~1e-1) > program_match(~1e-2) > decompose(~1e-3~1e-2) > nudge(~1e-3~1e-4)
  -- purpose='plan': 소수·최고비용 (목표 생성 2건 + 재계획 1건), MODELS.PLAN
  -- ============================================================
  insert into model_calls (purpose, model_name, input_tokens, output_tokens, credits, latency_ms, created_at)
  values
    ('plan', 'claude-opus-5', 4200, 1100, 0.12, 3200, timestamptz '2026-08-15 08:55:00+09'),
    ('plan', 'claude-opus-5', 3800, 950, 0.10, 2800, timestamptz '2026-08-15 08:58:00+09'),
    ('plan', 'claude-opus-5', 5600, 1400, 0.15, 3800, timestamptz '2026-08-22 07:30:00+09');

  -- purpose='program_match': programs 10건당 1건, MODELS.PROGRAM_MATCH (국산 대형 MoE, 호출은 드묾)
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

  -- purpose='decompose': plan_day 하루당 1건 (28건), MODELS.DECOMPOSE, 각 날짜 06:30 발생
  insert into model_calls (purpose, model_name, input_tokens, output_tokens, credits, latency_ms, created_at)
  select
    'decompose',
    'gpt-5.5',
    900 + (rn * 37) % 500,
    200 + (rn * 13) % 150,
    round((0.004 + (rn % 4) * 0.0015)::numeric, 4),
    650 + (rn * 29) % 450,
    (pd_date + time '06:30:00') at time zone 'Asia/Seoul'
  from (
    select pd.date as pd_date, row_number() over (order by pd.goal_id, pd.date) as rn
    from plan_days pd
  ) s;

  -- purpose='nudge': 발송된 nudge 건당 1건 (nudges 건수와 동일, 64건), MODELS.NUDGE, 최저비용·최다건수
  insert into model_calls (purpose, model_name, input_tokens, output_tokens, credits, latency_ms, created_at)
  select
    'nudge',
    'gemini-3.5-flash-lite',
    150 + (rn * 7) % 120,
    40 + (rn * 5) % 50,
    round((0.0008 + (rn % 3) * 0.0006)::numeric, 5),
    200 + (rn * 11) % 300,
    n.sent_at - interval '30 seconds'
  from (
    select id, sent_at, row_number() over (order by sent_at) as rn
    from nudges
  ) n;

end $$;

-- ============================================================
-- 확인용 쿼리 예시 (SQL Editor에서 그대로 실행해보면 됨)
-- ============================================================
-- 1) 재계획 효과: 상태별 일수 추이
-- select goal_id, date, status, replanned_count from plan_days order by goal_id, date;
--
-- 2) 시간대별 넛지 응답률
-- select
--   case when extract(hour from sent_at) < 13 then 'morning'
--        when extract(hour from sent_at) < 18 then 'afternoon'
--        else 'night' end as slot,
--   count(*) filter (where response is not null)::float / count(*) as response_rate,
--   count(*) as total
-- from nudges group by 1 order by 1;
--
-- 3) 모델 호출 비용 구조 (purpose별 건수/평균 비용)
-- select purpose, model_name, count(*), avg(credits), avg(latency_ms) from model_calls group by 1, 2 order by 1;
