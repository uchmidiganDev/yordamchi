import { getShaxsiyAiSettings } from "@/lib/actions/shaxsiy-ai";
import { ShaxsiyAiClient } from "./shaxsiy-ai-client";

export default async function ShaxsiyAiPage() {
  const settings = await getShaxsiyAiSettings();
  return <ShaxsiyAiClient initialSettings={settings} />;
}
