import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Per design_handoff_bourbon_blend/README.md §Typography (preserved from v1).

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jb",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Resolve relative metadata URLs against this origin. Order:
//   1. NEXT_PUBLIC_SITE_URL — explicit override for stage / preview
//      deploys (set in SST or Vercel env per stage).
//   2. VERCEL_URL — auto-injected on Vercel preview deployments.
//   3. http://localhost:3000 — local dev fallback.
const SITE_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
})();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Bourbonomics",
    template: "%s · Bourbonomics",
  },
  description: "A multiplayer bourbon-distillery deckbuilder. Build recipes, age barrels, ride the demand curve. Become the Bourbon Baron of America.",
  applicationName: "Bourbonomics",
  // Explicit icon entry so browsers prefer the SVG over a stale
  // CloudFront-cached `/favicon.ico` (left over from when the
  // project was scaffolded with `create-next-app`'s default).
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "Bourbonomics",
    title: "Bourbonomics",
    description: "A multiplayer bourbon-distillery deckbuilder. Build recipes, age barrels, ride the demand curve.",
    url: "/",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        type: "image/svg+xml",
        alt: "Bourbonomics — A multiplayer bourbon-distillery deckbuilder.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bourbonomics",
    description: "A multiplayer bourbon-distillery deckbuilder. Build recipes, age barrels, ride the demand curve.",
    images: ["/og-image.svg"],
  },
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
