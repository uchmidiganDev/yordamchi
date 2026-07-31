import { getTelStatus, listPhoneCalls } from "@/lib/actions/tel";
import { TelClient } from "./tel-client";

export default async function TelPage() {
  const [status, calls] = await Promise.all([getTelStatus(), listPhoneCalls()]);
  return <TelClient initialStatus={status} initialCalls={calls} />;
}
