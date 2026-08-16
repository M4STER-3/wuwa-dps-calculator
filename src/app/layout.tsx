import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wuthering Waves — Character Box",
  description: "Planifiez et conservez les builds de vos Resonators.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
