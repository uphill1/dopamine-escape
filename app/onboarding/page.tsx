import { OnboardingView } from "./onboarding-view";

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6 sm:p-8">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          목표를 말해보세요
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          자연어로 편하게 적으면 14일 계획으로 바꿔드려요.
        </p>
      </div>
      <OnboardingView />
    </div>
  );
}
