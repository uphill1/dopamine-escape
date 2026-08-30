"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const APP_NAME = "컴백 차차";

const LOCK_SCREEN_TIME = "9:41";
const LOCK_SCREEN_DATE = "8월 29일 토요일";

type Status = "idle" | "loading" | "shown";

export function NudgeView() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const sendNudge = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/nudge", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "알림 문구 생성에 실패했습니다.");
      }
      setMessage(data.message);
      setStatus("shown");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "알림 문구 생성에 실패했습니다.");
      setStatus("idle");
    }
  };

  const dismiss = (toastMessage: string) => {
    setStatus("idle");
    toast.info(toastMessage);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <Button onClick={sendNudge} disabled={status === "loading"}>
        {status === "loading" ? "발송 중..." : "알림 발송"}
      </Button>

      {/* 휴대폰 목업 */}
      <div className="relative h-[540px] w-[280px] overflow-hidden rounded-[2.5rem] border-8 border-black bg-gradient-to-b from-slate-800 to-slate-950 shadow-2xl">
        <div className="absolute top-0 left-1/2 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-black" />

        <div className="flex h-full flex-col items-center gap-1 pt-20">
          <p className="font-heading text-5xl font-light tracking-tight text-white">
            {LOCK_SCREEN_TIME}
          </p>
          <p className="text-sm text-white/70">{LOCK_SCREEN_DATE}</p>
        </div>

        {status === "loading" && (
          <div className="absolute inset-x-4 top-32 flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-center text-xs text-white/80 backdrop-blur">
            gemini-3.5-flash-lite가 문구를 생성하는 중...
          </div>
        )}

        <AnimatePresence>
          {status === "shown" && (
            <motion.div
              key="notification"
              role="alert"
              aria-live="polite"
              className="absolute inset-x-3 top-14 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur dark:bg-neutral-900/95"
              initial={{ y: -120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -120, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
              <div className="flex items-center gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Sparkles className="size-3.5" />
                </div>
                <span className="text-xs font-medium text-foreground">{APP_NAME}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-foreground">{message}</p>
              <div className="mt-3 flex gap-1.5">
                <Link
                  href="/ritual"
                  className={cn(buttonVariants({ variant: "default", size: "xs" }), "flex-1")}
                >
                  지금 시작
                </Link>
                <Button
                  variant="outline"
                  size="xs"
                  className="flex-1"
                  onClick={() => dismiss("30분 뒤 다시 알려드릴게요.")}
                >
                  30분 뒤
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="flex-1"
                  onClick={() => dismiss("오늘은 건너뛸게요.")}
                >
                  오늘은 패스
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="max-w-sm text-center text-xs text-muted-foreground/70">
        실서비스에서는 웹푸시·카카오 알림톡으로 발송하며, 응답 로그를 학습해 개인별 최적 시간대에
        발송합니다.
      </p>
    </div>
  );
}
