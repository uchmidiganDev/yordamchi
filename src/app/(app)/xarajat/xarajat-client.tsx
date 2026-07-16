"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { TrashIcon } from "@/components/ui/icons";
import { createCard, deleteCard } from "@/lib/actions/cards";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import { formatDateShortUz } from "@/lib/format-date";
import { PageHeader } from "../page-header";
import listStyles from "../list.module.css";
import styles from "./xarajat.module.css";

type Brand = "uzcard" | "humo";

type CardItem = {
  id: string;
  name: string;
  numberMasked: string;
  brand: Brand;
};

type ExpenseItem = {
  id: string;
  cardId: string;
  title: string;
  category: string;
  amount: number;
  spentAt: string;
};

function formatAmount(amount: number) {
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} so'm`;
}

function formatDate(spentAt: string) {
  return formatDateShortUz(new Date(spentAt));
}

function CardForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (data: { name: string; numberMasked: string; brand: Brand }) => void;
}) {
  const [name, setName] = useState("");
  const [numberMasked, setNumberMasked] = useState("");
  const [brand, setBrand] = useState<Brand>("uzcard");
  const [err, setErr] = useState(false);

  function submit() {
    if (!name.trim() || !numberMasked.trim()) {
      setErr(true);
      return;
    }
    onSubmit({ name, numberMasked, brand });
  }

  return (
    <>
      <Input
        label="Karta nomi *"
        placeholder="Masalan: Asosiy karta"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (err) setErr(false);
        }}
        error={err && !name.trim() ? "Karta nomi kiritilishi shart" : undefined}
        autoFocus
      />
      <Input
        label="Karta raqami *"
        placeholder="**** 1234"
        value={numberMasked}
        onChange={(e) => {
          setNumberMasked(e.target.value);
          if (err) setErr(false);
        }}
        error={err && !numberMasked.trim() ? "Karta raqami kiritilishi shart" : undefined}
      />
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Turi</label>
        <Segmented
          options={[
            { value: "uzcard", label: "Uzcard" },
            { value: "humo", label: "Humo" },
          ]}
          value={brand}
          onChange={setBrand}
        />
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

function ExpenseForm({
  cards,
  onCancel,
  onSubmit,
}: {
  cards: CardItem[];
  onCancel: () => void;
  onSubmit: (data: { cardId: string; title: string; category: string; amount: number }) => void;
}) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState(false);

  function submit() {
    const amountNum = Number(amount);
    if (!title.trim() || !category.trim() || !cardId || !amountNum || amountNum <= 0) {
      setErr(true);
      return;
    }
    onSubmit({ cardId, title, category, amount: amountNum });
  }

  return (
    <>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Karta *</label>
        <select
          className={styles.select}
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.numberMasked})
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Xarajat nomi *"
        placeholder="Masalan: Kafe"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (err) setErr(false);
        }}
        error={err && !title.trim() ? "Xarajat nomi kiritilishi shart" : undefined}
        autoFocus
      />
      <Input
        label="Kategoriya *"
        placeholder="Masalan: Ovqatlanish"
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          if (err) setErr(false);
        }}
        error={err && !category.trim() ? "Kategoriya kiritilishi shart" : undefined}
      />
      <Input
        label="Summa (so'm) *"
        type="number"
        placeholder="50000"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          if (err) setErr(false);
        }}
        error={err && !(Number(amount) > 0) ? "To'g'ri summa kiriting" : undefined}
      />
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

export function XarajatClient({
  initialCards,
  initialExpenses,
}: {
  initialCards: CardItem[];
  initialExpenses: ExpenseItem[];
}) {
  const [cards, setCards] = useState(initialCards);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [sheet, setSheet] = useState<"card" | "expense" | null>(null);
  const [, startTransition] = useTransition();

  const total = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  function cardLabel(cardId: string) {
    const c = cards.find((c) => c.id === cardId);
    return c ? `${c.name} · ${c.numberMasked}` : "";
  }

  function handleCreateCard(data: { name: string; numberMasked: string; brand: Brand }) {
    const optimistic: CardItem = { id: `tmp-${Date.now()}`, ...data };
    setCards((cs) => [optimistic, ...cs]);
    setSheet(null);
    startTransition(async () => {
      await createCard(data);
    });
  }

  function handleDeleteCard(id: string) {
    if (!window.confirm("Kartani o'chirishga ishonchingiz komilmi? Unga bog'liq xarajatlar ham o'chadi."))
      return;
    setCards((cs) => cs.filter((c) => c.id !== id));
    setExpenses((es) => es.filter((e) => e.cardId !== id));
    startTransition(async () => {
      await deleteCard(id);
    });
  }

  function handleCreateExpense(data: {
    cardId: string;
    title: string;
    category: string;
    amount: number;
  }) {
    const optimistic: ExpenseItem = {
      id: `tmp-${Date.now()}`,
      spentAt: new Date().toISOString(),
      ...data,
    };
    setExpenses((es) => [optimistic, ...es]);
    setSheet(null);
    startTransition(async () => {
      await createExpense(data);
    });
  }

  function handleDeleteExpense(id: string) {
    if (!window.confirm("Bu xarajatni o'chirishga ishonchingiz komilmi?")) return;
    setExpenses((es) => es.filter((e) => e.id !== id));
    startTransition(async () => {
      await deleteExpense(id);
    });
  }

  return (
    <div>
      <PageHeader title="Xarajatlar" subtitle="Kartalaringiz va xarajatlaringizni kuzatib boring" />

      <div className={styles.wrap}>
        <Card padding="16px" className={styles.totalCard}>
          <div className={styles.totalLabel}>Jami xarajat</div>
          <div className={styles.totalValue}>{formatAmount(total)}</div>
        </Card>

        <div className={listStyles.rowHead}>
          <strong>Kartalar</strong>
          <button className={styles.linkBtn} onClick={() => setSheet("card")}>
            + Karta qo&apos;shish
          </button>
        </div>

        {cards.length === 0 ? (
          <p className={styles.emptyHint}>Hali karta qo&apos;shilmagan.</p>
        ) : (
          <div className={styles.cardsRow}>
            {cards.map((c) => (
              <div key={c.id} className={`${styles.cardTile} ${styles[c.brand]}`}>
                <button
                  className={styles.cardDelete}
                  onClick={() => handleDeleteCard(c.id)}
                  aria-label="Kartani o'chirish"
                >
                  <TrashIcon />
                </button>
                <div className={styles.cardTileName}>{c.name}</div>
                <div className={styles.cardTileNumber}>{c.numberMasked}</div>
                <div className={styles.cardTileBrand}>{c.brand === "uzcard" ? "Uzcard" : "Humo"}</div>
              </div>
            ))}
          </div>
        )}

        <div className={listStyles.rowHead} style={{ marginTop: 8 }}>
          <strong>Xarajatlar</strong>
          <span className={listStyles.rowHeadMuted}>{expenses.length} ta</span>
        </div>

        {expenses.length === 0 ? (
          <div className={listStyles.empty}>
            <h2>Hali xarajat yo&apos;q</h2>
            <p>Birinchi xarajatingizni qo&apos;shish uchun pastdagi + tugmasini bosing.</p>
          </div>
        ) : (
          <div className={listStyles.wrap}>
            {expenses.map((e) => (
              <Card key={e.id} padding="14px">
                <div className={styles.expenseRow}>
                  <div className={styles.expenseInfo}>
                    <p className={styles.expenseTitle}>{e.title}</p>
                    <div className={styles.expenseMeta}>
                      <span className={styles.expenseCategory}>{e.category}</span>
                      <span>{cardLabel(e.cardId)}</span>
                      <span>{formatDate(e.spentAt)}</span>
                    </div>
                  </div>
                  <div className={styles.expenseAmount}>-{formatAmount(e.amount)}</div>
                  <button
                    className={`${listStyles.iconBtn} danger`}
                    onClick={() => handleDeleteExpense(e.id)}
                    aria-label="O'chirish"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <button
        className={listStyles.fab}
        aria-label="Yangi xarajat"
        onClick={() => setSheet("expense")}
        disabled={cards.length === 0}
      >
        +
      </button>

      {sheet === "card" && (
        <Sheet title="Yangi karta" onClose={() => setSheet(null)}>
          <CardForm onCancel={() => setSheet(null)} onSubmit={handleCreateCard} />
        </Sheet>
      )}

      {sheet === "expense" && (
        <Sheet title="Yangi xarajat" onClose={() => setSheet(null)}>
          <ExpenseForm cards={cards} onCancel={() => setSheet(null)} onSubmit={handleCreateExpense} />
        </Sheet>
      )}
    </div>
  );
}
