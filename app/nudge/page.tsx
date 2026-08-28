import { NudgeView } from "./nudge-view";

export default function NudgePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          알림 시뮬레이션
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          알림이 실행의 트리거가 되는 흐름을 확인해보세요.
        </p>
      </div>
      <NudgeView />
    </main>
  );
}
