import { listGoals } from "@/lib/actions/goals";
import { GoalsClient } from "./goals-client";

export default async function GoalsPage() {
  const goals = await listGoals();

  return (
    <GoalsClient
      initialGoals={goals.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        dueDate: g.dueDate ? g.dueDate.toISOString() : null,
        progress: g.progress,
        status: g.status,
      }))}
    />
  );
}
