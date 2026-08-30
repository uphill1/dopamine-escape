import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";

// Pretendard는 Google Fonts에 없어 공식 배포 CDN에서 가변 폰트를 받아 로컬로 서빙한다
// (public/fonts/PretendardVariable.woff2). 별도 npm 패키지 추가 없음.
const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  variable: "--font-sans",
  weight: "45 920",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "컴백 차차",
  description: "계획이 밀려도, 다시 시작하게 — 컴백 차차",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 사이드바용 목표 목록 — 이 파일은 모든 페이지를 감싸므로 Supabase 미설정/오류 시에도
  // 전체 서비스가 죽지 않도록 빈 배열로 폴백한다.
  let goals: { id: string; title: string; target_date: string }[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("goals")
      .select("id, title, target_date")
      .order("created_at", { ascending: false });
    goals = data ?? [];
  } catch {
    // no-op — 사이드바는 빈 목록으로 렌더링됨
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          <div className="flex flex-1">
            {/* AppSidebar가 useSearchParams를 쓰므로 Suspense 필요 (Next 15 App Router 규칙) */}
            <Suspense fallback={null}>
              <AppSidebar goals={goals} today={today} />
            </Suspense>
            <div className="flex flex-1 flex-col">{children}</div>
          </div>
          <SiteFooter />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
