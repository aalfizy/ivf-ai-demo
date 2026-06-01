import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zorrya AI — AI-Powered Fertility Intelligence Platform",
  description:
    "Zorrya AI — AI-Powered Fertility Intelligence Platform. Powered by SERVERAT.",
  applicationName: "Zorrya AI",
  authors: [{ name: "SERVERAT" }],
  generator: "Zorrya AI",
  keywords: [
    "Zorrya AI",
    "Fertility Intelligence",
    "AI Healthcare",
    "SERVERAT",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
