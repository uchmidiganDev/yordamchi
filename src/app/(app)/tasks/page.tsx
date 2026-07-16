import { listTasksWithGoal } from "@/lib/actions/tasks";
import { listGoals } from "@/lib/actions/goals";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  const [tasks, goals] = await Promise.all([listTasksWithGoal(), listGoals()]);

  return (
    <TasksClient
      initialTasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueAt: t.dueAt ? t.dueAt.toISOString() : null,
        priority: t.priority,
        status: t.status,
        goalId: t.goalId,
        goalTitle: t.goalTitle,
      }))}
      goals={goals.map((g) => ({ id: g.id, title: g.title }))}
    />
  );
}
