import { Marko_One } from "next/font/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { AppNav } from "./nav";
import "./tokens.css";
import styles from "./shell.module.css";

const markoOne = Marko_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marko-one",
});

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const [user] = session
    ? await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
    : [];

  const userName = user?.name?.trim() || user?.telegramUsername || "Foydalanuvchi";

  return (
    <div className={`${markoOne.variable} ${styles.layout}`}>
      <AppNav userName={userName} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
