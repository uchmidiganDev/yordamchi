// Google Calendar bilan ishlash — google-oauth.ts kabi to'g'ridan-to'g'ri
// fetch orqali (googleapis paketisiz). Chiqish sinxroni: vazifa → event;
// kirish: band vaqtlarni o'qish. Barcha funksiyalar foydalanuvchi ulanmagan
// bo'lsa null qaytaradi; refresh token bekor qilingan bo'lsa u bazadan
// tozalanadi (Sozlamalarda "Ulanmagan" ko'rinib, qayta ulash so'raladi).

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  GoogleTokenRevokedError,
  refreshGoogleAccessToken,
} from "./google-oauth";

const CAL_BASE = "https://www.googleapis.com/calendar/v3";
const EVENT_DURATION_MS = 60 * 60 * 1000; // Standart davomiylik: 1 soat

// Access token odatda ~1 soat yashaydi — bitta serverless instans ichida
// qayta so'ramaslik uchun oddiy xotira keshi.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(userId: string): Promise<string | null> {
  const cached = tokenCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const [user] = await db
    .select({ refreshToken: users.googleRefreshToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.refreshToken) return null;

  try {
    const res = await refreshGoogleAccessToken(user.refreshToken);
    tokenCache.set(userId, {
      token: res.access_token,
      expiresAt: Date.now() + res.expires_in * 1000,
    });
    return res.access_token;
  } catch (e) {
    if (e instanceof GoogleTokenRevokedError) {
      // Qayta ulash kerak — eski tokenni tozalaymiz.
      await db
        .update(users)
        .set({ googleRefreshToken: null })
        .where(eq(users.id, userId));
      tokenCache.delete(userId);
      return null;
    }
    throw e;
  }
}

type CalendarTask = { id: string; title: string; dueAt: Date };

function eventBody(task: CalendarTask) {
  return {
    summary: task.title,
    description: "Maqsadlarim ilovasidagi vazifa",
    start: { dateTime: task.dueAt.toISOString() },
    end: {
      dateTime: new Date(task.dueAt.getTime() + EVENT_DURATION_MS).toISOString(),
    },
    extendedProperties: { private: { yordamchiTaskId: task.id } },
  };
}

// Vazifa uchun event yaratadi; yaratilgan event ID yoki ulanmagan bo'lsa null.
export async function createTaskEvent(
  userId: string,
  task: CalendarTask
): Promise<string | null> {
  const token = await getAccessToken(userId);
  if (!token) return null;

  const res = await fetch(`${CAL_BASE}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody(task)),
  });
  if (!res.ok) {
    throw new Error(`Calendar event yaratish muvaffaqiyatsiz: ${res.status}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

// Mavjud eventni yangilaydi. Event Google tomonda o'chirilgan bo'lsa (404/410)
// yangisini yaratib, yangi ID qaytaradi.
export async function updateTaskEvent(
  userId: string,
  eventId: string,
  task: CalendarTask
): Promise<string | null> {
  const token = await getAccessToken(userId);
  if (!token) return null;

  const res = await fetch(
    `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody(task)),
    }
  );
  if (res.status === 404 || res.status === 410) {
    return createTaskEvent(userId, task);
  }
  if (!res.ok) {
    throw new Error(`Calendar event yangilash muvaffaqiyatsiz: ${res.status}`);
  }
  return eventId;
}

export async function deleteTaskEvent(
  userId: string,
  eventId: string
): Promise<void> {
  const token = await getAccessToken(userId);
  if (!token) return;

  const res = await fetch(
    `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  // 404/410 — allaqachon o'chirilgan, xato emas.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Calendar event o'chirish muvaffaqiyatsiz: ${res.status}`);
  }
}

export type BusyEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
};

type GoogleEventItem = {
  id: string;
  status?: string;
  summary?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

// Berilgan oraliqdagi band vaqtlar (foydalanuvchi kalendaridagi uchrashuvlar).
// Ilova o'zi yaratgan eventlar (yordamchiTaskId belgisi bor) chiqarib
// tashlanadi — ular vazifa sifatida alohida ko'rsatiladi. Ulanmagan bo'lsa
// null qaytadi.
export async function listBusyEvents(
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<BusyEvent[] | null> {
  const token = await getAccessToken(userId);
  if (!token) return null;

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const res = await fetch(
    `${CAL_BASE}/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`Calendar o'qish muvaffaqiyatsiz: ${res.status}`);
  }
  const data = (await res.json()) as { items?: GoogleEventItem[] };

  return (data.items ?? [])
    .filter(
      (ev) =>
        ev.status !== "cancelled" &&
        ev.transparency !== "transparent" &&
        !ev.extendedProperties?.private?.yordamchiTaskId
    )
    .map((ev) => {
      const allDay = Boolean(ev.start?.date);
      return {
        id: ev.id,
        title: ev.summary || "(nomsiz)",
        start: ev.start?.dateTime ?? `${ev.start?.date}T00:00:00Z`,
        end: ev.end?.dateTime ?? `${ev.end?.date}T00:00:00Z`,
        allDay,
      };
    });
}

// Foydalanuvchi Google kalendarga ulanganmi (token bor va yangilash mumkin).
export async function isGoogleCalendarConnected(
  userId: string
): Promise<boolean> {
  return (await getAccessToken(userId)) !== null;
}
