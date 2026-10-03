import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ClipboardCheck,
  Clock3,
  FileText,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";

const RECENT_INSPECTIONS = [];

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("sahipack_token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-navy border-b border-white/10">
        <div className="max-w-content mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-3"
          >
            <span className="w-9 h-9 rounded-md bg-gold flex items-center justify-center">
              <span className="w-3.5 h-3.5 border-2 border-navy rounded-[2px]" />
            </span>

            <div className="text-left">
              <div className="font-display font-semibold text-cream text-lg leading-none">
                SahiPack
              </div>
              <div className="font-mono text-[9px] tracking-[0.18em] text-cream/45 mt-1">
                INSPECTOR CONSOLE
              </div>
            </div>
          </button>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-7">
            <button
              onClick={() => navigate("/dashboard")}
              className="font-mono text-xs tracking-wide text-gold"
            >
              Dashboard
            </button>

            <button
              onClick={() => navigate("/inspection")}
              className="font-mono text-xs tracking-wide text-cream/65 hover:text-cream transition-colors"
            >
              New Inspection
            </button>

            <button
              className="font-mono text-xs tracking-wide text-cream/65 hover:text-cream transition-colors"
            >
              History
            </button>

            <div className="h-5 w-px bg-white/15" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 font-mono text-xs tracking-wide text-cream/60 hover:text-gold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>

          {/* Mobile logout */}
          <button
            onClick={handleLogout}
            className="md:hidden text-cream/60 hover:text-gold"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-content mx-auto px-6 lg:px-10 py-12 lg:py-16">

        {/* INTRO */}
        <section className="relative overflow-hidden">
          {/* subtle grid */}
          <div className="absolute inset-0 opacity-[0.35] pointer-events-none">
            <div
              className="w-full h-full"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(20,43,70,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(20,43,70,0.06) 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
          </div>

          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 pb-10 border-b border-ink/10">
            <div>
              <div className="eyebrow text-teal-dark mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                Inspector workspace
              </div>

              <h1 className="font-display font-semibold text-[38px] sm:text-[48px] lg:text-[56px] leading-[1.02] text-navy max-w-3xl">
                Your inspection
                <br />
                workspace.
              </h1>

              <p className="mt-5 text-ink/60 max-w-[56ch] text-base lg:text-lg">
                Review previous inspections, continue pending verification,
                and start a new compliance assessment.
              </p>
            </div>

            <button
              onClick={() => navigate("/inspection")}
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-gold text-navy px-6 py-4 rounded-full font-semibold hover:bg-gold/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Inspection
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* OVERVIEW */}
        <section className="mt-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 border border-ink/10 bg-white rounded-xl overflow-hidden">

            <StatCard
              icon={<ClipboardCheck className="w-5 h-5" />}
              label="Total inspections"
              value="—"
              description="Inspection history"
            />

            <StatCard
              icon={<TriangleAlert className="w-5 h-5" />}
              label="Pending review"
              value="—"
              description="Requires verification"
              accent="gold"
            />

            <StatCard
              icon={<ShieldCheck className="w-5 h-5" />}
              label="Verified"
              value="—"
              description="Officer verified"
              accent="teal"
            />

            <StatCard
              icon={<FileText className="w-5 h-5" />}
              label="Reports"
              value="—"
              description="Generated reports"
            />

          </div>
        </section>

        {/* TWO COLUMN AREA */}
        <section className="mt-10 grid lg:grid-cols-[1.15fr_0.85fr] gap-8">

          {/* PENDING REVIEW */}
          <div className="rounded-xl border border-ink/10 bg-white overflow-hidden">

            <div className="px-6 py-5 border-b border-ink/10 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-teal-dark">
                  Needs your attention
                </div>

                <h2 className="font-display font-semibold text-xl text-navy mt-1">
                  Pending verification
                </h2>
              </div>

              <TriangleAlert className="w-5 h-5 text-gold-dark" />
            </div>

            <div className="p-6">
              <EmptyState
                icon={<ShieldCheck className="w-5 h-5" />}
                title="No pending inspections"
                description="Inspections requiring officer verification will appear here."
              />
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="rounded-xl bg-navy text-cream overflow-hidden">

            <div className="px-6 py-5 border-b border-white/10">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-gold">
                Quick actions
              </div>

              <h2 className="font-display font-semibold text-xl mt-1">
                Inspection tools
              </h2>
            </div>

            <div className="p-6 space-y-3">

              <ActionButton
                icon={<Plus className="w-4 h-4" />}
                title="Start new inspection"
                description="Upload a package image"
                onClick={() => navigate("/inspection")}
              />

              <ActionButton
                icon={<Clock3 className="w-4 h-4" />}
                title="Inspection history"
                description="Review previous inspections"
              />

              <ActionButton
                icon={<FileText className="w-4 h-4" />}
                title="Reports"
                description="Access generated reports"
              />

            </div>
          </div>
        </section>

        {/* RECENT INSPECTIONS */}
        <section className="mt-10">

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-5">

            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-teal-dark">
                Inspection history
              </div>

              <h2 className="font-display font-semibold text-2xl text-navy mt-1">
                Recent inspections
              </h2>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />

              <input
                type="text"
                placeholder="Search inspections..."
                className="w-full sm:w-64 bg-white border border-ink/15 rounded-md pl-9 pr-4 py-2.5 text-sm outline-none focus:border-teal transition-colors"
              />
            </div>

          </div>

          <div className="rounded-xl border border-ink/10 bg-white overflow-hidden">

            {RECENT_INSPECTIONS.length === 0 ? (
              <div className="px-6 py-16">
                <EmptyState
                  icon={<ClipboardCheck className="w-5 h-5" />}
                  title="No inspections yet"
                  description="Your completed inspections will appear here with their compliance assessment and verification status."
                  action={
                    <button
                      onClick={() => navigate("/inspection")}
                      className="mt-5 inline-flex items-center gap-2 bg-navy text-cream px-5 py-3 rounded-md font-mono text-xs tracking-wide uppercase hover:bg-navy-light transition-colors"
                    >
                      Start first inspection
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  }
                />
              </div>
            ) : (
              <div>
                {/* Future backend inspection rows */}
              </div>
            )}

          </div>
        </section>

        {/* FOOTER INFO */}
        <section className="mt-10 rounded-xl border border-ink/10 bg-white px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-teal/10 flex items-center justify-center">
              <UserRound className="w-4 h-4 text-teal-dark" />
            </span>

            <div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink/40">
                Inspector account
              </div>

              <div className="text-sm text-ink/75">
                Legal Metrology Officer
              </div>
            </div>
          </div>

          <div className="font-mono text-[10px] tracking-wide uppercase text-ink/35">
            SahiPack · Inspector Console
          </div>

        </section>

      </main>
    </div>
  );
}


/* ---------------- COMPONENTS ---------------- */

function StatCard({
  icon,
  label,
  value,
  description,
  accent = "navy",
}) {
  const iconClass =
    accent === "gold"
      ? "text-gold-dark bg-gold/10"
      : accent === "teal"
      ? "text-teal-dark bg-teal/10"
      : "text-navy bg-navy/5";

  return (
    <div className="p-6 border-b sm:border-b-0 lg:border-r border-ink/10 last:border-r-0">

      <div className="flex items-center justify-between">
        <span
          className={`w-9 h-9 rounded-md flex items-center justify-center ${iconClass}`}
        >
          {icon}
        </span>

        <span className="font-mono text-[10px] uppercase tracking-wide text-ink/30">
          LIVE
        </span>
      </div>

      <div className="mt-6">
        <div className="font-display font-semibold text-3xl text-navy">
          {value}
        </div>

        <div className="mt-1 text-sm font-medium text-ink/75">
          {label}
        </div>

        <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink/35">
          {description}
        </div>
      </div>

    </div>
  );
}


function EmptyState({
  icon,
  title,
  description,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">

      <div className="w-11 h-11 rounded-full border border-ink/10 bg-cream flex items-center justify-center text-teal-dark">
        {icon}
      </div>

      <h3 className="mt-4 font-display font-semibold text-lg text-navy">
        {title}
      </h3>

      <p className="mt-2 max-w-[42ch] text-sm text-ink/50 leading-relaxed">
        {description}
      </p>

      {action}

    </div>
  );
}


function ActionButton({
  icon,
  title,
  description,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-4 p-4 rounded-lg border border-white/10 hover:border-teal/50 hover:bg-white/5 transition-colors"
    >

      <span className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center text-teal">
        {icon}
      </span>

      <span className="flex-1">
        <span className="block text-sm font-medium text-cream">
          {title}
        </span>

        <span className="block mt-0.5 text-xs text-cream/45">
          {description}
        </span>
      </span>

      <ArrowRight className="w-4 h-4 text-cream/30" />

    </button>
  );
}