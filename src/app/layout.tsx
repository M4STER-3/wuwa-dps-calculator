import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import "./globals.css";
import "./site-shell.css";
import "./background-system.css";
import "./illustrated-card.css";
import "./site-shell-focus.css";

export const metadata: Metadata = {
  title: "WUWA LAB — Wuthering Waves DPS Calculator",
  description:
    "Planifiez vos builds Wuthering Waves, comparez vos dégâts et préparez vos équipes avec des données structurées et vérifiées.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
