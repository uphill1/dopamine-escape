"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MODELS } from "@/lib/llm/models";

const EXAMPLE_CHIPS = [
  "토익 800점 10월 12일까지",
  "정보처리기사 필기 다음 달 시험",
  "오픽 IH 12월까지",
];

// 1·2단계는 타이머로 넘기지만 3단계("계획을 정리하는 중")는 API 응답이 올 때까지
// 그대로 유지한다 — claude-opus-5 호출이 20초 안팎 걸려서 고정 타이머로 3단계를
// 다 넘기면 응답을 기다리는 동안 빈 화면처럼 보인다.
const LOADING_STAGES = [
  "목표를 이해하는 중",
  `${MODELS.PLAN}가 D-day를 역산하는 중`,
  "계획을 정리하는 중",
];
const STAGE_INTERVAL_MS = 3500;

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
    const t1 = setTimeout(() => setStage(1), STAGE_INTERVAL_MS);
    const t2 = setTimeout(() => setStage(2), STAGE_INTERVAL_MS * 2);

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
      clearTimeout(t1);
      clearTimeout(t2);
    }
  }

  if (status === "loading") {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center gap-3 pt-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" />
          <AnimatePresence mode="wait">
            <motion.span
              key={stage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {LOADING_STAGES[stage]}...
            </motion.span>
          </AnimatePresence>
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
