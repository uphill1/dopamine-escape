"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MODELS } from "@/lib/llm/models";
import { cn } from "@/lib/utils";

const EXAMPLE_CHIPS = [
  "토익 800점 10월 12일까지",
  "정보처리기사 필기 다음 달 시험",
  "오픽 IH 12월까지",
];

// 실제 흐름: opus(PLAN)가 14일 계획을 만든 뒤(15~20초) gpt-5.5(DECOMPOSE)가 첫날만
// 마이크로 분해한다(app/api/plan/route.ts) — 순차 호출이라 opus가 끝나야 gpt-5.5가
// 시작된다. 그래서 1→2단계는 짧게, 2→3단계는 opus 완료 시점에 맞춰 12초 이상 길게 잡는다.
// 마지막 4단계("계획을 정리하는 중")는 API 응답이 올 때까지 그대로 유지한다 — 고정 타이머로
// 넘겨버리면 응답을 기다리는 동안 빈 화면처럼 보인다.
// model이 있는 단계는 모델명을 문장과 분리해 렌더링 — 데모 영상에서 20초간 노출되는
// 구간이라 모델명이 눈에 띄게 읽혀야 한다.
const LOADING_STAGES: { label: string; model?: string }[] = [
  { label: "목표를 이해하는 중" },
  { label: "가 D-day를 역산하는 중", model: MODELS.PLAN },
  { label: "가 오늘 할 일을 쪼개는 중", model: MODELS.DECOMPOSE },
  { label: "계획을 정리하는 중" },
];
// 각 단계로 넘어가기까지의 지연(직전 단계로부터의 상대 시간). 0→1: 짧게,
// 1→2: opus가 실제로 끝나는 시점(15~20초)에 맞춰 12초 이상, 2→3: gpt-5.5는
// maxTokens를 낮게 잡아 빠르게 끝나므로 다시 짧게.
const STAGE_DELAYS_MS = [2000, 14000, 4000];

export function OnboardingView() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [stage, setStage] = useState(0);

  async function handleSubmit() {
    const rawInput = value.trim();
    if (!rawInput) {
      toast.error("목표를 입력해주세요.");
      return;
    }

    setStatus("loading");
    setStage(0);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let elapsedMs = 0;
    STAGE_DELAYS_MS.forEach((delay, i) => {
      elapsedMs += delay;
      timeouts.push(setTimeout(() => setStage(i + 1), elapsedMs));
    });

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "계획 생성에 실패했습니다.");
      }
      try {
        sessionStorage.setItem(`plan-comment:${data.goalId}`, data.summaryComment);
      } catch {
        // sessionStorage 접근 불가 시 /plan에서 기본 문구로 대체됨
      }
      router.push(`/plan?goalId=${data.goalId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "계획 생성에 실패했습니다.");
      setStatus("idle");
    } finally {
      timeouts.forEach(clearTimeout);
    }
  }

  if (status === "loading") {
    return (
      <Card className="w-full [--card-spacing:--spacing(5)]">
        <CardContent className="flex flex-col gap-3.5 pt-4">
          {/* 마스코트 차차 — 진행 표시 위에 작게, 은은한 bounce만 */}
          <motion.div
            className="mx-auto"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image
              src="/mascot/chacha-joy.png"
              alt="즐거워하는 차차"
              width={293}
              height={320}
              className="h-[60px] w-auto"
              priority
            />
          </motion.div>
          {LOADING_STAGES.map((s, i) => {
            const state = i < stage ? "done" : i === stage ? "active" : "pending";
            return (
              <motion.div
                key={i}
                className="flex items-center gap-3"
                animate={{ opacity: state === "pending" ? 0.4 : 1 }}
                transition={{ duration: 0.3 }}
              >
                <motion.span
                  key={state}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="flex size-6 shrink-0 items-center justify-center"
                >
                  {state === "done" && <Check className="size-4.5 text-primary" />}
                  {state === "active" && <Loader2 className="size-4.5 animate-spin text-primary" />}
                  {state === "pending" && <Circle className="size-2 fill-muted-foreground/40 text-muted-foreground/40" />}
                </motion.span>
                <span
                  className={cn(
                    "transition-colors duration-300",
                    state === "active" && "text-base font-semibold text-primary",
                    state !== "active" && "text-sm text-muted-foreground",
                  )}
                >
                  {s.model && (
                    <span
                      className={cn(
                        "mr-1 font-mono",
                        state === "active" ? "text-primary" : "text-foreground/70",
                      )}
                    >
                      {s.model}
                    </span>
                  )}
                  {s.label}
                  {state === "active" && "..."}
                </span>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="예: 토익 800점 10월까지 준비하고 싶어"
          className="h-14 text-base sm:text-lg"
        />
        <Button size="lg" className="h-14 shrink-0" onClick={handleSubmit}>
          계획 만들기
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_CHIPS.map((chip) => (
          <Button key={chip} variant="outline" size="sm" onClick={() => setValue(chip)}>
            {chip}
          </Button>
        ))}
      </div>
    </div>
  );
}
