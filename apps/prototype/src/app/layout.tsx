import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bourbonomics — Prototype",
  description:
    "Ground-up redesign prototype. Isolated from the live game. PLACEHOLDER content.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
