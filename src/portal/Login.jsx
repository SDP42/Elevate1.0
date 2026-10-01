import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "./api";
import useHeroCloud from "./useHeroCloud";

const TABS = [
  { key: "team", label: "Team login" },
  { key: "core", label: "Core login" },
  { key: "meal", label: "Meal login" },
  { key: "regidesk", label: "Regi desk login" },
  { key: "admin", label: "Admin login" },
];

const DASHBOARD_PATH = {
  admin: "/portal/admin",
  core: "/portal/core",
  meal: "/portal/meal",
  team: "/portal/team",
  regidesk: "/portal/regidesk",
};

/* One login form behind four tabs. The tab only changes the placeholder
   copy — it's there so a team doesn't have to guess what to type into a
   generic box, not a separate auth path. Whoever actually owns the
   account that signs in lands on their own dashboard, tab or no tab. */
export default function Login() {
  const [tab, setTab] = useState("team");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const cloudUrl = useHeroCloud();

  async function onSubmit(e) {
    e.preventDefault();
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
    <div className="portal-auth">
      {cloudUrl && <img className="portal-auth__cloud" src={cloudUrl} alt="" aria-hidden="true" />}
      <div className="portal-auth__card">
        <a className="portal-auth__back" href="/">
          ← Elevate 1.0
        </a>
        <span className="portal-auth__eyebrow">24-Hour Hackathon Portal</span>
        <h1 className="portal-auth__title">Sign in</h1>

        <div className="portal-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`portal-tabs__btn${tab === t.key ? " is-active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form className="portal-auth__form" onSubmit={onSubmit}>
          <label className="portal-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={tab === "team" ? "e.g. team07" : `e.g. ${tab}01`}
              autoComplete="username"
              required
            />
          </label>
          <label className="portal-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="portal-auth__error">{error}</p>}

          <button className="portal-auth__submit" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
