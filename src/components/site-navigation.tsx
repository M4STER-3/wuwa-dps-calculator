"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryNavigation = [
  { href: "/", label: "Accueil", index: "01" },
  { href: "/character-box", label: "Character Box", index: "02" },
  { href: "/personal-dps", label: "DPS personnel", index: "03" },
  { href: "/team-dps", label: "DPS équipe", index: "04" },
  { href: "/echoes", label: "Échos", index: "05" },
  { href: "/data", label: "Game Data", index: "06" },
] as const;

function isRouteActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={mobile ? "Navigation mobile" : "Navigation principale"}
      className={mobile ? "wuwa-shell-nav wuwa-shell-nav--mobile" : "wuwa-shell-nav"}
    >
      {primaryNavigation.map((item) => {
        const active = isRouteActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={active ? "wuwa-shell-nav__link wuwa-shell-nav__link--active" : "wuwa-shell-nav__link"}
          >
            <span className="wuwa-shell-nav__index" aria-hidden="true">
              {item.index}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
