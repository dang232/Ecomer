import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router";
import { toast } from "sonner";

import { useAuth, type Role } from "../../hooks/auth-context";

/* ------------------------------------------------------------------ */
/*  Helper: renders <Navigate> after firing a toast on mount           */
/* ------------------------------------------------------------------ */

function RedirectWithToast({
  to,
  replace,
  message,
}: {
  to: string;
  replace?: boolean;
  message: string;
}) {
  useEffect(() => {
    toast.info(message);
  }, [message]);

  return <Navigate to={to} replace={replace} />;
}

/* ------------------------------------------------------------------ */
/*  RequireAuth                                                        */
/* ------------------------------------------------------------------ */

interface RequireAuthProps {
  children: ReactNode;
  /** Redirect target while waiting for sign-in. Defaults to /login. */
  loginPath?: string;
}

export function RequireAuth({ children, loginPath = "/login" }: RequireAuthProps) {
  const { ready, authenticated } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (!ready) return null;

  if (!authenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <RedirectWithToast
        to={`${loginPath}?next=${next}`}
        replace
        message={t("auth.loginRequired", { defaultValue: "Please sign in to continue" })}
      />
    );
  }

  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/*  RequireRole                                                        */
/* ------------------------------------------------------------------ */

interface RequireRoleProps {
  role: Role;
  children?: ReactNode;
  fallbackPath?: string;
}

export function RequireRole({ role, children, fallbackPath = "/" }: RequireRoleProps) {
  const { ready, authenticated, roles } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (!ready) return null;

  if (!authenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <RedirectWithToast
        to={`/login?next=${next}`}
        replace
        message={t("auth.loginRequired", { defaultValue: "Please sign in to continue" })}
      />
    );
  }

  if (!roles.includes(role)) {
    return (
      <RedirectWithToast
        to={fallbackPath}
        replace
        message={t("auth.accessDenied", { defaultValue: "You don't have access to this page" })}
      />
    );
  }

  return <>{children}</>;
}
