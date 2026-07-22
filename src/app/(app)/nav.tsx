"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GoalsIcon, TasksIcon, AiIcon, DayIcon, WalletIcon, SettingsIcon, LogoutIcon, CalendarIcon, BookIcon, TelegramIcon, PhoneIcon } from "@/components/ui/icons";
import styles from "./nav.module.css";

function CalendarTabIcon() {
  return <CalendarIcon width={20} height={20} />;
}

const TABS = [
  { href: "/", label: "Maqsadlar", Icon: GoalsIcon },
  { href: "/tasks", label: "Vazifalar", Icon: TasksIcon },
  { href: "/kalendar", label: "Kalendar", Icon: CalendarTabIcon },
  { href: "/ai", label: "AI", Icon: AiIcon },
  { href: "/bilim-baza", label: "Bilim bazasi", Icon: BookIcon },
  { href: "/telegram", label: "Telegram", Icon: TelegramIcon },
  { href: "/telefon", label: "Telefon", Icon: PhoneIcon },
  { href: "/tahlil", label: "Tahlil", Icon: DayIcon },
  { href: "/xarajat", label: "Xarajat", Icon: WalletIcon },
  { href: "/sozlamalar", label: "Sozlamalar", Icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      <nav className={styles.sidebar}>
        <div className={styles.brand}>Maqsadlarim</div>
        <div className={styles.navList}>
          {TABS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${isActive(pathname, href) ? styles.active : ""}`}
            >
              <Icon />
              <span className={styles.navLabel}>{label}</span>
            </Link>
          ))}
        </div>
        <div className={styles.sidebarFoot}>
          <div className={styles.userName}>{userName}</div>
          <button className={styles.logoutBtn} onClick={handleLogout} disabled={loggingOut}>
            <LogoutIcon />
            <span className={styles.navLabel}>{loggingOut ? "Chiqilmoqda…" : "Chiqish"}</span>
          </button>
        </div>
      </nav>

      <nav className={styles.tabbar}>
        {TABS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.tabBtn} ${isActive(pathname, href) ? styles.active : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
