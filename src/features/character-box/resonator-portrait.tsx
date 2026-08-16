"use client";

import Image from "next/image";
import { useState } from "react";
import type { Resonator } from "@/domain/models";

interface ResonatorPortraitProps {
  resonator: Resonator;
  className?: string;
  sizes?: string;
}

/** Reusable local portrait with an intentional fallback for missing files. */
export function ResonatorPortrait({
  resonator,
  className = "h-20 w-20",
  sizes = "80px",
}: ResonatorPortraitProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const portrait = resonator.portrait;
  const canDisplay = portrait && failedSource !== portrait.src;

  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#283343] to-[#121720] ${className}`}
    >
      {canDisplay ? (
        <Image
          src={portrait.src}
          alt={portrait.alt}
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setFailedSource(portrait.src)}
        />
      ) : (
        <span className="px-2 text-center text-[0.65rem] font-semibold leading-4 text-[var(--muted)]">
          Image indisponible
        </span>
      )}
    </div>
  );
}
