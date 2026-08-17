import Link from "next/link";
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

export type LabPanelTone = "base" | "raised" | "quiet" | "contrast" | "jade";

export function LabPanel({
  tone = "base",
  className,
  ...props
}: ComponentPropsWithoutRef<"section"> & { tone?: LabPanelTone }) {
  return (
    <section
      {...props}
      className={classes("lab-panel", tone !== "base" && `lab-panel--${tone}`, className)}
    />
  );
}

export type LabButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function LabButton({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: LabButtonVariant }) {
  return (
    <button
      {...props}
      type={type}
      className={classes("lab-button", `lab-button--${variant}`, className)}
    />
  );
}

export function LabLinkButton({
  href,
  variant = "secondary",
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
  href: string;
  variant?: Exclude<LabButtonVariant, "danger">;
}) {
  return (
    <Link
      {...props}
      href={href}
      className={classes("lab-link-button", `lab-link-button--${variant}`, className)}
    >
      {children}
    </Link>
  );
}

export type LabBadgeTone = "neutral" | "accent" | "jade" | "warning";

export function LabBadge({
  tone = "neutral",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { tone?: LabBadgeTone }) {
  return (
    <span
      {...props}
      className={classes("lab-badge", tone !== "neutral" && `lab-badge--${tone}`, className)}
    />
  );
}

export function LabMetric({
  label,
  value,
  meta,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes("lab-metric", className)}>
      <span className="lab-metric__label">{label}</span>
      <strong className="lab-metric__value">{value}</strong>
      {meta ? <span className="lab-metric__meta">{meta}</span> : null}
    </div>
  );
}

export function LabStatRow({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes("lab-stat-row", className)}>
      <span className="lab-stat-row__label">{label}</span>
      <span className="lab-stat-row__value">{value}</span>
    </div>
  );
}

export function LabTabs({
  label,
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & { label: string }) {
  return (
    <div {...props} role="tablist" aria-label={label} className={classes("lab-tabs", className)} />
  );
}

export function LabTab({
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
      className={classes("lab-tab", className)}
    />
  );
}

export function LabField({
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
    <div className={classes("lab-field", className)}>
      <label className="lab-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="lab-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="lab-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function LabInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={classes("lab-input", className)} />;
}

export function LabSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} className={classes("lab-select", className)}>
      {children}
    </select>
  );
}

export function LabTooltip({
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
      className={classes("lab-tooltip", className)}
      data-tooltip={content}
      title={content}
      tabIndex={0}
    >
      {children}
    </span>
  );
}

export function LabSkeleton({
  width = "100%",
  height = 16,
  className,
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <span
      className={classes("lab-skeleton", className)}
      style={{ display: "block", width, height }}
      aria-hidden="true"
    />
  );
}

export function LabState({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes("lab-state", className)}>
      <div>
        <h3 className="lab-state__title">{title}</h3>
        {children ? <div className="lab-state__copy">{children}</div> : null}
      </div>
    </div>
  );
}

export function LabSectionHeading({
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
    <header className={classes("lab-section-heading", className)}>
      <div>
        {eyebrow ? <p className="lab-section-heading__eyebrow">{eyebrow}</p> : null}
        <h2 className="lab-section-heading__title">{title}</h2>
        {description ? <p className="lab-section-heading__description">{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
