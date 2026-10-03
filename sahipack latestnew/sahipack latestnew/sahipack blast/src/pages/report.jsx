import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  FileDown,
  FileText,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("sahipack_token");
}

function statusLabel(status) {
  switch (String(status || "").toUpperCase()) {
    case "COMPLIANT":
      return "Compliant";

    case "POTENTIAL_VIOLATION":
      return "Potential violation";

    case "NEEDS_VERIFICATION":
      return "Needs verification";

    case "NOT_APPLICABLE":
      return "Not applicable";

    default:
      return status || "Unknown";
  }
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "COMPLIANT") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wide text-teal-dark">
        <CircleCheck className="h-3.5 w-3.5" />
        Compliant
      </span>
    );
  }

  if (normalized === "POTENTIAL_VIOLATION") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wide text-gold-dark">
        <TriangleAlert className="h-3.5 w-3.5" />
        Potential violation
      </span>
    );
  }

  if (normalized === "NEEDS_VERIFICATION") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wide text-gold-dark">
        <FileText className="h-3.5 w-3.5" />
        Needs verification
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wide text-ink/50">
      {statusLabel(status)}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export default function Report() {
  const navigate = useNavigate();
  const { inspectionId } = useParams();

  const [inspection, setInspection] = useState(null);
  const [findings, setFindings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [downloading, setDownloading] = useState("");

  const [error, setError] = useState("");

  // FINAL OFFICER COMMENT
  const [remarks, setRemarks] = useState("");

  // FINAL INSPECTION OUTCOME
  const [finalOutcome, setFinalOutcome] = useState("");

  async function apiFetch(url, options = {}) {
    const token = getToken();

    if (!token) {
      navigate("/login");
      throw new Error("Your session has expired. Please sign in again.");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      let detail = `Request failed (${response.status})`;

      if (typeof data?.detail === "string") {
        detail = data.detail;
      } else if (data?.detail) {
        detail = JSON.stringify(data.detail);
      }

      throw new Error(detail);
    }

    return data;
  }

  async function loadReportData() {
    setLoading(true);
    setError("");

    try {
      const [inspectionData, findingsData] = await Promise.all([
        apiFetch(`${API_BASE}/api/inspections/${inspectionId}`),
        apiFetch(`${API_BASE}/api/inspections/${inspectionId}/findings`),
      ]);

      setInspection(inspectionData);

      const loadedFindings = Array.isArray(findingsData)
        ? findingsData
        : findingsData?.findings || [];

      setFindings(loadedFindings);

      // Restore final remarks/outcome if inspection was already finalized.
      setRemarks(
        inspectionData?.final_remarks ||
          inspectionData?.finalRemarks ||
          ""
      );

      setFinalOutcome(
        inspectionData?.final_outcome ||
          inspectionData?.finalOutcome ||
          ""
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load inspection report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!inspectionId) return;

    loadReportData();
  }, [inspectionId]);

  /*
   * IMPORTANT:
   *
   * Only NEEDS_VERIFICATION findings require human review.
   *
   * COMPLIANT findings do NOT appear here.
   *
   * POTENTIAL_VIOLATION findings are shown in the AI assessment,
   * but they do not block finalization in this workflow unless
   * the backend explicitly sends them as NEEDS_VERIFICATION.
   */
  const verificationRequired = useMemo(() => {
    return findings.filter((finding) => {
      const status = String(
        finding.status || finding.original_ai_status || ""
      ).toUpperCase();

      return (
        finding.source === "AI" &&
        status === "NEEDS_VERIFICATION"
      );
    });
  }, [findings]);

  const pendingVerification = useMemo(() => {
    return verificationRequired.filter((finding) => {
      return !finding.officer_decision;
    });
  }, [verificationRequired]);

  const reviewedVerification = useMemo(() => {
    return verificationRequired.filter((finding) => {
      return Boolean(finding.officer_decision);
    });
  }, [verificationRequired]);

  const verificationComplete =
    pendingVerification.length === 0;

  const counts = useMemo(() => {
    const result = {
      compliant: 0,
      potentialViolation: 0,
      needsVerification: 0,
      notApplicable: 0,
    };

    findings.forEach((finding) => {
      const status = String(
        finding.status || finding.original_ai_status || ""
      ).toUpperCase();

      if (status === "COMPLIANT") {
        result.compliant += 1;
      } else if (status === "POTENTIAL_VIOLATION") {
        result.potentialViolation += 1;
      } else if (status === "NEEDS_VERIFICATION") {
        result.needsVerification += 1;
      } else if (status === "NOT_APPLICABLE") {
        result.notApplicable += 1;
      }
    });

    return result;
  }, [findings]);

  async function finalizeInspection() {
    if (!verificationComplete) {
      setError(
        `Review the remaining ${pendingVerification.length} finding(s) marked NEEDS VERIFICATION before finalizing.`
      );
      return;
    }

    if (!finalOutcome) {
      setError("Select a final inspection outcome.");
      return;
    }

    setFinalizing(true);
    setError("");

    try {
      /*
       * Backend endpoint:
       * POST /api/inspections/{inspection_id}/verify
       *
       * final_remarks is optional.
       */
      const data = await apiFetch(
        `${API_BASE}/api/inspections/${inspectionId}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            final_outcome: finalOutcome,
            final_remarks: remarks.trim() || null,
          }),
        }
      );

      setInspection(data);

      // Reload so report state is definitely synchronized
      // with the backend.
      await loadReportData();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to finalize the inspection."
      );
    } finally {
      setFinalizing(false);
    }
  }

  async function downloadReport(type) {
    if (!inspection?.status || inspection.status !== "VERIFIED") {
      setError(
        "Finalize the inspection before downloading the officer-verified report."
      );
      return;
    }

    const token = getToken();

    if (!token) {
      navigate("/login");
      return;
    }

    setDownloading(type);
    setError("");

    try {
      const extension = type === "pdf" ? "pdf" : "docx";

      const response = await fetch(
        `${API_BASE}/api/inspections/${inspectionId}/final-report/${extension}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let detail = `Unable to download ${extension.toUpperCase()}.`;

        try {
          const data = await response.json();

          if (typeof data?.detail === "string") {
            detail = data.detail;
          } else if (data?.detail) {
            detail = JSON.stringify(data.detail);
          }
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(detail);
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `inspection-${inspectionId}-report.${extension}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(
        err.message || `Unable to download ${type.toUpperCase()}.`
      );
    } finally {
      setDownloading("");
    }
  }

  function goBack() {
    navigate("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream text-ink">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-navy">
          <div className="mx-auto flex h-20 max-w-content items-center justify-between px-6 lg:px-10">
            <button
              onClick={goBack}
              className="flex items-center gap-3 text-cream/70 transition-colors hover:text-gold"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-mono text-xs uppercase tracking-wide">
                Dashboard
              </span>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold">
                <span className="h-4 w-4 rounded-sm border-2 border-navy" />
              </div>

              <div>
                <div className="font-display text-lg font-semibold text-cream">
                  SahiPack
                </div>
                <div className="font-mono text-[8px] tracking-[0.18em] text-cream/40">
                  INSPECTOR CONSOLE
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex min-h-[calc(100vh-80px)] items-center justify-center">
          <div className="flex items-center gap-3 text-navy">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-mono text-xs uppercase tracking-widest">
              Loading inspection
            </span>
          </div>
        </main>
      </div>
    );
  }

  if (error && !inspection) {
    return (
      <div className="min-h-screen bg-cream text-ink">
        <header className="border-b border-white/10 bg-navy">
          <div className="mx-auto flex h-20 max-w-content items-center px-6 lg:px-10">
            <button
              onClick={goBack}
              className="flex items-center gap-3 text-cream/70 transition-colors hover:text-gold"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-mono text-xs uppercase tracking-wide">
                Dashboard
              </span>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-20">
          <div className="rounded-xl border border-red-500/20 bg-red-50 p-6 text-red-600">
            {error}
          </div>
        </main>
      </div>
    );
  }

  const isVerified =
    inspection?.status === "VERIFIED";

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy">
        <div className="mx-auto flex h-20 max-w-content items-center justify-between px-6 lg:px-10">
          <button
            onClick={goBack}
            className="flex items-center gap-3 text-cream/70 transition-colors hover:text-gold"
          >
            <ArrowLeft className="h-5 w-5" />

            <span className="font-mono text-xs uppercase tracking-wide">
              Dashboard
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold">
              <span className="h-4 w-4 rounded-sm border-2 border-navy" />
            </div>

            <div>
              <div className="font-display text-lg font-semibold text-cream">
                SahiPack
              </div>

              <div className="font-mono text-[8px] tracking-[0.18em] text-cream/40">
                INSPECTOR CONSOLE
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-content px-6 py-10 lg:px-10 lg:py-14">
        {/* PAGE INTRO */}
        <section className="mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-dark">
            Officer-verified compliance report
          </div>

          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-4xl font-semibold leading-tight text-navy sm:text-5xl">
                Final inspection.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/55">
                Review the AI screening summary, complete any required
                verification, and finalize the inspection before generating
                the officer-verified report.
              </p>
            </div>

            <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
              Inspection #{inspectionId}
            </div>
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div className="mb-8 rounded-md border border-red-500/20 bg-red-50 px-5 py-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* PRODUCT SUMMARY */}
        <section className="mb-8 grid gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 md:grid-cols-4">
          <div className="bg-white p-6">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
              Product
            </div>

            <div className="mt-3 font-display text-xl font-semibold text-navy">
              {inspection?.product?.name ||
                inspection?.product?.brand ||
                "Package inspection"}
            </div>
          </div>

          <div className="bg-white p-6">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
              Inspection
            </div>

            <div className="mt-3 font-display text-xl font-semibold text-navy">
              #{inspectionId}
            </div>
          </div>

          <div className="bg-white p-6">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
              Findings
            </div>

            <div className="mt-3 font-display text-xl font-semibold text-navy">
              {findings.length}
            </div>
          </div>

          <div className="bg-white p-6">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
              Status
            </div>

            <div className="mt-3">
              {isVerified ? (
                <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-teal-dark">
                  <Check className="h-4 w-4" />
                  Verified
                </span>
              ) : (
                <span className="font-mono text-xs uppercase tracking-wide text-gold-dark">
                  Review in progress
                </span>
              )}
            </div>
          </div>
        </section>

        {/* SCREENING SUMMARY */}
        <section className="mb-10">
          <div className="mb-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-dark">
              Assessment summary
            </div>

            <h2 className="mt-2 font-display text-3xl font-semibold text-navy">
              Rule screening results.
            </h2>
          </div>

          <div className="grid overflow-hidden rounded-xl border border-ink/10 bg-white md:grid-cols-4">
            <div className="border-b border-ink/10 p-6 md:border-b-0 md:border-r">
              <CircleCheck className="h-6 w-6 text-teal-dark" />

              <div className="mt-7 font-display text-4xl font-semibold text-navy">
                {counts.compliant}
              </div>

              <div className="mt-1 text-sm text-ink/50">
                Compliant
              </div>
            </div>

            <div className="border-b border-ink/10 p-6 md:border-b-0 md:border-r">
              <TriangleAlert className="h-6 w-6 text-gold-dark" />

              <div className="mt-7 font-display text-4xl font-semibold text-navy">
                {counts.potentialViolation}
              </div>

              <div className="mt-1 text-sm text-ink/50">
                Potential violation
              </div>
            </div>

            <div className="border-b border-ink/10 p-6 md:border-b-0 md:border-r">
              <FileText className="h-6 w-6 text-gold-dark" />

              <div className="mt-7 font-display text-4xl font-semibold text-navy">
                {counts.needsVerification}
              </div>

              <div className="mt-1 text-sm text-ink/50">
                Needs verification
              </div>
            </div>

            <div className="p-6">
              <X className="h-6 w-6 text-ink/30" />

              <div className="mt-7 font-display text-4xl font-semibold text-navy">
                {counts.notApplicable}
              </div>

              <div className="mt-1 text-sm text-ink/50">
                Not applicable
              </div>
            </div>
          </div>
        </section>

        {/* VERIFICATION STATUS */}
        {!isVerified && (
          <section className="mb-10">
            <div className="rounded-xl bg-navy p-7 text-cream lg:p-9">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
                    Human verification
                  </div>

                  <h2 className="mt-2 font-display text-2xl font-semibold">
                    {pendingVerification.length === 0
                      ? "Verification complete."
                      : `${pendingVerification.length} finding${
                          pendingVerification.length === 1 ? "" : "s"
                        } require review.`}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-cream/55">
                    Only findings identified by the AI as{" "}
                    <strong className="font-medium text-cream/80">
                      NEEDS VERIFICATION
                    </strong>{" "}
                    require officer review. Compliant findings do not need
                    to be manually reviewed.
                  </p>
                </div>

                <div className="shrink-0">
                  {verificationComplete ? (
                    <div className="flex items-center gap-2 rounded-md bg-teal/15 px-4 py-3 font-mono text-[10px] uppercase tracking-wide text-teal">
                      <ShieldCheck className="h-4 w-4" />
                      Ready to finalize
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        navigate(
                          `/inspection/${inspectionId}/findings`
                        )
                      }
                      className="flex items-center gap-2 rounded-md bg-gold px-5 py-3.5 font-mono text-xs uppercase tracking-wide text-navy transition-colors hover:bg-gold/90"
                    >
                      Review findings
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* REVIEWED FINDINGS */}
        {reviewedVerification.length > 0 && (
          <section className="mb-10">
            <div className="mb-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-dark">
                Officer verification record
              </div>

              <h2 className="mt-2 font-display text-3xl font-semibold text-navy">
                Reviewed findings.
              </h2>
            </div>

            <div className="space-y-3">
              {reviewedVerification.map((finding, index) => (
                <div
                  key={finding.finding_id || finding.id || index}
                  className="rounded-xl border border-ink/10 bg-white p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
                        Finding {finding.finding_number || index + 1}
                      </div>

                      <h3 className="mt-1 font-display text-lg font-semibold text-navy">
                        {finding.title || "Compliance finding"}
                      </h3>

                      {finding.applicable_rule && (
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-teal-dark">
                          {finding.applicable_rule}
                        </div>
                      )}
                    </div>

                    <StatusBadge
                      status={
                        finding.status ||
                        finding.original_ai_status
                      }
                    />
                  </div>

                  {finding.officer_decision && (
                    <div className="mt-5 border-t border-ink/10 pt-4">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
                        Officer decision
                      </div>

                      <div className="mt-1 text-sm font-medium text-navy">
                        {finding.officer_decision ===
                        "CONFIRM_VIOLATION"
                          ? "Violation"
                          : finding.officer_decision ===
                            "KEEP_COMPLIANT"
                          ? "Compliant"
                          : finding.officer_decision ===
                            "DISMISS_CONCERN"
                          ? "Concern dismissed"
                          : finding.officer_decision ===
                            "NEEDS_FURTHER_INSPECTION"
                          ? "Needs further verification"
                          : finding.officer_decision}
                      </div>
                    </div>
                  )}

                  {finding.officer_comment && (
                    <div className="mt-4">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
                        Officer comment
                      </div>

                      <p className="mt-1 text-sm leading-6 text-ink/65">
                        {finding.officer_comment}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FINALIZE */}
        {!isVerified && verificationComplete && (
          <section className="mb-10">
            <div className="rounded-xl bg-navy p-7 text-cream lg:p-10">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
                Finalize inspection
              </div>

              <h2 className="mt-2 font-display text-3xl font-semibold">
                Complete the officer record.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/55">
                Add an optional final comment if the officer identified
                something the AI missed, misunderstood, or did not fully
                capture. This comment will be included in the final report.
              </p>

              {/* FINAL OUTCOME */}
              <div className="mt-8">
                <label className="font-mono text-[10px] uppercase tracking-widest text-cream/45">
                  Final inspection outcome
                </label>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setFinalOutcome("COMPLIANT")}
                    className={`rounded-md border px-4 py-4 text-left transition-colors ${
                      finalOutcome === "COMPLIANT"
                        ? "border-teal bg-teal/15 text-cream"
                        : "border-white/15 bg-white/5 text-cream/60 hover:border-teal/50"
                    }`}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-wide">
                      Compliant
                    </div>

                    <div className="mt-1 text-xs text-cream/45">
                      No officer-confirmed violation in the final record.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFinalOutcome("NON_COMPLIANT")
                    }
                    className={`rounded-md border px-4 py-4 text-left transition-colors ${
                      finalOutcome === "NON_COMPLIANT"
                        ? "border-gold bg-gold/15 text-cream"
                        : "border-white/15 bg-white/5 text-cream/60 hover:border-gold/50"
                    }`}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-wide">
                      Non-compliant
                    </div>

                    <div className="mt-1 text-xs text-cream/45">
                      Officer confirms a compliance concern.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFinalOutcome(
                        "REQUIRES_FURTHER_INSPECTION"
                      )
                    }
                    className={`rounded-md border px-4 py-4 text-left transition-colors ${
                      finalOutcome ===
                      "REQUIRES_FURTHER_INSPECTION"
                        ? "border-gold bg-gold/15 text-cream"
                        : "border-white/15 bg-white/5 text-cream/60 hover:border-gold/50"
                    }`}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-wide">
                      Further inspection
                    </div>

                    <div className="mt-1 text-xs text-cream/45">
                      More physical or documentary verification is needed.
                    </div>
                  </button>
                </div>
              </div>

              {/* FINAL OFFICER COMMENT */}
              <div className="mt-8">
                <label className="font-mono text-[10px] uppercase tracking-widest text-cream/45">
                  Final officer comment
                  <span className="ml-2 text-cream/25">
                    optional
                  </span>
                </label>

                <textarea
                  value={remarks}
                  onChange={(event) =>
                    setRemarks(event.target.value)
                  }
                  rows={6}
                  placeholder="Record an issue the AI missed, incorrectly assessed, or did not fully capture."
                  className="mt-3 w-full resize-y rounded-md border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-cream outline-none transition-colors placeholder:text-cream/25 focus:border-teal"
                />
              </div>

              {/* FINALIZE BUTTON */}
              <div className="mt-7 flex flex-col gap-4 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal" />

                  <p className="max-w-lg font-mono text-[9px] uppercase leading-5 tracking-wide text-cream/35">
                    AI screening remains distinct from the officer's final
                    inspection decision.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={finalizeInspection}
                  disabled={
                    finalizing ||
                    !verificationComplete ||
                    !finalOutcome
                  }
                  className="flex shrink-0 items-center justify-center gap-3 rounded-md bg-gold px-7 py-4 font-mono text-xs uppercase tracking-wide text-navy transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {finalizing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      Finalize inspection
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* FINALIZED STATE */}
        {isVerified && (
          <section className="mb-10">
            <div className="rounded-xl bg-navy p-7 text-cream lg:p-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal">
                    Officer-verified inspection
                  </div>

                  <h2 className="mt-2 font-display text-3xl font-semibold">
                    Inspection finalized.
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/55">
                    The inspection has been finalized and the officer-verified
                    report is now available for export.
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-teal">
                  <Check className="h-5 w-5" />
                  Verified
                </div>
              </div>

              {inspection?.verified_at && (
                <div className="mt-7 border-t border-white/10 pt-5 font-mono text-[9px] uppercase tracking-wide text-cream/35">
                  Verified {formatDate(inspection.verified_at)}
                </div>
              )}
            </div>
          </section>
        )}

        {/* DOWNLOADS */}
        {isVerified && (
          <section className="mb-12">
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => downloadReport("pdf")}
                disabled={downloading === "pdf"}
                className="group flex min-h-[120px] items-center justify-between rounded-xl bg-gold p-6 text-left text-navy transition-colors hover:bg-gold/90 disabled:cursor-wait disabled:opacity-60"
              >
                <div className="flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-md bg-navy/10">
                    {downloading === "pdf" ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <FileDown className="h-6 w-6" />
                    )}
                  </div>

                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest opacity-60">
                      Export
                    </div>

                    <div className="mt-1 font-display text-2xl font-semibold">
                      Download PDF
                    </div>
                  </div>
                </div>

                <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={() => downloadReport("docx")}
                disabled={downloading === "docx"}
                className="group flex min-h-[120px] items-center justify-between rounded-xl border border-ink/10 bg-white p-6 text-left text-navy transition-colors hover:border-teal disabled:cursor-wait disabled:opacity-60"
              >
                <div className="flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-md bg-teal/10">
                    {downloading === "docx" ? (
                      <Loader2 className="h-6 w-6 animate-spin text-teal-dark" />
                    ) : (
                      <FileText className="h-6 w-6 text-teal-dark" />
                    )}
                  </div>

                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-ink/35">
                      Editable
                    </div>

                    <div className="mt-1 font-display text-2xl font-semibold">
                      Download DOCX
                    </div>
                  </div>
                </div>

                <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </section>
        )}

        {/* FINAL COMMENT DISPLAY */}
        {isVerified && inspection?.final_remarks && (
          <section className="mb-12">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-dark">
              Final officer comment
            </div>

            <div className="mt-4 rounded-xl border border-ink/10 bg-white p-6">
              <p className="text-sm leading-7 text-ink/65">
                {inspection.final_remarks}
              </p>
            </div>
          </section>
        )}

        {/* FOOTER NOTE */}
        <div className="border-t border-ink/10 py-8">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-dark" />

            <p className="max-w-3xl font-mono text-[9px] uppercase leading-5 tracking-wide text-ink/35">
              SahiPack records AI screening separately from officer
              verification. The officer-verified report reflects the
              inspection record finalized by the authorized officer.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}