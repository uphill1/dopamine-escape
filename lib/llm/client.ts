import "server-only";

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELS } from "./models";

const gateway = new OpenAI({
  apiKey: process.env.CNU_API_KEY,
  baseURL: process.env.CNU_BASE_URL,
});

export type Purpose = keyof typeof MODELS;

// DB의 model_calls.purpose check 제약은 소문자 (plan/decompose/nudge/program_match).
export const DB_PURPOSE: Record<Purpose, string> = {
  PLAN: "plan",
  DECOMPOSE: "decompose",
  NUDGE: "nudge",
  PROGRAM_MATCH: "program_match",
};

// 추론이 필요한 용도(PLAN: 장기 스케줄링, DECOMPOSE: 태스크 분해)만 넉넉하게 16000.
// NUDGE/PROGRAM_MATCH는 짧은 문구/매칭 결과라 기본값을 낮게 잡는다.
const DEFAULT_MAX_TOKENS: Record<Purpose, number> = {
  PLAN: 16000,
  DECOMPOSE: 16000,
  NUDGE: 200,
  PROGRAM_MATCH: 2000,
};

export interface JsonSchemaSpec {
  /** a-z, A-Z, 0-9, _, - 만 허용, 64자 이내 */
  name: string;
  schema: Record<string, unknown>;
}

export interface CallLLMParams {
  purpose: Purpose;
  messages: ChatCompletionMessageParam[];
  /** 주어지면 response_format: json_schema (strict) 로 강제, 실패 시 1회 재시도 */
  schema?: JsonSchemaSpec;
  maxTokens?: number;
}

export interface CallLLMResult {
  content: string;
  /** schema를 준 경우에만 채워짐 */
  parsed: unknown;
  model: string;
  /** 게이트웨이 응답의 credits 필드, 실제 과금 단위 그대로 */
  credits: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export async function callLLM({
  purpose,
  messages,
  schema,
  maxTokens,
}: CallLLMParams): Promise<CallLLMResult> {
  const model = MODELS[purpose];

  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages,
    max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS[purpose],
    // temperature는 아예 안 보낸다: 일부 GPT-5 계열이 temperature=1 외 값을 거부한다.
  };

  if (schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: schema.name,
        strict: true,
        schema: { ...schema.schema, additionalProperties: false },
      },
    };
  }

  const started = Date.now();
  let response = await gateway.chat.completions.create(body);
  let latencyMs = Date.now() - started;
  let content = response.choices[0]?.message?.content ?? "";
  let parsed: unknown = null;

  if (schema) {
    try {
      parsed = JSON.parse(content);
    } catch {
      // 파싱 실패 시 동일 요청으로 딱 1회만 재시도
      const retryStarted = Date.now();
      response = await gateway.chat.completions.create(body);
      latencyMs = Date.now() - retryStarted;
      content = response.choices[0]?.message?.content ?? "";
      parsed = JSON.parse(content); // 여기서도 실패하면 그대로 throw
    }
  }

  const usage = response.usage;
  const inputTokens = usage?.prompt_tokens ?? null;
  const outputTokens = usage?.completion_tokens ?? null;
  // credits는 usage와 별개로 게이트웨이가 내려주는 실제 과금치 (usage와 달리 null이 아닌 게 보통이지만 방어적으로 처리)
  const credits =
    (response as unknown as { credits?: number | null }).credits ?? null;

  const result: CallLLMResult = {
    content,
    parsed,
    model,
    credits,
    inputTokens,
    outputTokens,
    latencyMs,
  };

  // 로깅 실패가 실제 응답을 막으면 안 되므로 예외를 여기서 완전히 격리한다.
  try {
    await logModelCall({ purpose, ...result });
  } catch (err) {
    console.error(`[callLLM] model_calls 기록 실패 (purpose=${purpose})`, err);
  }

  return result;
}

async function logModelCall(params: {
  purpose: Purpose;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  credits: number | null;
  latencyMs: number;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("model_calls").insert({
    purpose: DB_PURPOSE[params.purpose],
    model_name: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    credits: params.credits,
    latency_ms: params.latencyMs,
  });
  if (error) throw error;
}
