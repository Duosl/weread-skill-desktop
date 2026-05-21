import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "neutral" | "primary" | "danger";
type IconButtonSize = "default" | "small";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  icon: ReactNode;
};

export function IconButton({
  variant = "neutral",
  size = "default",
  icon,
  className = "",
  ...props
}: IconButtonProps) {
  const sizeClass = size === "small" ? "icon-button-small" : "";

  return (
    <button
      className={`icon-button icon-button-${variant} ${sizeClass} ${className}`}
      type="button"
      {...props}
    >
      {icon}
    </button>
  );
}
