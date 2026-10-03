import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  FileSearch,
  ImagePlus,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

/*
|--------------------------------------------------------------------------
| ONLY THESE FINDINGS REQUIRE HUMAN REVIEW
|--------------------------------------------------------------------------
*/

const REVIEW_STATUS = "NEEDS_VERIFICATION";

/*
|--------------------------------------------------------------------------
| OFFICER DECISIONS
|--------------------------------------------------------------------------
*/

const DECISIONS = [
  {
    value: "CONFIRM_VIOLATION",
    label: "Violation",
    description:
      "The officer confirms that the concern represents a compliance violation.",
    icon: TriangleAlert,
  },
  {
    value: "KEEP_COMPLIANT",
    label: "Compliant",
    description:
      "The officer reviewed the evidence and does not confirm a violation.",
    icon: Check,
  },
  {
    value: "NEEDS_FURTHER_INSPECTION",
    label: "Needs verification",
    description:
      "The available evidence is insufficient and further physical inspection is required.",
    icon: FileSearch,
  },
];

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function getStatus(finding) {
  return String(
    finding?.status ||
      finding?.original_ai_status ||
      ""
  ).toUpperCase();
}

function needsHumanReview(finding) {
  return (
    finding?.source === "AI" &&
    getStatus(finding) === REVIEW_STATUS &&
    !finding?.officer_decision
  );
}

function isReviewed(finding) {
  return Boolean(
    finding?.officer_decision ||
      finding?.verified_by ||
      finding?.verified_at
  );
}

function statusLabel(status) {
  const value = String(status || "").toUpperCase();

  if (value === "COMPLIANT") return "Compliant";
  if (value === "POTENTIAL_VIOLATION") return "Potential violation";
  if (value === "NEEDS_VERIFICATION") return "Needs verification";
  if (value === "NOT_APPLICABLE") return "Not applicable";

  return value || "Assessment";
}

function StatusBadge({ status }) {
  const value = String(status || "").toUpperCase();

  if (value === "COMPLIANT") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal/10 text-teal-dark font-mono text-[9px] uppercase tracking-wide">
        <CircleCheck className="w-3.5 h-3.5" />
        Compliant
      </span>
    );
  }

  if (value === "POTENTIAL_VIOLATION") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/15 text-gold-dark font-mono text-[9px] uppercase tracking-wide">
        <TriangleAlert className="w-3.5 h-3.5" />
        Potential violation
      </span>
    );
  }

  if (value === "NEEDS_VERIFICATION") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/15 text-gold-dark font-mono text-[9px] uppercase tracking-wide">
        <FileSearch className="w-3.5 h-3.5" />
        Needs verification
      </span>
    );
  }

  return (
    <span className="inline-flex px-3 py-1.5 rounded-full bg-ink/5 text-ink/50 font-mono text-[9px] uppercase tracking-wide">
      {statusLabel(value)}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| MAIN PAGE
|--------------------------------------------------------------------------
*/

export default function ReviewFindings() {
  const navigate = useNavigate();
  const { inspectionId } = useParams();

  const [findings, setFindings] = useState([]);

  const [selectedFinding, setSelectedFinding] = useState(null);

  const [decision, setDecision] = useState("");
  const [comment, setComment] = useState("");

  const [evidence, setEvidence] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | LOAD FINDINGS
  |--------------------------------------------------------------------------
  */

  async function loadFindings() {
    const token = localStorage.getItem("sahipack_token");

    if (!token) {
      navigate("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/inspections/${inspectionId}/findings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : data.detail
            ? JSON.stringify(data.detail)
            : `Unable to load findings (${response.status})`;

        throw new Error(detail);
      }

      const loaded = Array.isArray(data)
        ? data
        : data.findings || [];

      setFindings(loaded);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to load inspection findings."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFindings();
  }, [inspectionId]);

  /*
  |--------------------------------------------------------------------------
  | FINDINGS THAT ACTUALLY NEED HUMAN REVIEW
  |--------------------------------------------------------------------------
  */

  const reviewRequiredFindings = useMemo(() => {
    return findings.filter(needsHumanReview);
  }, [findings]);

  const reviewedFindings = useMemo(() => {
    return findings.filter(
      (finding) =>
        finding.source === "AI" &&
        getStatus(finding) === REVIEW_STATUS &&
        isReviewed(finding)
    );
  }, [findings]);

  const verificationComplete =
    reviewRequiredFindings.length === 0;

  /*
  |--------------------------------------------------------------------------
  | OPEN REVIEW MODAL
  |--------------------------------------------------------------------------
  */

  function openFinding(finding) {
    setSelectedFinding(finding);

    setDecision(
      finding.officer_decision || ""
    );

    setComment(
      finding.officer_comment || ""
    );

    setEvidence(
      Array.isArray(finding.evidence)
        ? finding.evidence
        : []
    );

    setError("");
  }

  function closeFinding() {
    if (saving) return;

    setSelectedFinding(null);
    setDecision("");
    setComment("");
    setEvidence([]);
  }

  /*
  |--------------------------------------------------------------------------
  | IMAGE EVIDENCE
  |--------------------------------------------------------------------------
  */

  function handleEvidenceUpload(event) {
    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) return;

    const readers = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            resolve({
              name: file.name,
              type: file.type,
              data: reader.result,
            });
          };

          reader.onerror = reject;

          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers)
      .then((items) => {
        setEvidence((previous) => [
          ...previous,
          ...items,
        ]);
      })
      .catch((err) => {
        console.error(err);

        setError(
          "Unable to load one of the evidence photographs."
        );
      });
  }

  function removeEvidence(index) {
    setEvidence((previous) =>
      previous.filter(
        (_, itemIndex) => itemIndex !== index
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SAVE OFFICER REVIEW
  |--------------------------------------------------------------------------
  */

  async function saveReview() {
    if (!selectedFinding) return;

    if (!decision) {
      setError(
        "Select an officer decision before saving."
      );
      return;
    }

    const token = localStorage.getItem(
      "sahipack_token"
    );

    if (!token) {
      navigate("/login");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/inspections/${inspectionId}/findings/${selectedFinding.finding_id}/verify`,
        {
          method: "PATCH",

          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            officer_decision: decision,

            /*
             * COMMENT IS OPTIONAL
             */
            officer_comment:
              comment.trim() || null,

            /*
             * PHOTO EVIDENCE IS OPTIONAL
             */
            evidence,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : data.detail
            ? JSON.stringify(data.detail)
            : `Unable to save review (${response.status})`;

        throw new Error(detail);
      }

      /*
       * Reload the findings.
       * The reviewed finding will disappear from
       * the pending list automatically.
       */

      await loadFindings();

      closeFinding();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to save officer verification."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | FINAL REPORT
  |--------------------------------------------------------------------------
  */

  function continueToFinalize() {
    if (!verificationComplete) return;

    navigate(
      `/inspection/${inspectionId}/report`
    );
  }

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-teal border-t-transparent animate-spin mx-auto" />

          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
            Loading findings
          </p>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PAGE
  |--------------------------------------------------------------------------
  */

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* HEADER */}

      <header className="bg-navy border-b border-white/10">
        <div className="max-w-content mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <button
            onClick={() =>
              navigate(
                `/inspection/${inspectionId}`
              )
            }
            className="flex items-center gap-2 text-cream/70 hover:text-gold transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Analysis
          </button>

          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-md bg-gold flex items-center justify-center">
              <span className="w-3.5 h-3.5 border-2 border-navy rounded-[2px]" />
            </span>

            <div>
              <div className="font-display font-semibold text-cream leading-none">
                SahiPack
              </div>

              <div className="font-mono text-[8px] tracking-[0.16em] text-cream/40 mt-1">
                INSPECTOR CONSOLE
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-content mx-auto px-6 lg:px-10 py-12 lg:py-16">
        {/* INTRO */}

        <section>
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-teal-dark flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal" />

            Step 04 · Human verification
          </div>

          <div className="mt-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1 className="font-display font-semibold text-[42px] sm:text-[50px] lg:text-[58px] leading-[1.02] text-navy">
                Review the findings.
                <br />

                <span className="text-teal-dark">
                  Verify what needs verification.
                </span>
              </h1>

              <p className="mt-5 text-ink/60 max-w-[65ch] text-base lg:text-lg leading-7">
                Only findings identified by SahiPack as
                requiring verification are presented for
                officer review. Compliant results do not
                require manual confirmation.
              </p>
            </div>

            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
              Inspection #{inspectionId}
            </div>
          </div>
        </section>

        {/* PROGRESS */}

        <section className="mt-9">
          <div className="grid grid-cols-3 border border-ink/10 rounded-xl overflow-hidden bg-white">
            <ProgressItem
              number="01"
              title="Assessment"
              complete
            />

            <ProgressItem
              number="02"
              title="Officer verification"
              active={!verificationComplete}
              complete={verificationComplete}
            />

            <ProgressItem
              number="03"
              title="Final report"
              active={verificationComplete}
            />
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="mt-6 border border-red-500/20 bg-red-50 rounded-lg px-5 py-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* SUMMARY */}

        <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 border border-ink/10 bg-white rounded-xl overflow-hidden">
          <SummaryCard
            number={reviewRequiredFindings.length}
            label="Need verification"
            highlighted={
              reviewRequiredFindings.length > 0
            }
          />

          <SummaryCard
            number={reviewedFindings.length}
            label="Reviewed"
          />

          <SummaryCard
            number={
              findings.filter(
                (finding) =>
                  finding.source === "AI"
              ).length
            }
            label="Total AI findings"
          />
        </section>

        {/* REVIEW AREA */}

        <section className="mt-8">
          <div className="rounded-xl border border-ink/10 bg-white overflow-hidden">
            <div className="px-6 lg:px-8 py-6 border-b border-ink/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-teal-dark">
                  Officer review queue
                </div>

                <h2 className="font-display font-semibold text-2xl text-navy mt-1">
                  Findings requiring verification
                </h2>
              </div>

              <div className="font-mono text-[10px] uppercase tracking-wide text-ink/40">
                {reviewRequiredFindings.length} pending
              </div>
            </div>

            {reviewRequiredFindings.length === 0 ? (
              <div className="px-6 lg:px-10 py-16 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center">
                  <CircleCheck className="w-7 h-7 text-teal-dark" />
                </div>

                <h3 className="mt-5 font-display font-semibold text-2xl text-navy">
                  Verification complete.
                </h3>

                <p className="mt-2 max-w-xl mx-auto text-sm leading-6 text-ink/50">
                  All findings that required human
                  verification have been reviewed. You can
                  now finalize the inspection and generate
                  the officer-verified report.
                </p>

                <button
                  onClick={continueToFinalize}
                  className="mt-7 inline-flex items-center gap-2 bg-gold text-navy px-6 py-3.5 rounded-md font-mono text-xs uppercase tracking-wide hover:bg-gold/90 transition-colors"
                >
                  Finalize inspection
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="divide-y divide-ink/10">
                {reviewRequiredFindings.map(
                  (finding, index) => (
                    <button
                      key={
                        finding.finding_id ||
                        index
                      }
                      onClick={() =>
                        openFinding(finding)
                      }
                      className="w-full text-left px-6 lg:px-8 py-6 hover:bg-ink/[0.02] transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gold/15 text-gold-dark flex items-center justify-center shrink-0">
                          <FileSearch className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                            <div>
                              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/35">
                                Finding{" "}
                                {finding.finding_number ||
                                  index + 1}
                              </div>

                              <h3 className="font-display font-semibold text-lg text-navy mt-1">
                                {finding.title ||
                                  finding.category ||
                                  "Compliance finding"}
                              </h3>
                            </div>

                            <StatusBadge
                              status={getStatus(
                                finding
                              )}
                            />
                          </div>

                          {finding.applicable_rule && (
                            <div className="mt-3 font-mono text-[10px] uppercase tracking-wide text-teal-dark">
                              {finding.applicable_rule}
                            </div>
                          )}

                          <p className="mt-2 text-sm leading-6 text-ink/55 max-w-3xl">
                            {finding.description ||
                              finding.ai_description ||
                              "No assessment description available."}
                          </p>

                          <div className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-wide text-teal-dark">
                            Open officer review
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </section>

        {/* IMPORTANT LEGAL UX */}

        <section className="mt-8">
          <div className="rounded-xl bg-navy text-cream p-6 lg:p-8 flex items-start gap-4">
            <ShieldCheck className="w-5 h-5 text-teal shrink-0 mt-1" />

            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
                Officer review boundary
              </div>

              <p className="mt-2 text-sm leading-6 text-cream/55">
                SahiPack's AI assessment is a screening
                result. Human verification is requested only
                where the system identifies an item as needing
                verification. The officer's final decision is
                recorded separately from the original AI result.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* REVIEW MODAL */}

      {selectedFinding && (
        <ReviewModal
          finding={selectedFinding}
          decision={decision}
          setDecision={setDecision}
          comment={comment}
          setComment={setComment}
          evidence={evidence}
          onEvidenceUpload={handleEvidenceUpload}
          onRemoveEvidence={removeEvidence}
          saving={saving}
          onSave={saveReview}
          onClose={closeFinding}
        />
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| REVIEW MODAL
|--------------------------------------------------------------------------
*/

function ReviewModal({
  finding,
  decision,
  setDecision,
  comment,
  setComment,
  evidence,
  onEvidenceUpload,
  onRemoveEvidence,
  saving,
  onSave,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-cream shadow-2xl">
        {/* MODAL HEADER */}

        <div className="sticky top-0 z-10 bg-navy text-cream px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">
              Officer verification
            </div>

            <h2 className="font-display font-semibold text-xl mt-1">
              {finding.title ||
                finding.category ||
                "Compliance finding"}
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-cream/60 hover:text-cream hover:border-white/30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 lg:p-8">
          {/* FINDING INFORMATION */}

          <div className="flex flex-wrap gap-2">
            <StatusBadge
              status={
                finding.status ||
                finding.original_ai_status
              }
            />

            {finding.applicable_rule && (
              <span className="px-3 py-1.5 rounded-full bg-ink/5 text-ink/50 font-mono text-[9px] uppercase tracking-wide">
                {finding.applicable_rule}
              </span>
            )}
          </div>

          {/* AI ASSESSMENT */}

          <section className="mt-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal-dark">
              AI assessment
            </div>

            <div className="mt-3 rounded-xl bg-navy p-6 text-cream">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[9px] uppercase tracking-wide text-cream/40">
                  AI detection confidence
                </span>

                {finding.ai_confidence != null && (
                  <span className="font-mono text-xs text-gold">
                    {Math.round(
                      Number(
                        finding.ai_confidence
                      ) * 100
                    )}
                    %
                  </span>
                )}
              </div>

              <p className="mt-4 text-sm leading-7 text-cream/70">
                {finding.ai_description ||
                  finding.description ||
                  "No AI description available."}
              </p>
            </div>
          </section>

          {/* DECISION */}

          <section className="mt-7">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
              Officer decision
            </div>

            <div className="mt-3 grid gap-3">
              {DECISIONS.map((item) => {
                const Icon = item.icon;

                const selected =
                  decision === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      setDecision(item.value)
                    }
                    disabled={saving}
                    className={`text-left border rounded-xl p-4 transition-all ${
                      selected
                        ? "border-teal bg-teal/5 ring-1 ring-teal"
                        : "border-ink/10 bg-white hover:border-ink/25"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          selected
                            ? "bg-teal text-white"
                            : "bg-ink/5 text-ink/40"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div>
                        <div className="font-medium text-navy">
                          {item.label}
                        </div>

                        <div className="mt-1 text-xs leading-5 text-ink/45">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* COMMENT */}

          <section className="mt-7">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
                Officer comment
              </div>

              <span className="font-mono text-[9px] uppercase text-ink/30">
                Optional
              </span>
            </div>

            <textarea
              value={comment}
              onChange={(event) =>
                setComment(event.target.value)
              }
              rows={4}
              placeholder="Add a note if useful. A comment is not required."
              disabled={saving}
              className="mt-3 w-full rounded-xl border border-ink/10 bg-white px-4 py-4 text-sm text-navy placeholder:text-ink/25 resize-none outline-none focus:border-teal"
            />
          </section>

          {/* PHOTO EVIDENCE */}

          <section className="mt-7">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
                Photo evidence
              </div>

              <span className="font-mono text-[9px] uppercase text-ink/30">
                Optional
              </span>
            </div>

            <label className="mt-3 flex items-center justify-center gap-2 border border-dashed border-ink/15 rounded-xl bg-white px-5 py-6 cursor-pointer hover:border-teal transition-colors">
              <ImagePlus className="w-5 h-5 text-teal-dark" />

              <span className="font-mono text-[10px] uppercase tracking-wide text-navy">
                Add evidence photographs
              </span>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onEvidenceUpload}
                className="hidden"
              />
            </label>

            {evidence.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {evidence.map(
                  (item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="relative rounded-lg overflow-hidden border border-ink/10 bg-white"
                    >
                      <img
                        src={item.data}
                        alt={item.name}
                        className="w-full aspect-square object-cover"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          onRemoveEvidence(index)
                        }
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-navy/80 text-white flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* ACTIONS */}

          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-3 rounded-md border border-ink/10 bg-white text-navy font-mono text-[10px] uppercase tracking-wide"
            >
              Cancel
            </button>

            <button
              onClick={onSave}
              disabled={saving || !decision}
              className="px-6 py-3 rounded-md bg-gold text-navy font-mono text-[10px] uppercase tracking-wide disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving
                ? "Saving..."
                : "Save officer decision"}

              {!saving && (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SMALL COMPONENTS
|--------------------------------------------------------------------------
*/

function ProgressItem({
  number,
  title,
  active = false,
  complete = false,
}) {
  return (
    <div
      className={`px-4 lg:px-6 py-5 flex items-center gap-3 border-r last:border-r-0 border-ink/10 ${
        active ? "bg-gold/10" : ""
      }`}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-[10px] shrink-0 ${
          complete
            ? "bg-teal text-white"
            : active
            ? "bg-gold text-navy"
            : "bg-ink/5 text-ink/30"
        }`}
      >
        {complete ? (
          <Check className="w-4 h-4" />
        ) : (
          number
        )}
      </div>

      <span
        className={`font-mono text-[9px] uppercase tracking-wide ${
          active || complete
            ? "text-navy"
            : "text-ink/30"
        }`}
      >
        {title}
      </span>
    </div>
  );
}

function SummaryCard({
  number,
  label,
  highlighted = false,
}) {
  return (
    <div
      className={`px-6 py-6 border-r last:border-r-0 border-ink/10 ${
        highlighted
          ? "bg-gold/[0.06]"
          : ""
      }`}
    >
      <div
        className={`font-display font-semibold text-3xl ${
          highlighted
            ? "text-gold-dark"
            : "text-navy"
        }`}
      >
        {number}
      </div>

      <div className="mt-1 text-sm text-ink/45">
        {label}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-teal border-t-transparent animate-spin" />
    </div>
  );
}