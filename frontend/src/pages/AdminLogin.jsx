import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from;
  const destination = typeof from === "string" &&
    (from === "/admin" || from.startsWith("/admin/")) && from !== "/admin/login"
    ? from : "/admin";

  async function login(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api("/admin/login", {
        username,
        password,
      });

      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={login}>
        <h1>Administrator Login</h1>
        <p>Sign in to manage printers, orders and pricing.</p>

        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <div className="form-error" role="alert">{error}</div>}

        <button
          className="button primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <Link to="/new" className="login-back">Back to New Print</Link>
      </form>
    </main>
  );
}
