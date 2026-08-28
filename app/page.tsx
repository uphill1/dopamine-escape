import Link from "next/link";
import { ArrowRight, Bell, LayoutDashboard, RefreshCw, Wind } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SCREENS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "대시보드",
    description: "학습 루프가 실제로 도는지 데이터로 확인해요.",
  },
  {
    href: "/replan",
    icon: RefreshCw,
    title: "재계획",
    description: "밀린 계획을 남은 기간에 맞춰 다시 짜드려요.",
  },
  {
    href: "/ritual",
    icon: Wind,
    title: "리추얼",
    description: "3분 호흡으로 시작 마찰을 낮추고 바로 몰입해요.",
  },
  {
    href: "/nudge",
    icon: Bell,
    title: "알림",
    description: "지금 3분만 — 실행을 트리거하는 알림을 체험해요.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-6 py-16 sm:px-8">
      <div className="max-w-2xl">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          알림 하나로 시작하는, 끊기지 않는 학습 루프
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          계획이 밀려도 다시 짜고, 알림이 실행을 트리거하고, 데이터가 그 효과를 증명합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCREENS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href} className="group block h-full">
            <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-primary/[0.03]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={cn("flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary")}>
                    <Icon className="size-4.5" />
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <CardTitle className="font-heading text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
