import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import client from "../api/client";

export default function Layout() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  async function handleLogout() {
    await client.POST("/auth/logout");
    logout();
    navigate("/login");
  }

  return (
    <div>
      <nav>
        {token ? (
          <>
            <Link to="/chart">Chart</Link> |{" "}
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link> | <Link to="/register">Register</Link>
          </>
        )}
      </nav>
      <hr />
      <Outlet />
    </div>
  );
}
