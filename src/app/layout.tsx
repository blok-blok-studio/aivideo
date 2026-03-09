import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blok Blok Studio",
  description: "AI Video Production Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg font-display text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
