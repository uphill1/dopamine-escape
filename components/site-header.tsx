"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

// 새 화면이 추가되면 이 배열에 한 줄만 추가하면 헤더 네비게이션에 자동 반영됨.
// 예: 프로그램 매칭 화면 추가 시 → { href: "/programs", label: "프로그램 매칭" }
const NAV_LINKS = [
  { href: "/", label: "홈" },
  { href: "/onboarding", label: "목표 만들기" },
  { href: "/dashboard", label: "대시보드" },
  { href: "/replan", label: "재계획" },
  { href: "/ritual", label: "3분 디톡스" },
  { href: "/nudge", label: "알림" },
];

// /ritual은 호흡 유도 + 컬러 리빌로 이어지는 몰입 화면이라 헤더를 아예 숨긴다.
const HEADER_HIDDEN_PATHS = ["/ritual"];

export function SiteHeader() {
  const pathname = usePathname();

  if (HEADER_HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6 sm:px-8">
        <Link href="/" className="font-heading text-base font-bold tracking-tight">
          컴백 차차
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <ModeToggle />
      </div>
    </header>
  );
}
