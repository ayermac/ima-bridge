import React from "react";
import Mascot from "./Mascot";

type AppStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "loading" | "empty" | "success" | "error";
};

export function AppState({ icon, title, description, action, variant }: AppStateProps) {
  return (
    <div className={`app-state app-state--${variant || "empty"}`} role="status" aria-live="polite">
      <div className="app-state__icon">
        {icon ?? (variant ? <Mascot variant={variant === "loading" ? "loading" : variant} size="md" animated /> : null)}
      </div>
      <div className="app-state__title">{title}</div>
      {description && <div className="app-state__desc">{description}</div>}
      {action && <div className="app-state__action">{action}</div>}
    </div>
  );
}

export function LoadingState({
  title,
  description,
  action,
}: Omit<AppStateProps, "variant" | "icon">) {
  return (
    <AppState
      variant="loading"
      title={title}
      description={description}
      action={action}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: Omit<AppStateProps, "variant" | "icon">) {
  return (
    <AppState
      variant="empty"
      title={title}
      description={description}
      action={action}
    />
  );
}

export function SuccessState({
  title,
  description,
  action,
}: Omit<AppStateProps, "variant" | "icon">) {
  return (
    <AppState
      variant="success"
      title={title}
      description={description}
      action={action}
    />
  );
}

export function ErrorState({
  title,
  description,
  action,
}: Omit<AppStateProps, "variant" | "icon">) {
  return (
    <AppState
      variant="error"
      title={title}
      description={description}
      action={action}
    />
  );
}
