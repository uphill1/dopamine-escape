"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Task = {
  title: string;
  estMinutes: number;
};

// 실제 3분 호흡 사이클과 동일한 4:6 비율(팽창:수축)을 유지한다.
const INHALE_MS = 4000;
const EXHALE_MS = 6000;
const BREATH_CYCLE_SECONDS = (INHALE_MS + EXHALE_MS) / 1000;

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RitualView({
  task,
  fast,
  ctaHref,
}: {
  task: Task;
  fast: boolean;
  ctaHref: string;
}) {
  const durationSeconds = fast ? 10 : 180;

  const [stage, setStage] = useState<"breathing" | "revealing">("breathing");
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [breathPhase, setBreathPhase] = useState<"in" | "out">("in");

  const breathTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = () => {
    setStage((prev) => (prev === "breathing" ? "revealing" : prev));
  };

  // 카운트다운
  useEffect(() => {
    if (stage !== "breathing") return;
    if (secondsLeft <= 0) {
      reveal();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [stage, secondsLeft]);

  // 들이쉬기 / 내쉬기 텍스트 전환 (실제 시간 기준, 4초/6초 반복)
  useEffect(() => {
    if (stage !== "breathing") {
      if (breathTimeoutRef.current) clearTimeout(breathTimeoutRef.current);
      return;
    }

    let cancelled = false;

    const cycle = (phase: "in" | "out") => {
      setBreathPhase(phase);
      const delay = phase === "in" ? INHALE_MS : EXHALE_MS;
      breathTimeoutRef.current = setTimeout(() => {
        if (!cancelled) cycle(phase === "in" ? "out" : "in");
      }, delay);
    };

    cycle("in");

    return () => {
      cancelled = true;
      if (breathTimeoutRef.current) clearTimeout(breathTimeoutRef.current);
    };
  }, [stage]);

  const isRevealed = stage === "revealing";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-black"
      initial={{ filter: "grayscale(1)" }}
      animate={{ filter: isRevealed ? "grayscale(0)" : "grayscale(1)" }}
      transition={{ duration: 2, ease: "easeInOut" }}
    >
      {/* 호흡 원 */}
      <div className="flex flex-col items-center gap-6">
        <motion.div
          className="size-36 rounded-full bg-gradient-to-br from-sky-400 via-violet-400 to-fuchsia-500 shadow-[0_0_60px_20px_rgba(139,92,246,0.35)] sm:size-44"
          animate={
            stage === "breathing"
              ? { scale: [1, 1.3, 1] }
              : { scale: 1 }
          }
          transition={
            stage === "breathing"
              ? {
                  duration: BREATH_CYCLE_SECONDS,
                  times: [0, INHALE_MS / (INHALE_MS + EXHALE_MS), 1],
                  ease: "easeInOut",
                  repeat: Infinity,
                }
              : { duration: 0.6 }
          }
        />

        {stage === "breathing" && (
          <AnimatePresence mode="wait">
            <motion.p
              key={breathPhase}
              className="font-heading text-lg font-medium tracking-wide text-white/90"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5 }}
            >
              {breathPhase === "in" ? "들이쉬기" : "내쉬기"}
            </motion.p>
          </AnimatePresence>
        )}
      </div>

      {/* 카운트다운 */}
      {stage === "breathing" && (
        <p className="font-mono text-sm tabular-nums text-white/50">
          {formatTime(secondsLeft)}
        </p>
      )}

      {/* 오늘의 첫 태스크 카드 */}
      <motion.div
        className="w-full max-w-sm px-6"
        initial={{ opacity: 0, y: 16 }}
        animate={isRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 1, delay: isRevealed ? 1.1 : 0, ease: "easeOut" }}
        style={{ pointerEvents: isRevealed ? "auto" : "none" }}
      >
        <Card>
          <CardHeader>
            <CardDescription>오늘의 첫 태스크</CardDescription>
            <CardTitle className="font-heading text-xl">
              {task.title} · {task.estMinutes}분
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href={ctaHref} className={cn(buttonVariants({ variant: "default" }), "w-full")}>
              시작하기
            </Link>
            <p className="text-center text-[10px] text-muted-foreground/60">
              학습 세션 화면은 구현 예정 — 현재는 대시보드로 이동합니다
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* 건너뛰기 — 강제하지 않되 유도: 아주 작고 흐리게 */}
      {stage === "breathing" && (
        <Button
          variant="ghost"
          size="xs"
          className="absolute bottom-6 text-[11px] text-white/30 opacity-60 hover:bg-white/5 hover:text-white/60 hover:opacity-100"
          onClick={reveal}
        >
          건너뛰기
        </Button>
      )}
    </motion.div>
  );
}
