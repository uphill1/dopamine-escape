import { ModeToggle } from "@/components/mode-toggle";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function Home() {
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_SUPABASE_URL");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="absolute right-4 top-4">
        <ModeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>dopamine-escape</CardTitle>
          <CardDescription>
            Next.js 15 · TypeScript · Tailwind · shadcn/ui · Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            초기 세팅이 완료되었습니다. 다크모드가 기본값으로 적용되어
            있습니다.
          </p>
          <p>
            Supabase 연결 상태:{" "}
            <span
              className={
                supabaseConfigured
                  ? "font-medium text-green-500"
                  : "font-medium text-amber-500"
              }
            >
              {supabaseConfigured
                ? "환경변수 설정됨"
                : "미설정 (.env.local 확인 필요)"}
            </span>
          </p>
          <a
            href="https://supabase.com/dashboard/project/_/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}
          >
            Supabase API 키 발급받기
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
