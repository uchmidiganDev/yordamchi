import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { phoneCalls } from "@/db/schema";
import { requireUserId } from "@/lib/actions/require-user";

// Qo'ng'iroq audio yozuvini <audio> teg uchun qaytaradi. `/api/*` sessiya
// middleware'i (src/proxy.ts) orqali allaqachon himoyalangan — bu yerda
// qo'shimcha `requireUserId()` faqat egalikni (boshqa foydalanuvchining
// yozuvini ko'rmasligi) tekshirish uchun.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const userId = await requireUserId();

  const [row] = await db
    .select({
      recordingBase64: phoneCalls.recordingBase64,
      recordingMimeType: phoneCalls.recordingMimeType,
    })
    .from(phoneCalls)
    .where(and(eq(phoneCalls.id, callId), eq(phoneCalls.userId, userId)))
    .limit(1);

  if (!row?.recordingBase64) {
    return new Response("Topilmadi", { status: 404 });
  }

  return new Response(Buffer.from(row.recordingBase64, "base64"), {
    headers: { "Content-Type": row.recordingMimeType || "audio/mpeg" },
  });
}
