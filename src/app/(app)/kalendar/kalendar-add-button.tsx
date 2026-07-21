"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { createTask } from "@/lib/actions/tasks";
import listStyles from "../list.module.css";
import styles from "./kalendar.module.css";

export function KalendarAddButton({ dateStr }: { dateStr: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [err, setErr] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    setOpen(false);
    setTitle("");
    setTime("09:00");
    setErr(false);
  }

  function submit() {
    if (!title.trim()) {
      setErr(true);
      return;
    }
    startTransition(async () => {
      await createTask({
        title,
        dueAt: `${dateStr}T${time}`,
        priority: "mid",
        recurrence: "none",
      });
      router.refresh();
      close();
    });
  }

  return (
    <>
      <button className={listStyles.fab} aria-label="Yangi hodisa" onClick={() => setOpen(true)}>
        +
      </button>

      {open && (
        <Sheet title="Kalendarga qo'shish" onClose={close}>
          <Input
            label="Nomi *"
            placeholder="Masalan: Doktor bilan uchrashuv"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (err) setErr(false);
            }}
            error={err ? "Nomi kiritilishi shart" : undefined}
            autoFocus
          />
          <Input
            label="Vaqti"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <div className={styles.sheetFoot}>
            <Button variant="secondary" onClick={close}>
              Bekor qilish
            </Button>
            <Button variant="primary" onClick={submit} disabled={isPending}>
              {isPending ? "Saqlanmoqda…" : "Saqlash"}
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
