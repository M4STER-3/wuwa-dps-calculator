import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type WuwaPanelTone =
  | "paper"
  | "paper-raised"
  | "paper-muted"
  | "ink"
  | "ink-soft";

function surfaceClasses(tone: WuwaPanelTone, compact: boolean, className?: string) {
  return classes(
    "wuwa-panel",
    `wuwa-panel--${tone}`,
    compact && "wuwa-panel--compact",
    className,
  );
}

export function WuwaPanel({
  tone = "paper",
  compact = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  tone?: WuwaPanelTone;
  compact?: boolean;
}) {
  return <section className={surfaceClasses(tone, compact, className)} {...props} />;
}

export function WuwaCard({
  tone = "paper-raised",
  compact = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"article"> & {
  tone?: WuwaPanelTone;
  compact?: boolean;
}) {
  return (
    <article
      className={surfaceClasses(tone, compact, classes("wuwa-card", className))}
      {...props}
    />
  );
}

export type WuwaButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type WuwaControlSize = "sm" | "md" | "lg";

export function WuwaButton({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: WuwaButtonVariant;
  size?: WuwaControlSize;
}) {
  return (
    <button
      {...props}
      type={type}
      className={classes(
        "wuwa-button",
        `wuwa-button--${variant}`,
        `wuwa-control--${size}`,
        className,
      )}
    />
  );
}

export type WuwaBadgeTone =
  | "neutral"
  | "gold"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "inverted";

export function WuwaBadge({
  tone = "neutral",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { tone?: WuwaBadgeTone }) {
  return (
    <span
      {...props}
      className={classes("wuwa-badge", `wuwa-badge--${tone}`, className)}
    />
  );
}

export function WuwaTabs({
  label,
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & { label: string }) {
  return (
    <div
      {...props}
      role="tablist"
      aria-label={label}
      className={classes("wuwa-tabs", className)}
    />
  );
}

export function WuwaTab({
  active = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      role="tab"
      aria-selected={active}
      className={classes("wuwa-tab", active && "wuwa-tab--active", className)}
    />
  );
}

export function WuwaField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes("wuwa-field", className)}>
      <label className="wuwa-field__label wuwa-type-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="wuwa-field__error wuwa-type-small" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="wuwa-field__hint wuwa-type-small">{hint}</span>
      ) : null}
    </div>
  );
}

export function WuwaInput({
  controlSize = "md",
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { controlSize?: WuwaControlSize }) {
  return (
    <input
      {...props}
      className={classes("wuwa-input", `wuwa-control--${controlSize}`, className)}
    />
  );
}

export function WuwaSelect({
  controlSize = "md",
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  controlSize?: WuwaControlSize;
  children: ReactNode;
}) {
  return (
    <select
      {...props}
      className={classes("wuwa-select", `wuwa-control--${controlSize}`, className)}
    >
      {children}
    </select>
  );
}

export function WuwaStatRow({
  label,
  value,
  meta,
  emphasis = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={classes(
        "wuwa-stat-row",
        emphasis && "wuwa-stat-row--emphasis",
        className,
      )}
    >
      <span className="wuwa-stat-row__label wuwa-type-body">{label}</span>
      <span className="wuwa-stat-row__value wuwa-type-data">{value}</span>
      {meta ? <span className="wuwa-stat-row__meta wuwa-type-small">{meta}</span> : null}
    </div>
  );
}

export function WuwaDivider({
  inset = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"hr"> & { inset?: boolean }) {
  return (
    <hr
      {...props}
      className={classes("wuwa-divider", inset && "wuwa-divider--inset", className)}
    />
  );
}

export function WuwaTooltip({
  content,
  children,
  className,
}: {
  content: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={classes("wuwa-tooltip", className)}
      data-tooltip={content}
      title={content}
      tabIndex={0}
    >
      {children}
    </span>
  );
}

export function WuwaSectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={classes("wuwa-section-header", className)}>
      <div className="wuwa-section-header__copy">
        {eyebrow ? <span className="wuwa-type-eyebrow">{eyebrow}</span> : null}
        <h2 className="wuwa-type-section">{title}</h2>
        {description ? (
          <p className="wuwa-section-header__description wuwa-type-body">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="wuwa-section-header__actions">{actions}</div> : null}
    </header>
  );
}
