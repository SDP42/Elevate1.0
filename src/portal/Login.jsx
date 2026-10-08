import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "open-glass-ui/styles.css";
import { Button, Glass, GlassSystemProvider } from "open-glass-ui";
import { login } from "./api";
import useHeroCloud from "./useHeroCloud";
import BrandWordmark from "../components/BrandWordmark";
import "./login.css";

const ROLES = [
  { key: "team", label: "Team" },
  { key: "meal", label: "Meal" },
  { key: "regidesk", label: "Regi desk" },
  { key: "admin", label: "Admin" },
];
const DASHBOARD_PATH = { ...Object.fromEntries(ROLES.map(({ key }) => [key, `/portal/${key}`])), core: "/portal/core", superadmin: "/portal/superadmin" };

// Role buttons guide the form; the authenticated account determines access.
export default function Login() {
  const [role, setRole] = useState("team");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const cloudUrl = useHeroCloud();

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const session = await login(username.trim(), password);
      navigate(DASHBOARD_PATH[session.role] || "/portal/login", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassSystemProvider
      renderer="auto"
      theme={{ appearance: "dark", theme: { accent: "#c9a86a" }, className: "portal-login-system" }}
      toasts={false}
    >
      <main className="portal-auth portal-liquid-login">
        {cloudUrl && <img className="portal-auth__cloud" src={cloudUrl} alt="" aria-hidden="true" />}
        <div className="portal-login__halo" aria-hidden="true" />
        <Glass material="frosted" className="portal-login__card" look={{ rim: 1.2, blur: 0.85 }}>
          <a className="portal-login__logoLink" href="/" aria-label="Elevate 1.0 home">
            <BrandWordmark uppercase />
          </a>
          <span className="portal-login__eyebrow">24-hour hackathon portal</span>
          <h1 className="portal-login__title">Sign in</h1>

          <div className="portal-login__roles" role="group" aria-label="Account type">
            {ROLES.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant={role === item.key ? "primary" : "quiet"}
                className="portal-login__role"
                aria-pressed={role === item.key}
                onClick={() => setRole(item.key)}
              >{item.label}</Button>
            ))}
          </div>

          <form className="portal-login__form" onSubmit={onSubmit} aria-busy={busy}>
            <label className="portal-login__field" htmlFor="portal-username">
              <span>Username</span>
              <input
                id="portal-username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={role === "team" ? "e.g. ELEV01" : `e.g. ${role}01`}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
            <div className="portal-login__field">
              <label htmlFor="portal-password">Password</label>
              <div className="portal-login__password">
                <input
                  id="portal-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <Button
                  type="button"
                  variant="quiet"
                  size="small"
                  className="portal-login__reveal"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPassword && <path d="m3 3 18 18" />}
                  </svg>
                </Button>
              </div>
            </div>
            {error && <p className="portal-login__error" role="alert">{error}</p>}
            <Button type="submit" variant="primary" size="large" className="portal-login__submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Glass>
      </main>
    </GlassSystemProvider>
  );
}
