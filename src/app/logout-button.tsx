"use client";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button onClick={handleLogout} style={{ padding: "8px 16px" }}>
      Chiqish
    </button>
  );
}
