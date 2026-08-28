import { NextResponse } from "next/server";
import { callLLM, DB_PURPOSE, type Purpose } from "@/lib/llm/client";
import { MODELS } from "@/lib/llm/models";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TEST_MESSAGE = "딱 한 문장으로 너 자신을 소개해줘.";

async function fetchLoggedRow(purpose: Purpose, model: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("model_calls")
    .select("*")
    .eq("purpose", DB_PURPOSE[purpose])
    .eq("model_name", model)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[llm-test] model_calls 조회 실패 (purpose=${purpose})`, error);
    return null;
  }
  return data;
}

async function testPurpose(purpose: Purpose) {
  const model = MODELS[purpose];
  try {
    const result = await callLLM({
      purpose,
      messages: [{ role: "user", content: TEST_MESSAGE }],
    });

    return {
      purpose,
      model,
      ok: true as const,
      responsePreview: result.content.slice(0, 200),
      credits: result.credits,
      latencyMs: result.latencyMs,
      // callLLM 내부에서 방금 기록한 model_calls 행을 그대로 다시 읽어와 증빙용으로 반환
      modelCallRow: await fetchLoggedRow(purpose, model),
    };
  } catch (err) {
    return {
      purpose,
      model,
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const purposes = Object.keys(MODELS) as Purpose[];
  const results = await Promise.all(purposes.map(testPurpose));

  return NextResponse.json({ results });
}
