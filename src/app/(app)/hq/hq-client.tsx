"use client";

import { useEffect, useMemo, useRef } from "react";
import type { HqSnapshot } from "@/lib/actions/hq";
import { formatDateStrUz } from "@/lib/format-date";
import styles from "./hq.module.css";

type Point = { x: number; y: number };
type Room = { id: string; name: string; mission: string; accent: string; box: { x: number; y: number; w: number; h: number } };
type Agent = {
  id: string;
  name: string;
  role: string;
  color: string;
  icon: string;
  desk: Point;
  table?: Point;
  tables?: Point[];
  lines: string[];
};

const DEPT_TABLES = {
  aloqa: { x: 25.5, y: 30, tag: "ALOQA" },
  ijod: { x: 74.5, y: 30, tag: "IJOD" },
  reja: { x: 25.5, y: 58, tag: "REJA" },
  muhandis: { x: 74.5, y: 58, tag: "DEV" },
} as const;

const ROOMS: Room[] = [
  { id: "ceo", name: "BOSH OFIS", mission: "Barcha bo'limlarni muvofiqlashtiradi", accent: "#f5a742", box: { x: 30, y: 1.5, w: 40, h: 13 } },
  { id: "aloqa", name: "ALOQA BO'LIMI", mission: "Xabar, ovoz va guruh xavfsizligi", accent: "#4fd6e0", box: { x: 2, y: 16, w: 47, h: 27 } },
  { id: "ijod", name: "IJODKORLIK STUDIYASI", mission: "Rasm, hujjat va sayt tahlili", accent: "#f2a34a", box: { x: 51, y: 16, w: 47, h: 27 } },
  { id: "reja", name: "REJA VA TAHLIL", mission: "Kalendar, maqsad, kunlik xulosa", accent: "#4fdb8f", box: { x: 2, y: 45, w: 47, h: 27 } },
  { id: "muhandis", name: "MUHANDISLIK", mission: "Kod, qidiruv, bilim bazasi", accent: "#a883f2", box: { x: 51, y: 45, w: 47, h: 27 } },
  { id: "reception", name: "QABULXONA", mission: "Mehmonlarni kutib oladi", accent: "#f5d76e", box: { x: 20, y: 74, w: 60, h: 15 } },
];

function buildAgents(s: HqSnapshot): Agent[] {
  return [
    {
      id: "yordamchi", name: "Yordamchi", role: "Bosh AI — barcha boʻlimlarni tekshiradi", color: "#f5a742", icon: "AI",
      desk: { x: 50, y: 8.5 },
      tables: [DEPT_TABLES.aloqa, DEPT_TABLES.ijod, DEPT_TABLES.reja, DEPT_TABLES.muhandis],
      lines: [
        `Jami ${s.tasksTotal} ta vazifa, ${s.goalsActive.length} ta maqsad nazoratda.`,
        `Bugungacha ${s.analysesTotal} ta AI tahlil yaratilgan.`,
        "Barcha bo'limlar holati yaxshi.",
      ],
    },
    {
      id: "telegram", name: "Telegram", role: "Bot integratsiyasi", color: "#3fa9f5", icon: "TG", desk: { x: 9, y: 21 }, table: DEPT_TABLES.aloqa,
      lines: [
        `Ko'p-bot tizimida ${s.telegramMessages} ta xabar javoblandi.`,
        `${s.telegramBotsEnabled} ta bot faol va ulangan.`,
        `Telegram Business orqali ${s.businessMessages} ta suhbat bo'ldi.`,
      ],
    },
    { id: "ovoz", name: "Ovoz", role: "Ovozli suhbat (STT/TTS)", color: "#5cc9e8", icon: "VO", desk: { x: 41, y: 20 }, table: DEPT_TABLES.aloqa,
      lines: ["Klonlangan ovoz (ElevenLabs) faol.", "Gemini orqali nutqni matnga o'giraman."] },
    {
      id: "nazorat", name: "Nazorat", role: "Guruh moderatsiyasi", color: "#3fe0b0", icon: "MOD", desk: { x: 25, y: 40 }, table: DEPT_TABLES.aloqa,
      lines: [
        s.groupsWithAntispamOn > 0 ? `${s.groupsWithAntispamOn} ta guruhda antispam yoqilgan.` : "Hozircha antispam yoqilgan guruh yo'q.",
        `${s.groupModerationActions} ta moderatsiya harakati qayd etilgan.`,
      ],
    },
    { id: "rasm", name: "Rasm", role: "Rasm generatsiya (/img)", color: "#f2864a", icon: "IMG", desk: { x: 60, y: 21 }, table: DEPT_TABLES.ijod,
      lines: ["Model: gemini-3.1-flash-image faol.", "/img buyrug'i orqali ishga tayyorman."] },
    { id: "hujjat", name: "Hujjat", role: "PDF tahrirlash", color: "#f0a83f", icon: "PDF", desk: { x: 92, y: 21 }, table: DEPT_TABLES.ijod,
      lines: ["Faqat kerakli sahifani tahrirlayman.", "Asl dizayn saqlanib qoladi."] },
    {
      id: "sayt", name: "Sayt", role: "Veb-sayt tahlili", color: "#f5c94a", icon: "SITE", desk: { x: 75, y: 40 }, table: DEPT_TABLES.ijod,
      lines: [`Jami ${s.websiteAnalyses} ta sayt tahlil qilingan.`, "Xavfsizlik headerlarini tekshiraman."],
    },
    {
      id: "reja", name: "Reja", role: "Kalendar & Vazifalar", color: "#35c9a0", icon: "CAL", desk: { x: 9, y: 50 }, table: DEPT_TABLES.reja,
      lines: [`${s.tasksTotal} ta vazifadan ${s.tasksDone} tasi bajarilgan.`, "Google Calendar bilan sinxronman."],
    },
    {
      id: "maqsad", name: "Maqsad", role: "Maqsadlarni boʻlish", color: "#6bd65a", icon: "GOAL", desk: { x: 41, y: 49 }, table: DEPT_TABLES.reja,
      lines:
        s.goalsActive.length > 0
          ? s.goalsActive.slice(0, 4).map((g) => `${g.title}: ${g.progress}% bajarilgan.`)
          : ["Hozircha faol maqsad yo'q."],
    },
    {
      id: "tahlil", name: "Tahlil", role: "Kunlik AI tahlili", color: "#8fe07a", icon: "ANL", desk: { x: 25, y: 68 }, table: DEPT_TABLES.reja,
      lines: [
        `${s.analysesTotal} ta tahlil: ${s.analysesMorning} ertalabki, ${s.analysesEvening} kechqurungi, ${s.analysesManual} qo'lda.`,
        "Kunlik hisobot tizimi endi avtomatik.",
      ],
    },
    {
      id: "kod", name: "Kod", role: "Kod yordamchi", color: "#a883f2", icon: "DEV", desk: { x: 60, y: 50 }, table: DEPT_TABLES.muhandis,
      lines: s.codeReviews > 0 ? [`${s.codeReviews} ta kod ko'rib chiqilgan.`] : ["Hozircha kod ko'rib chiqilmagan.", "Birinchi so'rovni kutmoqdaman."],
    },
    { id: "qidiruv", name: "Qidiruv", role: "Veb qidiruv (/search)", color: "#8f6bf5", icon: "SRC", desk: { x: 92, y: 50 }, table: DEPT_TABLES.muhandis,
      lines: ["Google qidiruv (grounding) faol.", "/search orqali internetdan javob beraman."] },
    {
      id: "bilimbaza", name: "BilimBaza", role: "Bilim bazasi", color: "#c48bf2", icon: "KB", desk: { x: 75, y: 68 }, table: DEPT_TABLES.muhandis,
      lines: s.knowledgeEntries > 0 ? [`${s.knowledgeEntries} ta yozuv bilim bazasida.`] : ["Hozircha bilim bazasi bo'sh.", "Yangi yozuv qo'shilishini kutmoqdaman."],
    },
    {
      id: "mehmon", name: "Mehmon", role: "Qabulxona (Mini App)", color: "#f5d76e", icon: "IN", desk: { x: 50, y: 80 }, table: { x: 50, y: 90.5 },
      lines: [`${s.miniAppMessages} ta mehmon savoli javoblandi.`, "Mini App orqali kutib olaman."],
    },
  ];
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function nowStr() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function HqClient({ snapshot }: { snapshot: HqSnapshot }) {
  const agents = useMemo(() => buildAgents(snapshot), [snapshot]);
  const agentEls = useRef<Record<string, HTMLDivElement | null>>({});
  const logRef = useRef<HTMLDivElement | null>(null);
  const clockRef = useRef<HTMLSpanElement | null>(null);
  const cabinetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clockEl = clockRef.current;
    const tick = () => {
      if (clockEl) clockEl.textContent = nowStr();
    };
    tick();
    const clockTimer = setInterval(tick, 1000);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced && cabinetRef.current) cabinetRef.current.classList.add(styles.reduced);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const positions: Record<string, Point> = {};

    function pushLog(agent: Agent, line: string) {
      const logEl = logRef.current;
      if (!logEl) return;
      const row = document.createElement("div");
      row.className = styles.logRow;
      row.innerHTML =
        `<span class="${styles.logTime}">${nowStr()}</span>` +
        `<span class="${styles.logDot}" style="background:${agent.color};color:${agent.color}"></span>` +
        `<span class="${styles.logLine}"><b>${agent.name}</b> <i>&middot; ${agent.role.split("(")[0].trim()}</i><br>${line}</span>`;
      logEl.insertBefore(row, logEl.firstChild);
      requestAnimationFrame(() => row.classList.add(styles.logRowShow));
      while (logEl.children.length > 9) logEl.removeChild(logEl.lastChild as ChildNode);
    }

    function moveAgent(agent: Agent, el: HTMLDivElement, to: Point, onArrive?: () => void) {
      const from = positions[agent.id];
      const d = dist(from, to);
      const duration = Math.min(3400, 650 + d * 24);
      el.style.transitionDuration = `${duration}ms`;
      el.classList.remove(styles.agentIdle);
      el.classList.add(styles.agentWalking);
      el.style.left = `${to.x}%`;
      el.style.top = `${to.y}%`;
      positions[agent.id] = to;
      timers.push(
        setTimeout(() => {
          el.classList.remove(styles.agentWalking);
          onArrive?.();
        }, duration)
      );
    }

    function scheduleAgent(agent: Agent, el: HTMLDivElement, index: number) {
      function idleThenGo() {
        el.classList.add(styles.agentIdle);
        timers.push(setTimeout(goToTable, 3400 + Math.random() * 4600 + index * 220));
      }
      function goToTable() {
        const target = agent.tables ? pick(agent.tables) : agent.table!;
        moveAgent(agent, el, target, sayLine);
      }
      function sayLine() {
        const line = pick(agent.lines);
        const bubble = el.querySelector<HTMLElement>("[data-bubble]");
        if (bubble) bubble.textContent = line;
        el.classList.add(styles.agentTalking);
        pushLog(agent, line);
        timers.push(
          setTimeout(() => {
            el.classList.remove(styles.agentTalking);
            goBack();
          }, 2500)
        );
      }
      function goBack() {
        moveAgent(agent, el, agent.desk, idleThenGo);
      }
      idleThenGo();
    }

    agents.forEach((agent, i) => {
      positions[agent.id] = agent.desk;
      const el = agentEls.current[agent.id];
      if (!el) return;
      if (reduced) {
        timers.push(setTimeout(() => pushLog(agent, agent.lines[0]), i * 200));
      } else {
        timers.push(setTimeout(() => scheduleAgent(agent, el, i), i * 320 + 300));
      }
    });

    return () => {
      clearInterval(clockTimer);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayLabel = formatDateStrUz(new Date().toISOString().slice(0, 10));

  return (
    <div className={styles.cabinet} ref={cabinetRef}>
      <div className={styles.hud}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} /> Jonli holat &mdash; har sahifa yuklanganda bazadan qayta o&apos;qiladi ({todayLabel})
          </p>
          <h1 className={styles.title}>
            YORDAMCHI <span>HQ</span>
          </h1>
        </div>
        <div className={styles.hudStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Bo&apos;lim</span>
            <span className={styles.statValue}>4</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Agent</span>
            <span className={`${styles.statValue} ${styles.statValueOn}`}>{agents.length}/{agents.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Ko&apos;rish vaqti</span>
            <span className={styles.statValue} ref={clockRef}>
              00:00:00
            </span>
          </div>
        </div>
      </div>
      <p className={styles.snapshotNote}>
        Har bir agent gapiradigan raqamlar shu sahifa ochilganda bazadan HAQIQIY o&apos;qilgan &mdash; qayta yuklasangiz yangilanadi.
      </p>

      <div className={styles.bodyGrid}>
        <div className={styles.stageWrap}>
          <div className={styles.stage}>
            {ROOMS.map((room) => (
              <div
                key={room.id}
                className={styles.room}
                style={{
                  ["--rc" as string]: room.accent,
                  left: `${room.box.x}%`,
                  top: `${room.box.y}%`,
                  width: `${room.box.w}%`,
                  height: `${room.box.h}%`,
                }}
              >
                <div className={styles.roomLabel}>
                  <div className={styles.roomName}>{room.name}</div>
                  <div className={styles.roomMission}>{room.mission}</div>
                </div>
              </div>
            ))}

            {Object.entries(DEPT_TABLES).map(([key, t]) => (
              <div key={key} className={styles.table} style={{ left: `${t.x}%`, top: `${t.y}%` }} data-tag={t.tag} />
            ))}
            <div className={styles.table} style={{ left: "50%", top: "90.5%" }} data-tag="" />

            {agents.map((agent) => (
              <div
                key={`desk-${agent.id}`}
                className={styles.desk}
                style={{ ["--dc" as string]: agent.color, left: `${agent.desk.x}%`, top: `${agent.desk.y}%` }}
                data-icon={agent.icon}
              >
                <div className={styles.deskLabel}>{agent.name}</div>
              </div>
            ))}

            {agents.map((agent) => (
              <div
                key={agent.id}
                ref={(el) => {
                  agentEls.current[agent.id] = el;
                }}
                className={`${styles.agent} ${styles.agentIdle}`}
                style={{ ["--c" as string]: agent.color, left: `${agent.desk.x}%`, top: `${agent.desk.y}%` }}
              >
                <div className={styles.tag}>{agent.name}</div>
                <div className={styles.bot}>
                  <div className={styles.antenna} />
                  <div className={styles.visor} />
                  <div className={styles.bubble} data-bubble />
                </div>
                <div className={styles.legs}>
                  <span className={styles.leg} />
                  <span className={styles.leg} />
                </div>
                <div className={styles.shadowBlob} />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.logPanel}>
          <div className={styles.logHead}>Faoliyat jurnali</div>
          <div className={styles.logBody} ref={logRef} />
        </div>
      </div>
    </div>
  );
}
