"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusTag } from "@/components/ui/StatusTag";
import { Sheet } from "@/components/ui/Sheet";
import { CalendarIcon, EditIcon, TrashIcon } from "@/components/ui/icons";
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

export function GoalsClient({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [sheet, setSheet] = useState<"add" | "edit" | null>(null);
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
    </div>
  );
}
