import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { LogoutButton } from "./logout-button";

export default async function Home() {
  const session = await getSession();

  const [user] = session
    ? await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
    : [];

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <h1>Yordamchi</h1>
      <p>
        Xush kelibsiz{user?.name ? `, ${user.name}` : ""}! Backend asosi
        (auth + baza) ishlamoqda.
      </p>
      <p style={{ color: "#666" }}>
        Bu sahifa vaqtinchalik — Sprint 1 dizayni tayyor bo&apos;lgach
        almashtiriladi.
      </p>
      <LogoutButton />
    </main>
  );
}
