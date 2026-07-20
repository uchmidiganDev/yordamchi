"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { CalendarIcon, EditIcon, TrashIcon } from "@/components/ui/icons";
import {
  createTask,
  deleteTask,
  toggleOccurrence,
  toggleTaskStatus,
  updateTask,
} from "@/lib/actions/tasks";
import { formatDateShortUz, formatTimeUz } from "@/lib/format-date";
import { PageHeader } from "../page-header";
import listStyles from "../list.module.css";
import styles from "./tasks.module.css";

type Priority = "high" | "mid" | "low";
type Recurrence = "none" | "daily" | "weekly" | "monthly";

type Task = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: Priority;
  status: "active" | "done" | "pending";
  recurrence: Recurrence;
  todayDone: boolean;
  goalId: string | null;
  goalTitle: string | null;
};

type GoalOption = { id: string; title: string };

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "Yuqori",
  mid: "O'rta",
  low: "Past",
};

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Bir martalik",
  daily: "Har kuni",
  weekly: "Har hafta",
  monthly: "Har oy",
};

function formatDueAt(dueAt: string | null) {
  if (!dueAt) return "Muddatsiz";
  const d = new Date(dueAt);
  return `${formatDateShortUz(d)}, ${formatTimeUz(d)}`;
}

function toDatetimeLocal(dueAt: string | null) {
  if (!dueAt) return "";
  const d = new Date(dueAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function TaskForm({
  initial,
  goals,
  onCancel,
  onSubmit,
}: {
  initial?: Task;
  goals: GoalOption[];
  onCancel: () => void;
  onSubmit: (data: {
    title: string;
    goalId: string | null;
    dueAt: string;
    priority: Priority;
    recurrence: Recurrence;
  }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [goalId, setGoalId] = useState(initial?.goalId ?? "");
  const [dueAt, setDueAt] = useState(toDatetimeLocal(initial?.dueAt ?? null));
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "mid");
  const [recurrence, setRecurrence] = useState<Recurrence>(
    initial?.recurrence ?? "none"
  );
  const [err, setErr] = useState(false);

  function submit() {
    if (!title.trim()) {
      setErr(true);
      return;
    }
    onSubmit({ title, goalId: goalId || null, dueAt, priority, recurrence });
  }

  return (
    <>
      <Input
        label="Vazifa nomi *"
        placeholder="Masalan: 20 sahifa o'qish"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (err) setErr(false);
        }}
        error={err ? "Vazifa nomi kiritilishi shart" : undefined}
        autoFocus
      />
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Bog&apos;liq maqsad</label>
        <select
          className={styles.select}
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
        >
          <option value="">Maqsadsiz</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Muddat"
        type="datetime-local"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
      />
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Muhimlik</label>
        <Segmented
          options={[
            { value: "high", label: "Yuqori" },
            { value: "mid", label: "O'rta" },
            { value: "low", label: "Past" },
          ]}
          value={priority}
          onChange={setPriority}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Takrorlanish</label>
        <select
          className={styles.select}
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as Recurrence)}
        >
          <option value="none">Bir martalik</option>
          <option value="daily">Har kuni</option>
          <option value="weekly">Har hafta</option>
          <option value="monthly">Har oy</option>
        </select>
      </div>
      <div className={styles.sheetFoot}>
        <Button variant="secondary" onClick={onCancel}>
          Bekor qilish
        </Button>
        <Button variant="primary" onClick={submit}>
          Saqlash
        </Button>
      </div>
    </>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const recurring = task.recurrence !== "none";
  const done = recurring ? task.todayDone : task.status === "done";
  return (
    <Card padding="14px">
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.check} ${done ? styles.checkOn : ""}`}
          aria-label={done ? "Bajarilmagan deb belgilash" : "Bajarilgan deb belgilash"}
          onClick={() => onToggle(task)}
        >
          {done && (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className={styles.rowBody}>
          <p className={`${styles.title} ${done ? styles.titleDone : ""}`}>{task.title}</p>
          <div className={styles.meta}>
            <span className={`${styles.priority} ${styles[`p_${task.priority}`]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            {recurring ? (
              <span className={styles.recurTag}>{RECURRENCE_LABEL[task.recurrence]}</span>
            ) : (
              <span className={styles.metaDue}>
                <CalendarIcon />
                {formatDueAt(task.dueAt)}
              </span>
            )}
            {task.goalTitle && <span className={styles.goalTag}>{task.goalTitle}</span>}
          </div>
        </div>
        <div className={listStyles.cardActions}>
          <button className={listStyles.iconBtn} onClick={() => onEdit(task)} aria-label="Tahrirlash">
            <EditIcon />
          </button>
          <button
            className={`${listStyles.iconBtn} danger`}
            onClick={() => onDelete(task.id)}
            aria-label="O'chirish"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </Card>
  );
}

export function TasksClient({
  initialTasks,
  goals,
}: {
  initialTasks: Task[];
  goals: GoalOption[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [sheet, setSheet] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  const groups = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    // Takrorlanuvchi vazifalar alohida — ular har kuni ko'rinadi.
    const recurring = tasks.filter((t) => t.recurrence !== "none");
    const oneOff = tasks.filter((t) => t.recurrence === "none");

    const active = oneOff.filter((t) => t.status !== "done");
    const done = oneOff.filter((t) => t.status === "done");

    const overdue: Task[] = [];
    const today: Task[] = [];
    const upcoming: Task[] = [];
    const noDate: Task[] = [];

    for (const t of active) {
      if (!t.dueAt) {
        noDate.push(t);
        continue;
      }
      const d = new Date(t.dueAt);
      if (d.toDateString() === todayStr) today.push(t);
      else if (d < now) overdue.push(t);
      else upcoming.push(t);
    }

    return { recurring, overdue, today, upcoming, noDate, done };
  }, [tasks]);

  function openAdd() {
    setEditing(null);
    setSheet("add");
  }

  function openEdit(task: Task) {
    setEditing(task);
    setSheet("edit");
  }

  function closeSheet() {
    setSheet(null);
    setEditing(null);
  }

  function goalTitleFor(goalId: string | null) {
    return goals.find((g) => g.id === goalId)?.title ?? null;
  }

  function handleCreate(data: {
    title: string;
    goalId: string | null;
    dueAt: string;
    priority: Priority;
    recurrence: Recurrence;
  }) {
    const optimistic: Task = {
      id: `tmp-${Date.now()}`,
      title: data.title,
      dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : null,
      priority: data.priority,
      status: "pending",
      recurrence: data.recurrence,
      todayDone: false,
      goalId: data.goalId,
      goalTitle: goalTitleFor(data.goalId),
    };
    setTasks((ts) => [optimistic, ...ts]);
    closeSheet();
    startTransition(async () => {
      await createTask(data);
    });
  }

  function handleUpdate(
    id: string,
    data: {
      title: string;
      goalId: string | null;
      dueAt: string;
      priority: Priority;
      recurrence: Recurrence;
    }
  ) {
    setTasks((ts) =>
      ts.map((t) =>
        t.id === id
          ? {
              ...t,
              title: data.title,
              dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : null,
              priority: data.priority,
              recurrence: data.recurrence,
              goalId: data.goalId,
              goalTitle: goalTitleFor(data.goalId),
            }
          : t
      )
    );
    closeSheet();
    startTransition(async () => {
      await updateTask(id, data);
    });
  }

  function handleToggle(task: Task) {
    if (task.recurrence !== "none") {
      // Takrorlanuvchi vazifa: bugungi occurrence holatini almashtiramiz.
      const done = !task.todayDone;
      setTasks((ts) =>
        ts.map((t) => (t.id === task.id ? { ...t, todayDone: done } : t))
      );
      startTransition(async () => {
        await toggleOccurrence(task.id, done);
      });
      return;
    }
    const done = task.status !== "done";
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: done ? "done" : "pending" } : t)));
    startTransition(async () => {
      await toggleTaskStatus(task.id, done);
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Bu vazifani o'chirishga ishonchingiz komilmi?")) return;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    startTransition(async () => {
      await deleteTask(id);
    });
  }

  const sections: { label: string; items: Task[] }[] = [
    { label: "Takrorlanuvchi (bugun)", items: groups.recurring },
    { label: "Muddati o'tgan", items: groups.overdue },
    { label: "Bugun", items: groups.today },
    { label: "Keyingi", items: groups.upcoming },
    { label: "Muddatsiz", items: groups.noDate },
    { label: "Bajarilgan", items: groups.done },
  ].filter((s) => s.items.length > 0);

  return (
    <div>
      <PageHeader title="Vazifalar" subtitle="Kunlik vazifalaringizni boshqaring" />

      {tasks.length === 0 ? (
        <div className={listStyles.empty}>
          <h2>Hali vazifa yo&apos;q</h2>
          <p>Birinchi vazifangizni qo&apos;shish uchun pastdagi + tugmasini bosing.</p>
        </div>
      ) : (
        <div className={listStyles.wrap}>
          {sections.map((section) => (
            <div key={section.label} className={styles.section}>
              <div className={listStyles.rowHead}>
                <strong>{section.label}</strong>
                <span className={listStyles.rowHeadMuted}>{section.items.length} ta</span>
              </div>
              <div className={styles.sectionList}>
                {section.items.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onToggle={handleToggle}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className={listStyles.fab} aria-label="Yangi vazifa" onClick={openAdd}>
        +
      </button>

      {sheet === "add" && (
        <Sheet title="Yangi vazifa" onClose={closeSheet}>
          <TaskForm goals={goals} onCancel={closeSheet} onSubmit={handleCreate} />
        </Sheet>
      )}

      {sheet === "edit" && editing && (
        <Sheet title="Vazifani tahrirlash" onClose={closeSheet}>
          <TaskForm
            initial={editing}
            goals={goals}
            onCancel={closeSheet}
            onSubmit={(data) => handleUpdate(editing.id, data)}
          />
        </Sheet>
      )}
    </div>
  );
}
