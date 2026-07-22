import { getPhoneStatus, listPersonas } from "@/lib/actions/personas";
import { TelefonClient } from "./telefon-client";

export default async function TelefonPage() {
  const [personas, status] = await Promise.all([listPersonas(), getPhoneStatus()]);

  return (
    <TelefonClient
      initialPersonas={personas}
      initialEnabled={status.enabled}
      initialActivePersonaId={status.activePersonaId}
    />
  );
}
