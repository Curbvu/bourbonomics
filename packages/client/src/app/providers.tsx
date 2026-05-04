"use client";

import { GameProvider } from "@/lib/store/game";

export function Providers({ children }: { children: React.ReactNode }) {
  return <GameProvider>{children}</GameProvider>;
}
