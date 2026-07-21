import {
  getBusinessConnectionStatus,
  listBusinessMessages,
  listTelegramBots,
  listTelegramMessages,
} from "@/lib/actions/telegram-bots";
import { TelegramClient } from "./telegram-client";

export default async function TelegramPage() {
  const [bots, messages, businessStatus, businessMsgs] = await Promise.all([
    listTelegramBots(),
    listTelegramMessages(),
    getBusinessConnectionStatus(),
    listBusinessMessages(),
  ]);

  return (
    <TelegramClient
      initialBots={bots.map((b) => ({ ...b, createdAtISO: b.createdAt.toISOString() }))}
      initialMessages={messages}
      businessConnected={businessStatus.connected}
      initialBusinessMessages={businessMsgs}
    />
  );
}
