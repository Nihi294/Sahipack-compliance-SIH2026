import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();

      formData.append("username", email);
      formData.append("password", password);

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Invalid email or password");
      }

      localStorage.setItem("sahipack_token", data.access_token);

navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* NAVBAR */}
      <header className="bg-navy border-b border-white/10">
        <div className="max-w-content mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3"
          >
            <span className="w-10 h-10 rounded-md bg-gold flex items-center justify-center">
              <span className="w-4 h-4 border-2 border-navy rounded-sm" />
            </span>

            <div className="text-left">
              <div className="font-display font-semibold text-cream text-lg leading-none">
                SahiPack
              </div>
              <div className="font-mono text-[9px] tracking-[0.18em] text-cream/45 mt-1">
                LEGAL METROLOGY INTELLIGENCE
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/")}
            className="font-mono text-xs tracking-wide uppercase text-cream/60 hover:text-gold transition-colors"
          >
            Back to site
          </button>
        </div>
      </header>

      {/* LOGIN AREA */}
      <main className="min-h-[calc(100vh-80px)] grid lg:grid-cols-2">
        {/* LEFT — BRAND MESSAGE */}
        <section className="bg-navy text-cream px-8 lg:px-16 py-16 lg:py-24 flex items-center">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase text-gold mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              Inspector access
            </div>

            <h1 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
              Review the finding.
              <br />
              <span className="text-gold">Verify the evidence.</span>
            </h1>

            <p className="mt-7 text-cream/60 text-base lg:text-lg leading-7 max-w-lg">
              Sign in to the SahiPack inspection console to review AI-assisted
              findings, verify compliance concerns, and generate inspection
              reports.
            </p>

            <div className="mt-12 grid grid-cols-3 gap-4 max-w-lg">
              <div className="border-t border-white/15 pt-4">
                <div className="font-mono text-[10px] tracking-wide uppercase text-teal">
                  01
                </div>
                <div className="mt-2 text-sm text-cream/70">
                  Review findings
                </div>
              </div>

              <div className="border-t border-white/15 pt-4">
                <div className="font-mono text-[10px] tracking-wide uppercase text-teal">
                  02
                </div>
                <div className="mt-2 text-sm text-cream/70">
                  Verify evidence
                </div>
              </div>

              <div className="border-t border-white/15 pt-4">
                <div className="font-mono text-[10px] tracking-wide uppercase text-teal">
                  03
                </div>
                <div className="mt-2 text-sm text-cream/70">
                  Generate reports
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT — LOGIN FORM */}
        <section className="bg-cream px-6 lg:px-16 py-16 lg:py-24 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="font-mono text-xs tracking-[0.18em] uppercase text-teal-dark mb-4">
              Authorized access
            </div>

            <h2 className="font-display font-semibold text-3xl sm:text-4xl text-navy">
              Inspector login.
            </h2>

            <p className="mt-3 text-ink/55 text-sm leading-6">
              Use your registered Legal Officer credentials to continue.
            </p>

            <form onSubmit={handleLogin} className="mt-9">
              {/* EMAIL */}
              <div>
                <label className="font-mono text-[11px] tracking-wide uppercase text-ink/55">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@example.com"
                  required
                  className="mt-2 w-full bg-white border border-ink/15 rounded-md px-4 py-3.5 text-sm text-ink outline-none transition-colors focus:border-teal"
                />
              </div>

              {/* PASSWORD */}
              <div className="mt-5">
                <label className="font-mono text-[11px] tracking-wide uppercase text-ink/55">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="mt-2 w-full bg-white border border-ink/15 rounded-md px-4 py-3.5 text-sm text-ink outline-none transition-colors focus:border-teal"
                />
              </div>

              {/* ERROR */}
              {error && (
                <div className="mt-5 border border-red-500/25 bg-red-50 rounded-md px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={loading}
                className="mt-7 w-full bg-gold text-navy font-mono text-xs tracking-wide uppercase px-5 py-4 rounded-md hover:bg-gold/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign in →"}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-ink/10">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-teal mt-1.5 shrink-0" />

                <p className="font-mono text-[10px] leading-5 tracking-wide uppercase text-ink/40">
                  Authorized Legal Officer access only.
                  <br />
                  AI findings require human verification.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}