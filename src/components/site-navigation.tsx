"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationIcon = "home" | "character" | "personal" | "team" | "data";

const primaryNavigation = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/character-box", label: "Character Box", icon: "character" },
  { href: "/personal-dps", label: "DPS personnel", icon: "personal" },
  { href: "/team-dps", label: "DPS équipe", icon: "team" },
  { href: "/data", label: "Données", icon: "data" },
] as const satisfies ReadonlyArray<{ href: string; label: string; icon: NavigationIcon }>;

function isRouteActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/character-box" && pathname.startsWith("/echoes")) {
    return true;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ icon }: { icon: NavigationIcon }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (icon) {
    case "home":
      return (
        <svg {...common}>
          <path d="m3.5 10.5 8.5-7 8.5 7" />
          <path d="M5.5 9.5V21h13V9.5" />
          <path d="M9.5 21v-6h5v6" />
        </svg>
      );
    case "character":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 20c.7-4 2.8-6 6.5-6s5.8 2 6.5 6" />
        </svg>
      );
    case "personal":
      return (
        <svg {...common}>
          <path d="M5 18 10 13l3 2 6-8" />
          <path d="M16 7h3v3" />
          <path d="M5 6v12h14" />
        </svg>
      );
    case "team":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="16.5" cy="10" r="2" />
          <path d="M3.8 19c.5-3.4 2.2-5 5.2-5s4.7 1.6 5.2 5" />
          <path d="M14.5 15c2.8-.4 4.7.9 5.2 3.5" />
        </svg>
      );
    case "data":
      return (
        <svg {...common}>
          <path d="M5 4h14v16H5z" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
  }
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
            <span className="wuwa-shell-nav__icon">
              <NavIcon icon={item.icon} />
            </span>
            <span className="wuwa-shell-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
