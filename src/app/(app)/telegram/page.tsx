import { listTelegramBots, listTelegramMessages } from "@/lib/actions/telegram-bots";
import { TelegramClient } from "./telegram-client";

export default async function TelegramPage() {
  const [bots, messages] = await Promise.all([
    listTelegramBots(),
    listTelegramMessages(),
  ]);

  return (
    <TelegramClient
      initialBots={bots.map((b) => ({ ...b, createdAtISO: b.createdAt.toISOString() }))}
      initialMessages={messages}
    />
  );
}
