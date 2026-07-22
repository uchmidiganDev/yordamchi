"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { EditIcon, TrashIcon } from "@/components/ui/icons";
import {
  createCodeKnowledgeEntry,
  deleteCodeKnowledgeEntry,
  updateCodeKnowledgeEntry,
  type CodeKnowledgeEntryView,
} from "@/lib/actions/code-knowledge";
import { updateCodeAssistantSystemPrompt } from "@/lib/actions/code-assistant-settings";
import { PageHeader } from "../page-header";
import listStyles from "../list.module.css";
import styles from "./kod-yordamchi.module.css";

function SystemPromptCard({ initialPrompt }: { initialPrompt: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      await updateCodeAssistantSystemPrompt(prompt);
      setSaved(true);
    });
  }

  return (
    <Card padding="16px">
      <h2 className={styles.sectionTitle}>Qo&apos;shimcha ko&apos;rsatma</h2>
      <p className={styles.hint}>
        Kod yordamchisi har bir tahlil/fix/optimize so&apos;rovida shu ko&apos;rsatmani
        (masalan, loyihangizdagi code style yoki tilni tanlash qoidalari) hisobga oladi.
        Bo&apos;sh qoldirilsa, faqat standart yo&apos;riqnoma ishlatiladi.
      </p>
      <textarea
        className={styles.textarea}
        placeholder="Masalan: Har doim javobni o'zbek tilida yoz. Python kodida type hint ishlatishni talab qil."
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setSaved(false);
        }}
        rows={5}
      />
      <div className={styles.saveRow}>
        {saved && <span className={styles.savedHint}>Saqlandi</span>}
        <Button variant="primary" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
      </div>
    </Card>
  );
}

function EntryForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: CodeKnowledgeEntryView;
  onCancel: () => void;
  onSubmit: (data: { title: string; content: string }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [err, setErr] = useState(false);

  function submit() {
    if (!title.trim() || !content.trim()) {
      setErr(true);
      return;
    }
    onSubmit({ title, content });
  }

  return (
    <>
      <Input
        label="Sarlavha *"
        placeholder="Masalan: Naming convention"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (err) setErr(false);
        }}
        error={err && !title.trim() ? "Sarlavha kiritilishi shart" : undefined}
        autoFocus
      />
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Matn *</label>
        <textarea
          className={styles.textarea}
          placeholder="Kod yordamchisi shu ma'lumotdan foydalanib javob beradi..."
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (err) setErr(false);
          }}
          rows={6}
        />
        {err && !content.trim() && <p className={styles.errorText}>Matn kiritilishi shart</p>}
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

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: CodeKnowledgeEntryView;
  onEdit: (entry: CodeKnowledgeEntryView) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card padding="14px">
      <div className={styles.row}>
        <div className={styles.rowBody}>
          <p className={styles.title}>{entry.title}</p>
          <p className={styles.preview}>{entry.content}</p>
        </div>
        <div className={listStyles.cardActions}>
          <button className={listStyles.iconBtn} onClick={() => onEdit(entry)} aria-label="Tahrirlash">
            <EditIcon />
          </button>
          <button
            className={`${listStyles.iconBtn} danger`}
            onClick={() => onDelete(entry.id)}
            aria-label="O'chirish"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </Card>
  );
}

export function KodYordamchiClient({
  initialEntries,
  initialSystemPrompt,
}: {
  initialEntries: CodeKnowledgeEntryView[];
  initialSystemPrompt: string;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [sheet, setSheet] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<CodeKnowledgeEntryView | null>(null);
  const [, startTransition] = useTransition();

  function openAdd() {
    setEditing(null);
    setSheet("add");
  }

  function openEdit(entry: CodeKnowledgeEntryView) {
    setEditing(entry);
    setSheet("edit");
  }

  function closeSheet() {
    setSheet(null);
    setEditing(null);
  }

  function handleCreate(data: { title: string; content: string }) {
    const now = new Date().toISOString();
    const optimistic: CodeKnowledgeEntryView = {
      id: `tmp-${Date.now()}`,
      title: data.title,
      content: data.content,
      createdAtISO: now,
      updatedAtISO: now,
    };
    setEntries((es) => [optimistic, ...es]);
    closeSheet();
    startTransition(async () => {
      await createCodeKnowledgeEntry(data);
    });
  }

  function handleUpdate(id: string, data: { title: string; content: string }) {
    setEntries((es) =>
      es.map((e) =>
        e.id === id
          ? { ...e, title: data.title, content: data.content, updatedAtISO: new Date().toISOString() }
          : e
      )
    );
    closeSheet();
    startTransition(async () => {
      await updateCodeKnowledgeEntry(id, data);
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Bu yozuvni o'chirishga ishonchingiz komilmi?")) return;
    setEntries((es) => es.filter((e) => e.id !== id));
    startTransition(async () => {
      await deleteCodeKnowledgeEntry(id);
    });
  }

  return (
    <div>
      <PageHeader
        title="Kod yordamchi"
        subtitle="Telegram botdagi AI Coding Assistant shu ma'lumotlarga tayanadi (bug topish, fix, optimize, testlar va h.k.)"
      />

      <div className={styles.promptWrap}>
        <SystemPromptCard initialPrompt={initialSystemPrompt} />
      </div>

      {entries.length === 0 ? (
        <div className={listStyles.empty}>
          <h2>Hali yozuv yo&apos;q</h2>
          <p>
            Loyihangiz konvensiyalari yoki coding standartlarini qo&apos;shish uchun
            pastdagi + tugmasini bosing.
          </p>
        </div>
      ) : (
        <div className={listStyles.wrap}>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <button className={listStyles.fab} aria-label="Yangi yozuv" onClick={openAdd}>
        +
      </button>

      {sheet === "add" && (
        <Sheet title="Yangi yozuv" onClose={closeSheet}>
          <EntryForm onCancel={closeSheet} onSubmit={handleCreate} />
        </Sheet>
      )}

      {sheet === "edit" && editing && (
        <Sheet title="Yozuvni tahrirlash" onClose={closeSheet}>
          <EntryForm initial={editing} onCancel={closeSheet} onSubmit={(data) => handleUpdate(editing.id, data)} />
        </Sheet>
      )}
    </div>
  );
}
