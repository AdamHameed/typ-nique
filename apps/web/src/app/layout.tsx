import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Typ-Nique",
  description: "Competitive Typst game inspired by TeXnique."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
