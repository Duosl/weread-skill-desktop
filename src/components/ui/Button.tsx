import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "small";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "default",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const sizeClass = size === "small" ? "button-small" : "";
  return (
    <button type="button" className={`button button-${variant} ${sizeClass} ${className}`} {...props}>
      {icon}
      {children ? <span>{children}</span> : null}
    </button>
  );
}
