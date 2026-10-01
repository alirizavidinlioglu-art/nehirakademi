import type { Metadata, Viewport } from "next";
import "@fontsource/fredoka/latin-500.css";
import "@fontsource/fredoka/latin-600.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/fredoka/latin-ext-500.css";
import "@fontsource/fredoka/latin-ext-600.css";
import "@fontsource/nunito/latin-ext-400.css";
import "@fontsource/nunito/latin-ext-600.css";
import "@fontsource/nunito/latin-ext-700.css";
import "@fontsource/nunito/latin-ext-800.css";
import "katex/dist/katex.min.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nehir Akademi · Öğrenmek için güzel bir gün",
  description:
    "Nehir’in kişisel öğrenme alanı. Dersler, akıllı tekrar ve AI öğretmen.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nehir Akademi",
    statusBarStyle: "default",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7651c9",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
