// 용도별 멀티 벤더 LLM 라우팅. 단순 성능 티어가 아니라 각 용도에 맞는 벤더를 고른다.
export const MODELS = {
  PLAN: "claude-opus-5", // 계획 수립 / 야간 재계획
  DECOMPOSE: "gpt-5.5", // 태스크 마이크로 분해
  NUDGE: "gemini-3.5-flash-lite", // 알림 문구 생성
  PROGRAM_MATCH: "LGAI-EXAONE/K-EXAONE-2.0-750B-A37B", // 교내 비교과 매칭
} as const;

export const MODEL_RATIONALE: Record<keyof typeof MODELS, string> = {
  PLAN: "제약 조건이 많은 장기 스케줄링 추론에 최상위 모델 사용",
  DECOMPOSE: "정형 JSON 출력 작업으로 중간 티어면 충분",
  NUDGE: "하루 수십 회 호출되는 2문장 생성, 최경량 모델로 비용 최소화",
  PROGRAM_MATCH: "한국어 교내 공지 이해에 국산 특화 모델 활용",
};
