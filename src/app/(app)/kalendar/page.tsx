// E5 Kalendar — kun ko'rinishi: ilova vazifalari va Google Calendar'dagi band
// vaqtlar birga, xronologik tartibda. Kun navigatsiyasi havolalar orqali
// (?d=YYYY-MM-DD), shuning uchun sahifa to'liq server komponent.

import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskOccurrences, tasks, users } from "@/db/schema";
import { requireUserId } from "@/lib/actions/require-user";
import { formatDateUz } from "@/lib/format-date";
import { listBusyEvents, type BusyEvent } from "@/lib/google-calendar";
import {
  addDaysToDateStr,
  dateStrInTz,
  dayRangeInTz,
  timeStrInTz,
  weekdayIndex,
} from "@/lib/tz";
import { PageHeader } from "../page-header";
import styles from "./kalendar.module.css";

const WEEKDAYS_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

type DayItem = {
  key: string;
  time: string | null; // HH:MM yoki null (vaqti belgilanmagan)
  endTime: string | null;
  title: string;
  kind: "task" | "busy";
  done: boolean;
  goalless?: boolean;
};

function dateLabelFromStr(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return formatDateUz(new Date(y, m - 1, d));
}

export default async function KalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const userId = await requireUserId();
  const [user] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const tz = user?.timezone ?? "Asia/Tashkent";

  const todayStr = dateStrInTz(new Date(), tz);
  const { d } = await searchParams;
  const dateStr = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayStr;
  const range = dayRangeInTz(dateStr, tz);
  const dayOfMonth = Number(dateStr.split("-")[2]);
  const weekday = weekdayIndex(dateStr);

  const [allTasks, dayOccurrences] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueAt: tasks.dueAt,
        status: tasks.status,
        recurrence: tasks.recurrence,
      })
      .from(tasks)
      .where(eq(tasks.userId, userId)),
    db
      .select({ taskId: taskOccurrences.taskId, status: taskOccurrences.status })
      .from(taskOccurrences)
      .where(
        and(
          eq(taskOccurrences.userId, userId),
          eq(taskOccurrences.date, dateStr)
        )
      ),
  ]);

  const occDone = new Set(
    dayOccurrences.filter((o) => o.status === "done").map((o) => o.taskId)
  );

  // Shu kunga tegishli vazifalar: bir martaliklar muddati shu kunga to'g'ri
  // kelganda; takrorlanuvchilar — daily har kuni, weekly/monthly esa dueAt
  // kuniga mos kelganda (dueAt bo'lmasa faqat daily ko'rinadi).
  const dayTasks = allTasks.filter((t) => {
    if (t.recurrence === "none") {
      return t.dueAt && t.dueAt >= range.start && t.dueAt < range.end;
    }
    if (t.recurrence === "daily") return true;
    if (!t.dueAt) return false;
    const dueStr = dateStrInTz(t.dueAt, tz);
    if (t.recurrence === "weekly") return weekdayIndex(dueStr) === weekday;
    return Number(dueStr.split("-")[2]) === dayOfMonth; // monthly
  });

  let busy: BusyEvent[] | null = null;
  let busyError = false;
  try {
    busy = await listBusyEvents(userId, range.start, range.end);
  } catch {
    busyError = true;
  }

  const taskItems: DayItem[] = dayTasks.map((t) => ({
    key: `task-${t.id}`,
    time: t.dueAt ? timeStrInTz(t.dueAt, tz) : null,
    endTime: null,
    title: t.title,
    kind: "task",
    done:
      t.recurrence === "none" ? t.status === "done" : occDone.has(t.id),
  }));

  const busyItems: DayItem[] = (busy ?? [])
    .filter((b) => !b.allDay)
    .map((b) => ({
      key: `busy-${b.id}`,
      time: timeStrInTz(new Date(b.start), tz),
      endTime: timeStrInTz(new Date(b.end), tz),
      title: b.title,
      kind: "busy",
      done: false,
    }));

  const allDayItems: DayItem[] = (busy ?? [])
    .filter((b) => b.allDay)
    .map((b) => ({
      key: `busy-${b.id}`,
      time: null,
      endTime: null,
      title: b.title,
      kind: "busy",
      done: false,
    }));

  const timed = [...taskItems.filter((t) => t.time), ...busyItems].sort(
    (a, b) => (a.time! < b.time! ? -1 : a.time! > b.time! ? 1 : 0)
  );
  const untimed = [...allDayItems, ...taskItems.filter((t) => !t.time)];

  // Hafta chizig'i: tanlangan kun joylashgan hafta (Du–Ya).
  const weekStart = addDaysToDateStr(dateStr, -weekday);
  const weekDays = WEEKDAYS_UZ.map((label, i) => {
    const ds = addDaysToDateStr(weekStart, i);
    return { label, dateStr: ds, dayNum: Number(ds.split("-")[2]) };
  });

  return (
    <div>
      <PageHeader
        title="Kalendar"
        subtitle="Vazifalar va band vaqtlar bir ko'rinishda"
      />

      <div className={styles.wrap}>
        <div className={styles.dayNav}>
          <Link
            href={`/kalendar?d=${addDaysToDateStr(dateStr, -1)}`}
            className={styles.navArrow}
            aria-label="Oldingi kun"
          >
            ‹
          </Link>
          <div className={styles.dayTitle}>
            <strong>{dateLabelFromStr(dateStr)}</strong>
            {dateStr !== todayStr && (
              <Link href="/kalendar" className={styles.todayLink}>
                Bugunga qaytish
              </Link>
            )}
          </div>
          <Link
            href={`/kalendar?d=${addDaysToDateStr(dateStr, 1)}`}
            className={styles.navArrow}
            aria-label="Keyingi kun"
          >
            ›
          </Link>
        </div>

        <div className={styles.weekStrip}>
          {weekDays.map((wd) => (
            <Link
              key={wd.dateStr}
              href={`/kalendar?d=${wd.dateStr}`}
              className={`${styles.weekDay} ${
                wd.dateStr === dateStr ? styles.weekDayOn : ""
              } ${wd.dateStr === todayStr ? styles.weekDayToday : ""}`}
            >
              <span className={styles.weekDayLabel}>{wd.label}</span>
              <span className={styles.weekDayNum}>{wd.dayNum}</span>
            </Link>
          ))}
        </div>

        {busy === null && !busyError && (
          <p className={styles.hintCard}>
            Google kalendar ulanmagan — bu yerda faqat ilova vazifalari
            ko&apos;rinadi. Band vaqtlarni ko&apos;rish uchun{" "}
            <Link href="/sozlamalar">Sozlamalardan ulang</Link>.
          </p>
        )}
        {busyError && (
          <p className={styles.hintCard}>
            Google kalendarni o&apos;qib bo&apos;lmadi. Birozdan so&apos;ng qayta
            urinib ko&apos;ring.
          </p>
        )}

        {timed.length === 0 && untimed.length === 0 ? (
          <div className={styles.empty}>
            <h2>Bu kunda hech narsa yo&apos;q</h2>
            <p>Vazifa ham, band vaqt ham topilmadi.</p>
          </div>
        ) : (
          <div className={styles.timeline}>
            {untimed.length > 0 && (
              <div className={styles.group}>
                <div className={styles.groupLabel}>Vaqtsiz</div>
                {untimed.map((item) => (
                  <ItemRow key={item.key} item={item} />
                ))}
              </div>
            )}
            {timed.length > 0 && (
              <div className={styles.group}>
                {untimed.length > 0 && (
                  <div className={styles.groupLabel}>Kun davomida</div>
                )}
                {timed.map((item) => (
                  <ItemRow key={item.key} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotTask}`} />
            Vazifa
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotBusy}`} />
            Band vaqt (Google)
          </span>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: DayItem }) {
  return (
    <div className={styles.item}>
      <span className={styles.itemTime}>
        {item.time ? (
          <>
            {item.time}
            {item.endTime && (
              <span className={styles.itemTimeEnd}>–{item.endTime}</span>
            )}
          </>
        ) : (
          "—"
        )}
      </span>
      <span
        className={`${styles.itemBar} ${
          item.kind === "busy"
            ? styles.barBusy
            : item.done
              ? styles.barDone
              : styles.barTask
        }`}
      />
      <span
        className={`${styles.itemTitle} ${item.done ? styles.itemDone : ""}`}
      >
        {item.title}
      </span>
    </div>
  );
}
