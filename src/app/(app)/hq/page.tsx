import { Press_Start_2P, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { getHqSnapshot } from "@/lib/actions/hq";
import { HqClient } from "./hq-client";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});
const sansFont = IBM_Plex_Sans({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
});
const monoFont = IBM_Plex_Mono({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export default async function HqPage() {
  const snapshot = await getHqSnapshot();

  return (
    <div className={`${pixelFont.variable} ${sansFont.variable} ${monoFont.variable}`}>
      <HqClient snapshot={snapshot} />
    </div>
  );
}
