import { listCards } from "@/lib/actions/cards";
import { listExpenses } from "@/lib/actions/expenses";
import { XarajatClient } from "./xarajat-client";

export default async function XarajatPage() {
  const [cards, expenses] = await Promise.all([listCards(), listExpenses()]);

  return (
    <XarajatClient
      initialCards={cards.map((c) => ({
        id: c.id,
        name: c.name,
        numberMasked: c.numberMasked,
        brand: c.brand,
      }))}
      initialExpenses={expenses.map((e) => ({
        id: e.id,
        cardId: e.cardId,
        title: e.title,
        category: e.category,
        amount: e.amount,
        spentAt: e.spentAt.toISOString(),
      }))}
    />
  );
}
