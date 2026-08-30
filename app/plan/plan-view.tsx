"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export type DayPlan = {
  date: string;
  plannedMinutes: number;
  tasks: { title: string; estMinutes: number }[];
};

// /onboarding이 sessionStorage에 남겨둔 코멘트가 없을 때(직접 접속/새로고침 등)
// 빈 화면 대신 보여줄 기본 문구.
const DEFAULT_COMMENT = "계획이 준비됐어요. 오늘부터 천천히 시작해봐요.";

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function PlanView({
  goalId,
  days,
  remainingDaysToTarget,
}: {
  goalId: string;
  days: DayPlan[];
  remainingDaysToTarget: number;
}) {
  const [comment, setComment] = useState(DEFAULT_COMMENT);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`plan-comment:${goalId}`);
      if (stored) setComment(stored);
    } catch {
      // 접근 불가 시 기본 문구 유지
    }
  }, [goalId]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        D-{remainingDaysToTarget} · 우선 2주 상세 계획부터 시작해요.
        <br />
        2주 뒤 실제 진행을 반영해 다음 구간을 다시 짭니다.
      </p>

      <Card className="bg-primary [--card-spacing:--spacing(5)]">
        <CardContent className="flex items-center gap-3 pt-4">
          <Image
            src="/mascot/chacha-welcome.png"
            alt="환영하는 차차"
            width={357}
            height={420}
            className="h-20 w-auto shrink-0 sm:h-24"
          />
          <p className="text-sm font-medium text-primary-foreground">{comment}</p>
        </CardContent>
      </Card>

      <motion.div
        className="flex flex-col gap-2"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05 } },
        }}
      >
        {days.map((day) => (
          <motion.div
            key={day.date}
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0 },
            }}
          >
            <Card size="sm">
              <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
                <span className="w-12 shrink-0 font-medium">{formatDate(day.date)}</span>
                <span className="text-xs text-muted-foreground">{day.plannedMinutes}분</span>
                <span className="flex-1 basis-full text-xs text-muted-foreground sm:basis-auto">
                  {day.tasks.map((t) => t.title).join(" · ")}
                </span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
