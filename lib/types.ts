export type ChatRole = "assistant" | "user";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
}

export type StepId =
  | "intro"
  | "age"
  | "duration"
  | "cycle"
  | "hormonal"
  | "amh"
  | "previous_ivf"
  | "previous_pregnancy"
  | "male_factor"
  | "files"
  | "summary"
  | "consent"
  | "done";

/**
 * Whose voice are we hearing? Inferred from cues in the user's
 * utterances (e.g. "مراتي" → husband, "جوزي" → wife). Stays
 * "unknown" until a confident cue is observed; never asked bluntly.
 */
export type SpeakerRole = "wife" | "husband" | "unknown";

export interface Answers {
  age?: number;
  duration_years?: number;
  cycle_regular?: boolean;
  hormonal_issues?: boolean;
  pcos?: boolean;
  amh?: number | "unknown";
  previous_ivf_count?: number;
  previous_pregnancy?: boolean;
  male_factor?: boolean;
  uploaded_files?: string[];
  /** Detected speaker — drives gendered phrasing across the dialogue. */
  speakerRole?: SpeakerRole;
}

export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * Privacy-preserving label describing the *type* of clinical document
 * inferred from a filename. Original filenames are NEVER displayed in
 * the report — only the inferred type. We carry both Arabic and English
 * labels so the report stays clinical-grade in either rendering.
 */
export interface DocumentType {
  ar: string;
  en: string;
}

/** A single document detection — filename kept INTERNAL ONLY (for stable
 * deterministic hashing of mock numbers) and never surfaced in any UI. */
export interface FileDetection {
  /** Internal only — must NOT be rendered in any user-facing surface. */
  filename: string;
  /** Privacy-safe label shown to physicians and patients. */
  documentType: DocumentType;
  /** Short Arabic notes extracted from the document. */
  tags: string[];
}

/** Mock-extracted values inferred from uploaded filenames. */
export interface ExtractedFileData {
  amh?: number;
  fsh?: number;
  hormonal?: boolean;
  pcos?: boolean;
  ultrasound?: boolean;
  semenAnalysis?: boolean;
  spermMotility?: number;
  spermConcentration?: number;
  pregnancyTest?: boolean;
  thyroid?: boolean;
  detections: FileDetection[];
}

export interface PredictionResult {
  low: number;
  high: number;
  mid: number;
  category: "منخفضة" | "متوسطة" | "جيدة" | "مرتفعة";
  confidence: ConfidenceLevel;
  /** Positive + neutral notes that contributed to the score */
  contributingFactors: string[];
  /** Negative-leaning factors only */
  riskFactors: string[];
  /** Concrete tests / scans we recommend running */
  suggestedTests: string[];
  /** High-level next-step actions for the patient */
  nextSteps: string[];
  /** Short Arabic case summary */
  summary: string;
  /** Detected items extracted from uploaded files (filenames are
   *  internal-only — UI must use `documentType` instead). */
  fileFindings: FileDetection[];
  /**
   * Privacy-safe list of inferred document types reviewed for this
   * report. Drives the "Clinical Documents Reviewed" section. Original
   * filenames are intentionally NEVER included here.
   */
  reviewedDocuments: DocumentType[];
  /**
   * True when the user provided at least one objective clinical input
   * (e.g. a numeric AMH or any uploaded report). When false, the UI
   * must avoid presenting any impression / success indication and
   * surface the missing-data list instead.
   */
  dataSufficient: boolean;
  /** Human-readable list of investigations / data points not provided. */
  missingData: string[];
}
