import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "פורטל החירום הלאומי - העתק",
  description: "מבצע שאגת הארי",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
