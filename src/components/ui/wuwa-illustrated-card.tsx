import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  CSSProperties,
  ReactNode,
} from "react";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type WuwaIllustratedCardKind = "resonator" | "weapon" | "echo";
export type WuwaIllustratedCardDensity = "gallery" | "standard" | "feature";

export interface WuwaIllustratedCardMeta {
  label: string;
  value: ReactNode;
}

interface IllustratedCardContentProps {
  kind: WuwaIllustratedCardKind;
  density?: WuwaIllustratedCardDensity;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  media?: ReactNode;
  cornerLabel?: ReactNode;
  badges?: readonly ReactNode[];
  meta?: readonly WuwaIllustratedCardMeta[];
  footer?: ReactNode;
  selected?: boolean;
  unavailable?: boolean;
}

const fallbackMark: Record<WuwaIllustratedCardKind, string> = {
  resonator: "R",
  weapon: "W",
  echo: "E",
};

function IllustratedCardContent({
  kind,
  density = "standard",
  title,
  subtitle,
  eyebrow,
  media,
  cornerLabel,
  badges,
  meta,
  footer,
  selected = false,
  unavailable = false,
}: IllustratedCardContentProps) {
  return (
    <>
      <span className="wuwa-illustrated-card__media" aria-hidden={media ? undefined : true}>
        {media ?? (
          <span className="wuwa-illustrated-card__fallback" aria-hidden="true">
            <span className="wuwa-illustrated-card__fallback-mark">{fallbackMark[kind]}</span>
            <span className="wuwa-illustrated-card__fallback-copy">Artwork</span>
          </span>
        )}
        <span className="wuwa-illustrated-card__media-shade" aria-hidden="true" />
        <span className="wuwa-illustrated-card__frame" aria-hidden="true" />
        {cornerLabel ? (
          <span className="wuwa-illustrated-card__corner wuwa-type-data">{cornerLabel}</span>
        ) : null}
        {selected ? (
          <span className="wuwa-illustrated-card__selected-mark" aria-hidden="true">
            ◆
          </span>
        ) : null}
      </span>

      <span className="wuwa-illustrated-card__body">
        <span className="wuwa-illustrated-card__identity">
          {eyebrow ? (
            <span className="wuwa-illustrated-card__eyebrow wuwa-type-eyebrow">{eyebrow}</span>
          ) : null}
          <span className="wuwa-illustrated-card__title wuwa-type-card-title">{title}</span>
          {subtitle ? (
            <span className="wuwa-illustrated-card__subtitle wuwa-type-small">{subtitle}</span>
          ) : null}
        </span>

        {badges?.length ? (
          <span className="wuwa-illustrated-card__badges">
            {badges.map((badge, index) => (
              <span className="wuwa-illustrated-card__badge" key={index}>
                {badge}
              </span>
            ))}
          </span>
        ) : null}

        {meta?.length && density !== "gallery" ? (
          <span className="wuwa-illustrated-card__meta">
            {meta.map((item) => (
              <span className="wuwa-illustrated-card__meta-row" key={item.label}>
                <span className="wuwa-illustrated-card__meta-label wuwa-type-micro">
                  {item.label}
                </span>
                <span className="wuwa-illustrated-card__meta-value wuwa-type-data">
                  {item.value}
                </span>
              </span>
            ))}
          </span>
        ) : null}

        {footer && density === "feature" ? (
          <span className="wuwa-illustrated-card__footer">{footer}</span>
        ) : null}

        {unavailable ? (
          <span className="wuwa-illustrated-card__unavailable wuwa-type-micro">
            Indisponible
          </span>
        ) : null}
      </span>
    </>
  );
}

export function WuwaIllustratedCard({
  kind,
  density = "standard",
  selected = false,
  unavailable = false,
  className,
  title,
  subtitle,
  eyebrow,
  media,
  cornerLabel,
  badges,
  meta,
  footer,
  ...props
}: Omit<ComponentPropsWithoutRef<"article">, "title"> & IllustratedCardContentProps) {
  return (
    <article
      {...props}
      className={classes(
        "wuwa-illustrated-card",
        `wuwa-illustrated-card--${kind}`,
        `wuwa-illustrated-card--${density}`,
        selected && "wuwa-illustrated-card--selected",
        unavailable && "wuwa-illustrated-card--unavailable",
        className,
      )}
      data-kind={kind}
      data-selected={selected ? "true" : undefined}
    >
      <IllustratedCardContent
        kind={kind}
        density={density}
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        media={media}
        cornerLabel={cornerLabel}
        badges={badges}
        meta={meta}
        footer={footer}
        selected={selected}
        unavailable={unavailable}
      />
    </article>
  );
}

export function WuwaIllustratedCardButton({
  kind,
  density = "standard",
  selected = false,
  unavailable = false,
  className,
  title,
  subtitle,
  eyebrow,
  media,
  cornerLabel,
  badges,
  meta,
  footer,
  type = "button",
  disabled,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & IllustratedCardContentProps) {
  const isDisabled = disabled || unavailable;

  return (
    <button
      {...props}
      type={type}
      disabled={isDisabled}
      aria-pressed={selected}
      className={classes(
        "wuwa-illustrated-card",
        "wuwa-illustrated-card--button",
        `wuwa-illustrated-card--${kind}`,
        `wuwa-illustrated-card--${density}`,
        selected && "wuwa-illustrated-card--selected",
        unavailable && "wuwa-illustrated-card--unavailable",
        className,
      )}
      data-kind={kind}
      data-selected={selected ? "true" : undefined}
    >
      <IllustratedCardContent
        kind={kind}
        density={density}
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        media={media}
        cornerLabel={cornerLabel}
        badges={badges}
        meta={meta}
        footer={footer}
        selected={selected}
        unavailable={unavailable}
      />
    </button>
  );
}

export function WuwaIllustratedCardGrid({
  minCardWidth = "160px",
  className,
  style,
  ...props
}: ComponentPropsWithoutRef<"div"> & { minCardWidth?: string }) {
  return (
    <div
      {...props}
      className={classes("wuwa-illustrated-card-grid", className)}
      style={{
        ...style,
        "--wuwa-illustrated-grid-min": minCardWidth,
      } as CSSProperties}
    />
  );
}
