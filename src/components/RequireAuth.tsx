import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export default function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  // New / unauthenticated visitors land on registration by default (the sign-up
  // is the intended front door). The register page links to login for returning
  // users, and the logout button navigates to /login explicitly.
  if (!token) return <Navigate to="/register" replace />;
  return <Outlet />;
}
