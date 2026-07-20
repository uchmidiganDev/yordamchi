"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusTag } from "@/components/ui/StatusTag";
import { Sheet } from "@/components/ui/Sheet";
import { AiIcon, CalendarIcon, EditIcon, TrashIcon } from "@/components/ui/icons";
import {
  addGoalTasks,
  suggestGoalTasks,
  type SuggestedTask,
} from "@/lib/actions/ai";
import { createGoal, deleteGoal, updateGoal } from "@/lib/actions/goals";
import { formatDateUz } from "@/lib/format-date";
import { PageHeader } from "./page-header";
import listStyles from "./list.module.css";
import styles from "./goals.module.css";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  progress: number;
  status: "active" | "done";
};

function formatDue(dueDate: string | null) {
  if (!dueDate) return "Muddat belgilanmagan";
  return formatDateUz(new Date(dueDate));
}

function GoalForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Goal;
  onCancel: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    dueDate: string;
    progress: number;
    status: "active" | "done";
  }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ? initial.dueDate.slice(0, 10) : ""
  );
  const [progress, setProgress] = useState(initial?.progress ?? 0);
  const [status, setStatus] = useState<"active" | "done">(initial?.status ?? "active");
  const [err, setErr] = useState(false);

  function submit() {
    if (!title.trim()) {
      setErr(true);
      return;
    }
    onSubmit({ title, description, dueDate, progress, status });
  }

  return (
    <>
      <Input
        label="Sarlavha *"
        placeholder="Masalan: Kitob o'qish"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (err) setErr(false);
        }}
        error={err ? "Sarlavha kiritilishi shart" : undefined}
        autoFocus
      />
      <Input
        label="Qisqa tavsif"
        placeholder="Maqsad haqida qisqacha"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        label="Muddat"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      {initial && (
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              Progress <span className={styles.fieldVal}>{progress}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className={styles.range}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Holat</label>
            <div className={styles.seg}>
              <button
                type="button"
                className={`${styles.segBtn} ${status === "active" ? styles.segOn : ""}`}
                onClick={() => setStatus("active")}
              >
                Faol
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${status === "done" ? styles.segOn : ""}`}
                onClick={() => setStatus("done")}
              >
                Bajarilgan
              </button>
            </div>
          </div>
        </>
      )}
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

const PRIORITY_LABEL: Record<SuggestedTask["priority"], string> = {
  high: "Yuqori",
  mid: "O'rta",
  low: "Past",
};

// "AI bilan bo'lish" (F): maqsadni Gemini kichik vazifalarga ajratadi,
// foydalanuvchi keraklilarini belgilab tasdiqlaydi.
function AiSplitSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "saving">(
    "loading"
  );
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedTask[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    suggestGoalTasks(goal.id).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setSuggestions(res.data);
        setSelected(new Set(res.data.map((_, i) => i)));
        setPhase("ready");
      } else {
        setError(res.error);
        setPhase("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [goal.id]);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function handleAdd() {
    const items = suggestions.filter((_, i) => selected.has(i));
    if (items.length === 0) return;
    setPhase("saving");
    startTransition(async () => {
      const res = await addGoalTasks(goal.id, items);
      if (res.ok) {
        onClose();
      } else {
        setError(res.error);
        setPhase("error");
      }
    });
  }

  return (
    <Sheet title="AI bilan bo'lish" subtitle={goal.title} onClose={onClose}>
      {phase === "loading" && (
        <p className={styles.suggestState}>
          AI maqsadni vazifalarga ajratmoqda…
        </p>
      )}

      {phase === "error" && <p className={styles.suggestError}>{error}</p>}

      {(phase === "ready" || phase === "saving") && (
        <>
          <p className={styles.suggestHint}>
            AI taklif qilgan vazifalardan keraklilarini belgilang — ular
            maqsadga bog&apos;langan holda qo&apos;shiladi.
          </p>
          <div className={styles.suggestList}>
            {suggestions.map((s, i) => {
              const on = selected.has(i);
              return (
                <label
                  key={i}
                  className={`${styles.suggestRow} ${on ? styles.suggestRowOn : ""}`}
                >
                  <input
                    type="checkbox"
                    className={styles.suggestCheck}
                    checked={on}
                    onChange={() => toggle(i)}
                  />
                  <span className={styles.suggestTitle}>{s.title}</span>
                  <span className={styles.suggestPrio}>
                    {PRIORITY_LABEL[s.priority]}
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}

      <div className={styles.sheetFoot}>
        <Button variant="secondary" onClick={onClose}>
          Bekor qilish
        </Button>
        {(phase === "ready" || phase === "saving") && (
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={phase === "saving" || selected.size === 0}
          >
            {phase === "saving"
              ? "Qo'shilmoqda…"
              : `${selected.size} ta vazifa qo'shish`}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

export function GoalsClient({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [sheet, setSheet] = useState<"add" | "edit" | "ai" | null>(null);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [, startTransition] = useTransition();

  const activeCount = goals.filter((g) => g.status !== "done").length;

  function openAdd() {
    setEditing(null);
    setSheet("add");
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setSheet("edit");
  }

  function openAiSplit(goal: Goal) {
    setEditing(goal);
    setSheet("ai");
  }

  function closeSheet() {
    setSheet(null);
    setEditing(null);
  }

  function handleCreate(data: {
    title: string;
    description: string;
    dueDate: string;
  }) {
    const optimistic: Goal = {
      id: `tmp-${Date.now()}`,
      title: data.title,
      description: data.description || null,
      dueDate: data.dueDate || null,
      progress: 0,
      status: "active",
    };
    setGoals((gs) => [optimistic, ...gs]);
    closeSheet();
    startTransition(async () => {
      await createGoal(data);
    });
  }

  function handleUpdate(
    id: string,
    data: {
      title: string;
      description: string;
      dueDate: string;
      progress: number;
      status: "active" | "done";
    }
  ) {
    setGoals((gs) =>
      gs.map((g) =>
        g.id === id
          ? {
              ...g,
              title: data.title,
              description: data.description || null,
              dueDate: data.dueDate || null,
              progress: data.progress,
              status: data.status,
            }
          : g
      )
    );
    closeSheet();
    startTransition(async () => {
      await updateGoal(id, data);
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Bu maqsadni o'chirishga ishonchingiz komilmi?")) return;
    setGoals((gs) => gs.filter((g) => g.id !== id));
    startTransition(async () => {
      await deleteGoal(id);
    });
  }

  return (
    <div>
      <PageHeader title="Maqsadlarim" subtitle="Maqsadlaringizni kuzatib boring" />

      {goals.length === 0 ? (
        <div className={listStyles.empty}>
          <h2>Hali maqsad yo&apos;q</h2>
          <p>Birinchi maqsadingizni qo&apos;shish uchun pastdagi + tugmasini bosing.</p>
        </div>
      ) : (
        <div className={listStyles.wrap}>
          <div className={listStyles.rowHead}>
            <strong>{activeCount} ta faol</strong>
            <span className={listStyles.rowHeadMuted}>
              {goals.length - activeCount} ta bajarilgan
            </span>
          </div>

          {goals.map((g) => {
            const done = g.status === "done";
            return (
              <Card key={g.id} padding="16px">
                <div className={styles.top}>
                  <div style={{ minWidth: 0 }}>
                    <h3 className={styles.title}>{g.title}</h3>
                    {g.description && <p className={styles.desc}>{g.description}</p>}
                  </div>
                  <StatusTag status={done ? "done" : "pending"} className={styles.statusTag}>
                    {done ? "Bajarilgan" : "Faol"}
                  </StatusTag>
                </div>
                <div className={styles.meta}>
                  <CalendarIcon />
                  <span>Muddat: {formatDue(g.dueDate)}</span>
                </div>
                <div className={styles.progressRow}>
                  <ProgressBar value={g.progress} tone={done ? "done" : "primary"} />
                  <span className={styles.pct}>{g.progress}%</span>
                </div>
                <div className={listStyles.cardActions} style={{ marginTop: 12 }}>
                  {!done && (
                    <button
                      className={styles.aiBtn}
                      onClick={() => openAiSplit(g)}
                      title="Maqsadni AI yordamida kichik vazifalarga ajratish"
                    >
                      <AiIcon width={14} height={14} />
                      AI bilan bo&apos;lish
                    </button>
                  )}
                  <button className={listStyles.iconBtn} onClick={() => openEdit(g)} aria-label="Tahrirlash">
                    <EditIcon />
                  </button>
                  <button
                    className={`${listStyles.iconBtn} danger`}
                    onClick={() => handleDelete(g.id)}
                    aria-label="O'chirish"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <button className={listStyles.fab} aria-label="Yangi maqsad" onClick={openAdd}>
        +
      </button>

      {sheet === "add" && (
        <Sheet title="Yangi maqsad" onClose={closeSheet}>
          <GoalForm onCancel={closeSheet} onSubmit={handleCreate} />
        </Sheet>
      )}

      {sheet === "edit" && editing && (
        <Sheet title="Maqsadni tahrirlash" onClose={closeSheet}>
          <GoalForm
            initial={editing}
            onCancel={closeSheet}
            onSubmit={(data) => handleUpdate(editing.id, data)}
          />
        </Sheet>
      )}

      {sheet === "ai" && editing && (
        <AiSplitSheet goal={editing} onClose={closeSheet} />
      )}
    </div>
  );
}
