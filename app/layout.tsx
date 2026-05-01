import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Per design_handoff_bourbon_blend/README.md §Typography.
//
// We give each face a distinctive CSS variable name so they don't collide
// with Tailwind's own `--font-sans` / `--font-mono` theme tokens — those
// tokens are mapped onto these variables inside globals.css `@theme inline`.

// Display face — game-board titles, brand mark, rickhouse names, bourbon names.
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Body / UI sans — the rest of the chrome.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Monospace — captions, numerics, labels. tabular-nums is critical for cash /
// counts so columns line up.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jb",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Bourbonomics",
  description: "Become the Bourbon Baron of America",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${cormorantGaramond.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
