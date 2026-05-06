import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import client from "../api/client";
import useChildren from "../hooks/useChildren";

export default function Layout() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  useChildren();

  async function handleLogout() {
    await client.POST("/auth/logout");
    logout();
    navigate("/login");
  }

  return (
    <div>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {token ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>Junior tracker</span>
              <button type="button" onClick={() => navigate("/chart")}>
                Chart
              </button>
              <button type="button" onClick={() => navigate("/add-event")}>
                Add event
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" onClick={() => navigate("/child-settings")}>
                Settings
              </button>
              <button type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
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
