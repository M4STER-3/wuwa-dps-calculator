import type {
  ButtonHTMLAttributes,
  DialogHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

function classes(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function V4Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={classes("v4-theme v4-page", className)}>
      <div className="v4-page__inner">{children}</div>
    </div>
  );
}

export function V4Surface({
  children,
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: "default" | "muted" | "tinted";
}) {
  return (
    <div className={classes("v4-surface", className)} data-tone={tone} {...props}>
      {children}
    </div>
  );
}

export function V4Panel({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classes("v4-surface v4-panel", className)} {...props}>
      {children}
    </div>
  );
}

export function V4Card({
  children,
  interactive = false,
  selected = false,
  disabled = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={classes("v4-card", className)}
      data-interactive={interactive || undefined}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      {...props}
    >
      {children}
    </div>
  );
}

type V4ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function V4Button({
  variant = "secondary",
  size = "md",
  type = "button",
  className,
  ...props
}: V4ButtonProps) {
  return (
    <button
      type={type}
      className={classes("v4-button", className)}
      data-variant={variant}
      data-size={size}
      {...props}
    />
  );
}

export function V4Badge({
  children,
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <span className={classes("v4-badge", className)} data-tone={tone} {...props}>
      {children}
    </span>
  );
}

export function V4Tabs({
  items,
  activeId,
  onChange,
  label,
}: {
  items: ReadonlyArray<{ id: string; label: string; disabled?: boolean }>;
  activeId: string;
  onChange?: (id: string) => void;
  label: string;
}) {
  return (
    <div className="v4-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="v4-tab"
          aria-selected={activeId === item.id}
          disabled={item.disabled}
          onClick={onChange ? () => onChange(item.id) : undefined}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function V4InputField({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  const id = props.id ?? props.name;
  return (
    <label className="v4-field">
      <span className="v4-field__label">{label}</span>
      <input className={classes("v4-input", className)} {...props} id={id} />
      {hint ? <span className="v4-field__hint">{hint}</span> : null}
    </label>
  );
}

export function V4SelectField({
  label,
  hint,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const id = props.id ?? props.name;
  return (
    <label className="v4-field">
      <span className="v4-field__label">{label}</span>
      <select className={classes("v4-select", className)} {...props} id={id}>
        {children}
      </select>
      {hint ? <span className="v4-field__hint">{hint}</span> : null}
    </label>
  );
}

export function V4Stat({
  label,
  value,
  emphasis = "normal",
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: "normal" | "strong";
}) {
  return (
    <div className="v4-stat" data-emphasis={emphasis}>
      <span className="v4-stat__label">{label}</span>
      <span className="v4-stat__value">{value}</span>
    </div>
  );
}

export function V4SelectorItem({
  title,
  meta,
  media,
  trailing,
  selected = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  meta?: string;
  media?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      className="v4-selector-item"
      aria-pressed={selected}
      {...props}
    >
      <span className="v4-selector-item__media" aria-hidden={media ? undefined : true}>
        {media ?? "WU"}
      </span>
      <span className="v4-selector-item__copy">
        <span className="v4-selector-item__title">{title}</span>
        {meta ? <span className="v4-selector-item__meta">{meta}</span> : null}
      </span>
      {trailing ? <span className="v4-selector-item__trailing">{trailing}</span> : null}
    </button>
  );
}

export function V4Notice({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  return (
    <div className="v4-notice" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <div>
        <div className="v4-notice__title">{title}</div>
        <div className="v4-notice__body">{children}</div>
      </div>
    </div>
  );
}

export function V4EmptyState({
  icon = "+",
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="v4-empty-state">
      <div>
        <div className="v4-empty-state__icon" aria-hidden="true">{icon}</div>
        <h3 className="v4-empty-state__title">{title}</h3>
        {children ? <div className="v4-empty-state__body">{children}</div> : null}
      </div>
    </div>
  );
}

export function V4Skeleton({
  width = "100%",
  height = 12,
  className,
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <span
      className={classes("v4-skeleton", className)}
      style={{ width, height, display: "block" }}
      aria-hidden="true"
    />
  );
}

export function V4Divider() {
  return <hr className="v4-divider" />;
}

export function V4SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="v4-section-header">
      <div className="v4-section-header__copy">
        {eyebrow ? <p className="v4-eyebrow">{eyebrow}</p> : null}
        <h2 className="v4-section-header__title">{title}</h2>
        {description ? <p className="v4-section-header__description">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function V4Dialog({
  title,
  children,
  footer,
  className,
  ...props
}: DialogHTMLAttributes<HTMLDialogElement> & {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <dialog className={classes("v4-dialog", className)} {...props}>
      <header className="v4-dialog__header">
        <h2 className="v4-dialog__title">{title}</h2>
      </header>
      <div className="v4-dialog__body">{children}</div>
      {footer ? <footer className="v4-dialog__footer">{footer}</footer> : null}
    </dialog>
  );
}
