import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);

    const { error: err } = await client.POST("/auth/register", {
      body: {
        email: fd.get("email") as string,
        password: fd.get("password") as string,
        is_active: true,
        is_superuser: false,
        is_verified: false,
      },
    });

    if (err) {
      const detail = err.detail;
      setError(typeof detail === "string" ? detail : "Registration failed");
      return;
    }

    navigate("/login");
  }

  return (
    <div>
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
        </div>
        <div>
          <label>
            Password
            <input name="password" type="password" required minLength={3} />
          </label>
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">Register</button>
      </form>
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
