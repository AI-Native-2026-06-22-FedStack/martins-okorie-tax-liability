import React from "react";
import { Navigate, Outlet } from "react-router";
import { AuthSessionReturn } from "../hooks/useAuthSession";

export type RequireAuthProps = {
  auth: AuthSessionReturn;
};

export function RequireAuth({ auth }: RequireAuthProps): React.ReactElement {
  if (!auth.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
