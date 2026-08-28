"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function GoalSelect({
  goals,
  selectedGoalId,
}: {
  goals: { id: string; title: string }[];
  selectedGoalId: string;
}) {
  const router = useRouter();
  const titleById = new Map(goals.map((g) => [g.id, g.title]));

  return (
    <Select
      value={selectedGoalId}
      onValueChange={(value) => router.push(`/replan?goal=${value}`)}
    >
      <SelectTrigger className="w-56">
        {/* SelectValue는 기본값으로 선택된 value(UUID)를 그대로 렌더링하므로,
            title로 매핑해서 보여주는 함수를 children으로 넘겨준다. */}
        <SelectValue placeholder="목표 선택">
          {(value: string) => titleById.get(value) ?? "목표 선택"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {goals.map((g) => (
          <SelectItem key={g.id} value={g.id}>
            {g.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
