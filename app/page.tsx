import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Bell, LayoutDashboard, RefreshCw, Wind } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OnboardingView } from "@/app/onboarding/onboarding-view";

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
    title: "3분 디톡스",
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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
        <div>
          {/* 마스코트 차차 — 인사, 히어로 장식용으로 작게 */}
          <Image
            src="/mascot/chacha-hello.png"
            alt="인사하는 차차"
            width={382}
            height={420}
            className="mx-auto mb-2 h-24 w-auto sm:h-32"
            priority
          />
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            계획이 밀려도, 다시 시작하게
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            목표를 적으면 우선 2주 계획부터 짜드려요.
            <br />
            밀리면 다시 짜고, 알림이 실행을 트리거합니다.
          </p>
        </div>
        <OnboardingView />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">이런 것도 있어요</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SCREENS.map(({ href, icon: Icon, title, description }) => (
            <Link key={href} href={href} className="group block h-full">
              <Card
                size="sm"
                className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:bg-primary/[0.03] group-hover:shadow-md"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className={cn("flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary")}>
                      <Icon className="size-3.5" />
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription className="text-xs">{description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
