"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { StatusTag } from "@/components/ui/StatusTag";
import { EditIcon, TrashIcon } from "@/components/ui/icons";
import {
  createPersona,
  deletePersona,
  setActivePersona,
  setPhoneAiEnabled,
  updatePersona,
  type PersonaView,
} from "@/lib/actions/personas";
import { PageHeader } from "../page-header";
import listStyles from "../list.module.css";
import styles from "./telefon.module.css";

function StartStopCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await setPhoneAiEnabled(next);
    });
  }

  return (
    <Card padding="16px">
      <div className={styles.switchRow}>
        <div className={styles.rowBody}>
          <p className={styles.title}>Telefon AI</p>
          <p className={styles.hint}>
            Yoqilganda, javob bermagan qo&apos;ng&apos;iroqlaringizga faol
            persona avtomatik javob beradi. Telefoniya (Telnyx) ulanish
            jarayonida — hozircha faqat ulanish tekshiruvi ishlaydi, to&apos;liq
            suhbat tez orada qo&apos;shiladi.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? "Telefon AI'ni to'xtatish" : "Telefon AI'ni ishga tushirish"}
          className={`${styles.switch} ${enabled ? styles.switchOn : ""}`}
          onClick={toggle}
          disabled={isPending}
        >
          <span className={styles.switchThumb} />
        </button>
      </div>
    </Card>
  );
}

function PersonaForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: PersonaView;
  onCancel: () => void;
  onSubmit: (data: { name: string; systemPrompt: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "");
  const [err, setErr] = useState(false);

  function submit() {
    if (!name.trim() || !systemPrompt.trim()) {
      setErr(true);
      return;
    }
    onSubmit({ name, systemPrompt });
  }

  return (
    <>
      <Input
        label="Persona nomi *"
        placeholder="Masalan: Yusuf AI"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (err) setErr(false);
        }}
        error={err && !name.trim() ? "Ism kiritilishi shart" : undefined}
        autoFocus
      />
      <div className={styles.field}>
        <label className={styles.fieldLabel}>System Prompt *</label>
        <textarea
          className={styles.textarea}
          placeholder="Bu persona qanday gapirishi, o'zini qanday tanishtirishi kerakligini yozing..."
          value={systemPrompt}
          onChange={(e) => {
            setSystemPrompt(e.target.value);
            if (err) setErr(false);
          }}
          rows={8}
        />
        {err && !systemPrompt.trim() && (
          <p className={styles.errorText}>System Prompt kiritilishi shart</p>
        )}
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

function PersonaRow({
  persona,
  isActive,
  onActivate,
  onEdit,
  onDelete,
}: {
  persona: PersonaView;
  isActive: boolean;
  onActivate: (id: string) => void;
  onEdit: (persona: PersonaView) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card padding="14px">
      <div className={styles.row}>
        <div className={styles.rowBody}>
          <div className={styles.personaHead}>
            <p className={styles.title}>{persona.name}</p>
            {isActive && <StatusTag status="done">Faol</StatusTag>}
          </div>
          <p className={styles.preview}>{persona.systemPrompt}</p>
        </div>
        <div className={listStyles.cardActions}>
          {!isActive && (
            <Button variant="secondary" size="sm" onClick={() => onActivate(persona.id)}>
              Faol qilish
            </Button>
          )}
          <button className={listStyles.iconBtn} onClick={() => onEdit(persona)} aria-label="Tahrirlash">
            <EditIcon />
          </button>
          <button
            className={`${listStyles.iconBtn} danger`}
            onClick={() => onDelete(persona.id)}
            aria-label="O'chirish"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </Card>
  );
}

export function TelefonClient({
  initialPersonas,
  initialEnabled,
  initialActivePersonaId,
}: {
  initialPersonas: PersonaView[];
  initialEnabled: boolean;
  initialActivePersonaId: string | null;
}) {
  const [personas, setPersonas] = useState(initialPersonas);
  const [activeId, setActiveId] = useState(initialActivePersonaId);
  const [sheet, setSheet] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<PersonaView | null>(null);
  const [, startTransition] = useTransition();

  function openAdd() {
    setEditing(null);
    setSheet("add");
  }

  function openEdit(persona: PersonaView) {
    setEditing(persona);
    setSheet("edit");
  }

  function closeSheet() {
    setSheet(null);
    setEditing(null);
  }

  function handleCreate(data: { name: string; systemPrompt: string }) {
    const now = new Date().toISOString();
    const optimistic: PersonaView = { id: `tmp-${Date.now()}`, ...data, createdAtISO: now };
    setPersonas((ps) => [optimistic, ...ps]);
    closeSheet();
    startTransition(async () => {
      await createPersona(data);
    });
  }

  function handleUpdate(id: string, data: { name: string; systemPrompt: string }) {
    setPersonas((ps) => ps.map((p) => (p.id === id ? { ...p, ...data } : p)));
    closeSheet();
    startTransition(async () => {
      await updatePersona(id, data);
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Bu personani o'chirishga ishonchingiz komilmi?")) return;
    setPersonas((ps) => ps.filter((p) => p.id !== id));
    if (activeId === id) setActiveId(null);
    startTransition(async () => {
      await deletePersona(id);
    });
  }

  function handleActivate(id: string) {
    setActiveId(id);
    startTransition(async () => {
      await setActivePersona(id);
    });
  }

  return (
    <div>
      <PageHeader
        title="Telefon"
        subtitle="Qo'ng'iroqlarga AI javob berishi uchun shaxslar (personalar)"
      />

      <div className={styles.wrap}>
        <StartStopCard initialEnabled={initialEnabled} />

        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>AI shaxslar</h2>
          <Button variant="secondary" size="sm" onClick={openAdd}>
            + Persona qo&apos;shish
          </Button>
        </div>

        <div className={styles.personaList}>
          {personas.map((p) => (
            <PersonaRow
              key={p.id}
              persona={p}
              isActive={p.id === activeId}
              onActivate={handleActivate}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {sheet === "add" && (
        <Sheet title="Yangi persona" onClose={closeSheet}>
          <PersonaForm onCancel={closeSheet} onSubmit={handleCreate} />
        </Sheet>
      )}

      {sheet === "edit" && editing && (
        <Sheet title="Personani tahrirlash" onClose={closeSheet}>
          <PersonaForm
            initial={editing}
            onCancel={closeSheet}
            onSubmit={(data) => handleUpdate(editing.id, data)}
          />
        </Sheet>
      )}
    </div>
  );
}
