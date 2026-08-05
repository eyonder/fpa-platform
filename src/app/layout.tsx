import type { Metadata } from "next";

import "@/frontend/styles/globals.css";

export const metadata: Metadata = {
  title: "FP&A Platform",
  description: "Bütçe planlama, konsolidasyon ve senaryo analizi",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
