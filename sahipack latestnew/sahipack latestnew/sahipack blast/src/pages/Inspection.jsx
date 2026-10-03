import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CircleCheck,
  FileSearch,
  FileText,
  ShieldCheck,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

function StatusIcon({ status }) {
  const value = String(status || "").toUpperCase();

  if (value === "COMPLIANT") {
    return (
      <CircleCheck className="w-4 h-4 text-teal-dark shrink-0" />
    );
  }

  if (
    value === "POTENTIAL_VIOLATION" ||
    value === "NEEDS_VERIFICATION"
  ) {
    return (
      <TriangleAlert className="w-4 h-4 text-gold-dark shrink-0" />
    );
  }

  return (
    <X className="w-4 h-4 text-red-500/80 shrink-0" />
  );
}

function statusLabel(status) {
  const value = String(status || "").toUpperCase();

  if (value === "COMPLIANT") return "COMPLIANT";
  if (value === "POTENTIAL_VIOLATION") return "POTENTIAL VIOLATION";
  if (value === "NEEDS_VERIFICATION") return "NEEDS VERIFICATION";
  if (value === "NOT_APPLICABLE") return "NOT APPLICABLE";

  return value || "REVIEW";
}

function getStatusCounts(findings) {
  return findings.reduce(
    (counts, finding) => {
      const status = String(
        finding.status || finding.original_ai_status || ""
      ).toUpperCase();

      if (status === "COMPLIANT") {
        counts.compliant += 1;
      } else if (status === "POTENTIAL_VIOLATION") {
        counts.potential += 1;
      } else if (status === "NEEDS_VERIFICATION") {
        counts.verification += 1;
      } else if (status === "NOT_APPLICABLE") {
        counts.notApplicable += 1;
      }

      return counts;
    },
    {
      compliant: 0,
      potential: 0,
      verification: 0,
      notApplicable: 0,
    }
  );
}

export default function Inspection() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [inspectionId, setInspectionId] = useState(null);
  const [findings, setFindings] = useState([]);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setScanned(false);
    setFindings([]);
    setInspectionId(null);
    setError("");
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setScanned(false);
    setFindings([]);
    setInspectionId(null);
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const runScan = async () => {
  if (!selectedFile) {
    setError("Add a package image before starting the analysis.");
    return;
  }

  setScanning(true);
  setScanned(false);
  setError("");
  setFindings([]);

  try {
    // --------------------------------
    // 1. Prepare image for /scan
    // --------------------------------
    const formData = new FormData();

formData.append("images", selectedFile);

formData.append(
  "product_data",
  JSON.stringify({
    name: "Uploaded Product",
  })
);

    const token = localStorage.getItem("sahipack_token");

    if (!token) {
      navigate("/login");
      return;
    }

    // --------------------------------
    // 2. Run OCR + compliance analysis
    // --------------------------------
    const scanResponse = await fetch(`${API_BASE}/scan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const scanData = await scanResponse.json();

    if (!scanResponse.ok) {
      const detail =
        typeof scanData.detail === "string"
          ? scanData.detail
          : scanData.detail
          ? JSON.stringify(scanData.detail, null, 2)
          : `Scan failed with status ${scanResponse.status}`;

      throw new Error(detail);
    }

    // --------------------------------
    // 3. Get inspection ID
    // --------------------------------
    const newInspectionId =
      scanData.inspection_id || scanData.id;

    if (!newInspectionId) {
      throw new Error(
        "Backend scan succeeded but did not return an inspection ID."
      );
    }

    setInspectionId(newInspectionId);

    // --------------------------------
    // 4. Fetch rule-engine findings
    // --------------------------------
    const findingsResponse = await fetch(
      `${API_BASE}/api/inspections/${newInspectionId}/findings`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const findingsData = await findingsResponse.json();

    if (!findingsResponse.ok) {
      const detail =
        typeof findingsData.detail === "string"
          ? findingsData.detail
          : findingsData.detail
          ? JSON.stringify(findingsData.detail, null, 2)
          : `Could not load findings (${findingsResponse.status})`;

      throw new Error(detail);
    }

    // --------------------------------
    // 5. Store findings in React state
    // --------------------------------
    setFindings(
      Array.isArray(findingsData)
        ? findingsData
        : findingsData.findings || []
    );

    setScanned(true);

  } catch (err) {
    console.error("Scan error:", err);

    const message =
      typeof err?.message === "string"
        ? err.message
        : typeof err === "string"
        ? err
        : JSON.stringify(err, null, 2);

    setError(
      message ||
        "Something went wrong while analysing the package."
    );

  } finally {
    setScanning(false);
  }
};

  const counts = getStatusCounts(findings);

  return (
    <div className="min-h-screen bg-cream text-ink">

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-navy border-b border-white/10">
        <div className="max-w-content mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">

          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-cream/70 hover:text-gold transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
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


      {/* MAIN */}
      <main className="max-w-content mx-auto px-6 lg:px-10 py-12 lg:py-16">

        {/* INTRO */}
        <section>

          <div className="eyebrow text-teal-dark mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-teal" />
            New inspection
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">

            <div>
              <h1 className="font-display font-semibold text-[38px] sm:text-[48px] lg:text-[56px] leading-[1.02] text-navy max-w-3xl">
                Capture the evidence.
                <br />
                <span className="text-teal-dark">
                  Check the pack.
                </span>
              </h1>

              <p className="mt-5 text-ink/60 max-w-[60ch] text-base lg:text-lg leading-7">
                Upload package evidence and let SahiPack read declarations,
                check Legal Metrology rules, and surface findings for officer
                review.
              </p>
            </div>

            {inspectionId && (
              <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
                Inspection #{inspectionId}
              </div>
            )}

          </div>
        </section>


        {/* WORKFLOW */}
        <section className="mt-10">

          <div className="grid grid-cols-2 sm:grid-cols-5 border border-ink/10 rounded-xl overflow-hidden bg-white">

            <WorkflowStep
              number="01"
              label="Capture"
              active={!scanned}
              complete={Boolean(selectedFile)}
            />

            <WorkflowStep
              number="02"
              label="Read"
              active={scanning}
              complete={scanned}
            />

            <WorkflowStep
              number="03"
              label="Check"
              active={scanning}
              complete={scanned}
            />

            <WorkflowStep
              number="04"
              label="Review"
              active={scanned}
              complete={false}
            />

            <WorkflowStep
              number="05"
              label="Report"
              active={false}
              complete={false}
            />

          </div>

        </section>


        {/* CAPTURE AREA */}
        {!scanned && (
          <section className="mt-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-8">

            {/* EVIDENCE CARD */}
            <div className="rounded-xl border border-ink/10 bg-white overflow-hidden">

              <div className="px-6 py-5 border-b border-ink/10">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-teal-dark">
                  Step 01 · Capture evidence
                </div>

                <h2 className="font-display font-semibold text-2xl text-navy mt-1">
                  Add package evidence
                </h2>

                <p className="mt-2 text-sm text-ink/50">
                  Start with a clear photograph of the package. The current
                  analysis pipeline processes the uploaded image for OCR and
                  compliance assessment.
                </p>
              </div>


              <div className="p-6">

                {!selectedFile ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={scanning}
                    className="w-full min-h-[330px] rounded-lg border-2 border-dashed border-ink/15 bg-cream/40 hover:border-teal/60 hover:bg-teal/5 transition-colors flex flex-col items-center justify-center text-center"
                  >

                    <div className="w-14 h-14 rounded-full bg-white border border-ink/10 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-teal-dark" />
                    </div>

                    <div className="mt-5 font-display font-semibold text-lg text-navy">
                      Add package image
                    </div>

                    <div className="mt-2 text-sm text-ink/45">
                      Front, back, label, or declaration panel
                    </div>

                    <div className="mt-4 font-mono text-[10px] tracking-wide uppercase text-ink/30">
                      JPG · PNG · WEBP
                    </div>

                    <div className="mt-6 bg-navy text-cream px-5 py-3 rounded-md font-mono text-xs tracking-wide uppercase">
                      Choose image
                    </div>

                  </button>
                ) : (
                  <div>

                    <div className="relative rounded-lg overflow-hidden bg-navy min-h-[330px] flex items-center justify-center">

                      <img
                        src={previewUrl}
                        alt="Selected package evidence"
                        className="max-h-[420px] w-full object-contain"
                      />

                      <button
                        onClick={removeFile}
                        disabled={scanning}
                        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-navy/90 text-cream flex items-center justify-center hover:bg-red-500 transition-colors"
                        title="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>

                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">

                      <div className="min-w-0">
                        <div className="font-medium text-sm text-navy truncate">
                          {selectedFile.name}
                        </div>

                        <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink/35">
                          Package evidence
                        </div>
                      </div>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={scanning}
                        className="shrink-0 font-mono text-[10px] uppercase tracking-wide border border-ink/15 px-4 py-2.5 rounded-md hover:border-teal hover:text-teal-dark transition-colors"
                      >
                        Replace
                      </button>

                    </div>

                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {error && (
                  <div className="mt-5 border border-red-500/20 bg-red-50 rounded-md px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  onClick={runScan}
                  disabled={scanning || !selectedFile}
                  className="mt-6 w-full flex items-center justify-center gap-2 bg-gold text-navy px-5 py-4 rounded-md font-mono text-xs tracking-wide uppercase font-medium hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {scanning ? (
                    <>
                      <span className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
                      Running analysis...
                    </>
                  ) : (
                    <>
                      Run compliance analysis
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </div>
            </div>


            {/* WHAT WE ANALYZE */}
            <AnalysisGuide />

          </section>
        )}


        {/* ANALYSIS LOADING */}
        {scanning && (
          <section className="mt-8 rounded-xl bg-navy text-cream overflow-hidden">

            <div className="p-8 lg:p-10">

              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full border-2 border-teal/30 border-t-teal animate-spin" />

                <div>
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-gold">
                    Analysis in progress
                  </div>

                  <h2 className="font-display font-semibold text-2xl mt-1">
                    Reading the package.
                  </h2>
                </div>
              </div>

              <div className="mt-8 grid sm:grid-cols-3 gap-4">

                <AnalysisProgress
                  number="01"
                  title="OCR"
                  description="Reading package text"
                />

                <AnalysisProgress
                  number="02"
                  title="Declarations"
                  description="Extracting package information"
                />

                <AnalysisProgress
                  number="03"
                  title="Rules"
                  description="Checking applicable requirements"
                />

              </div>

            </div>

          </section>
        )}


        {/* RESULTS */}
        {scanned && !scanning && (
          <section className="mt-8">

            {/* RESULT HEADER */}
            <div className="rounded-xl bg-navy text-cream p-7 lg:p-9">

              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">

                <div>
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-gold">
                    Initial compliance assessment
                  </div>

                  <h2 className="font-display font-semibold text-3xl lg:text-4xl mt-2">
                    Analysis complete.
                  </h2>

                  <p className="mt-3 text-cream/55 max-w-[58ch] text-sm leading-6">
                    SahiPack has screened the package image against its
                    compliance rules. Findings requiring human verification
                    should be reviewed before a final report is generated.
                  </p>
                </div>

                <div className="font-mono text-[10px] uppercase tracking-wide text-cream/40">
                  Inspection #{inspectionId}
                </div>

              </div>

            </div>


            {/* SUMMARY */}
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 border border-ink/10 bg-white rounded-xl overflow-hidden">

              <ResultStat
                value={counts.compliant}
                label="Compliant"
                icon={<CircleCheck className="w-4 h-4" />}
                type="teal"
              />

              <ResultStat
                value={counts.potential}
                label="Potential violation"
                icon={<TriangleAlert className="w-4 h-4" />}
                type="gold"
              />

              <ResultStat
                value={counts.verification}
                label="Needs verification"
                icon={<FileSearch className="w-4 h-4" />}
                type="gold"
              />

              <ResultStat
                value={counts.notApplicable}
                label="Not applicable"
                icon={<X className="w-4 h-4" />}
                type="neutral"
              />

            </div>


            {/* RESULTS CONTENT */}
            <div className="mt-8 grid lg:grid-cols-[1.25fr_0.75fr] gap-8">

              {/* FINDINGS */}
              <div className="rounded-xl border border-ink/10 bg-white overflow-hidden">

                <div className="px-6 py-5 border-b border-ink/10 flex items-center justify-between">

                  <div>
                    <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-teal-dark">
                      Step 04 · Review findings
                    </div>

                    <h3 className="font-display font-semibold text-xl text-navy mt-1">
                      Compliance findings
                    </h3>
                  </div>

                  <div className="font-mono text-[10px] uppercase tracking-wide text-ink/35">
                    {findings.length} finding{findings.length === 1 ? "" : "s"}
                  </div>

                </div>


                <div className="p-6">

                  {findings.length === 0 ? (
                    <div className="border border-ink/10 rounded-lg p-8 text-center">

                      <CircleCheck className="w-7 h-7 text-teal-dark mx-auto" />

                      <h4 className="mt-4 font-display font-semibold text-lg text-navy">
                        No findings returned
                      </h4>

                      <p className="mt-2 text-sm text-ink/45">
                        The backend did not return any compliance findings for
                        this inspection.
                      </p>

                    </div>
                  ) : (
                    <div className="space-y-3">

                      {findings.map((finding, index) => {
                        const status =
                          finding.status ||
                          finding.original_ai_status;

                        return (
                          <div
                            key={finding.finding_id || index}
                            className="border border-ink/10 rounded-lg p-5 hover:border-ink/20 transition-colors"
                          >

                            <div className="flex items-start gap-3">

                              <StatusIcon status={status} />

                              <div className="flex-1 min-w-0">

                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">

                                  <div>
                                    <div className="font-medium text-sm text-navy">
                                      {finding.title ||
                                        finding.category ||
                                        "Compliance finding"}
                                    </div>

                                    {finding.applicable_rule && (
                                      <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-teal-dark">
                                        {finding.applicable_rule}
                                      </div>
                                    )}
                                  </div>

                                  <span className="shrink-0 font-mono text-[9px] tracking-wide uppercase text-ink/40">
                                    {statusLabel(status)}
                                  </span>

                                </div>

                                {finding.description && (
                                  <p className="mt-3 text-xs leading-5 text-ink/55">
                                    {finding.description}
                                  </p>
                                )}

                              </div>

                            </div>

                          </div>
                        );
                      })}

                    </div>
                  )}

                </div>

              </div>


              {/* NEXT STEP */}
              <div className="space-y-5">

                <div className="rounded-xl border border-gold/30 bg-gold/10 p-6">

                  <div className="w-10 h-10 rounded-md bg-gold flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-navy" />
                  </div>

                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-gold-dark mt-5">
                    Human verification
                  </div>

                  <h3 className="font-display font-semibold text-xl text-navy mt-1">
                    Review before reporting.
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-ink/60">
                    AI findings are preliminary. An officer must review
                    findings that require verification before the final
                    compliance report can be generated.
                  </p>

                  <button
                    onClick={() =>
                      navigate(
                        `/inspection/${inspectionId}/findings`
                      )
                    }
                    className="mt-6 w-full flex items-center justify-center gap-2 bg-navy text-cream px-5 py-3.5 rounded-md font-mono text-xs uppercase tracking-wide hover:bg-navy-light transition-colors"
                  >
                    Review findings
                    <ArrowRight className="w-4 h-4" />
                  </button>

                </div>


                <div className="rounded-xl border border-ink/10 bg-white p-6">

                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-teal-dark">
                    Final output
                  </div>

                  <h3 className="font-display font-semibold text-xl text-navy mt-1">
                    Officer-verified report
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-ink/50">
                    Once human verification is complete, SahiPack can generate
                    the final inspection report.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">

                    <div className="border border-ink/10 rounded-md p-4">
                      <FileText className="w-4 h-4 text-teal-dark" />
                      <div className="mt-3 font-mono text-[10px] uppercase tracking-wide text-ink/50">
                        PDF
                      </div>
                    </div>

                    <div className="border border-ink/10 rounded-md p-4">
                      <FileText className="w-4 h-4 text-teal-dark" />
                      <div className="mt-3 font-mono text-[10px] uppercase tracking-wide text-ink/50">
                        DOCX
                      </div>
                    </div>

                  </div>

                </div>

              </div>

            </div>

          </section>
        )}

      </main>
    </div>
  );
}


/* ---------------- COMPONENTS ---------------- */

function WorkflowStep({
  number,
  label,
  active,
  complete,
}) {
  return (
    <div className="relative px-4 py-4 border-b sm:border-b-0 sm:border-r border-ink/10 last:border-r-0">

      <div className="flex items-center gap-3">

        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-[9px] ${
            complete
              ? "bg-teal text-white"
              : active
              ? "bg-gold text-navy"
              : "bg-ink/5 text-ink/30"
          }`}
        >
          {complete ? <Check className="w-3.5 h-3.5" /> : number}
        </span>

        <span
          className={`font-mono text-[9px] tracking-[0.12em] uppercase ${
            active || complete
              ? "text-navy"
              : "text-ink/30"
          }`}
        >
          {label}
        </span>

      </div>

    </div>
  );
}


function AnalysisGuide() {
  return (
    <div className="rounded-xl bg-navy text-cream overflow-hidden">

      <div className="p-6 border-b border-white/10">

        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-gold">
          What SahiPack checks
        </div>

        <h2 className="font-display font-semibold text-2xl mt-1">
          From package to finding.
        </h2>

      </div>

      <div className="divide-y divide-white/10">

        <GuideItem
          number="01"
          title="Declarations"
          description="Read required package declarations and label information."
        />

        <GuideItem
          number="02"
          title="Quantity"
          description="Check quantity declarations, units, and information available from the package."
        />

        <GuideItem
          number="03"
          title="Display & label"
          description="Assess visible presentation, legibility, and declaration placement."
        />

        <GuideItem
          number="04"
          title="Legal Metrology rules"
          description="Compare extracted information against applicable compliance rules."
        />

        <GuideItem
          number="05"
          title="Evidence"
          description="Keep findings tied to the package evidence used during analysis."
        />

      </div>

      <div className="p-6 bg-white/5">
        <div className="flex gap-3">
          <ShieldCheck className="w-4 h-4 text-teal shrink-0 mt-0.5" />

          <p className="font-mono text-[9px] leading-5 tracking-wide uppercase text-cream/45">
            AI screening does not make a final legal determination.
            Officer verification is required where human review is needed.
          </p>
        </div>
      </div>

    </div>
  );
}


function GuideItem({
  number,
  title,
  description,
}) {
  return (
    <div className="px-6 py-4 flex gap-4">

      <span className="font-mono text-[10px] text-teal">
        {number}
      </span>

      <div>
        <div className="text-sm font-medium text-cream">
          {title}
        </div>

        <div className="mt-1 text-xs leading-5 text-cream/45">
          {description}
        </div>
      </div>

    </div>
  );
}


function AnalysisProgress({
  number,
  title,
  description,
}) {
  return (
    <div className="border border-white/10 rounded-lg p-5">

      <div className="font-mono text-[10px] text-teal">
        {number}
      </div>

      <div className="mt-3 font-medium text-sm">
        {title}
      </div>

      <div className="mt-1 text-xs text-cream/45">
        {description}
      </div>

    </div>
  );
}


function ResultStat({
  value,
  label,
  icon,
  type,
}) {
  const iconClass =
    type === "teal"
      ? "bg-teal/10 text-teal-dark"
      : type === "gold"
      ? "bg-gold/15 text-gold-dark"
      : "bg-ink/5 text-ink/40";

  return (
    <div className="p-5 border-b lg:border-b-0 lg:border-r border-ink/10 last:border-r-0">

      <div
        className={`w-8 h-8 rounded-md flex items-center justify-center ${iconClass}`}
      >
        {icon}
      </div>

      <div className="mt-5 font-display font-semibold text-2xl text-navy">
        {value}
      </div>

      <div className="mt-1 text-xs text-ink/55">
        {label}
      </div>

    </div>
  );
}