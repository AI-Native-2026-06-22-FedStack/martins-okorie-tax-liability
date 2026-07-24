import { useMemo, useState } from "react";
import { PlanCycleStage } from "../components/PlanCycleQueueTable";

export type DetailTab = "overview" | "comments" | "audit";

export type CommentItem = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
};

export type StepperStep = {
  stage: PlanCycleStage;
  label: string;
  status: "completed" | "current" | "upcoming";
};

export type UsePlanCycleDetailProps = {
  initialStage?: PlanCycleStage;
  initialComments?: CommentItem[];
  initialAuditTrail?: AuditLogEntry[];
};

export type UsePlanCycleDetailReturn = {
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
  currentStage: PlanCycleStage;
  stepperSteps: StepperStep[];
  draftComment: string;
  setDraftComment: (text: string) => void;
  comments: CommentItem[];
  addComment: (text: string) => void;
  auditTrail: AuditLogEntry[];
};

export const ALL_STAGES: PlanCycleStage[] = [
  "Intake",
  "Data Aggregation",
  "Modeling",
  "Review",
  "Client Approval",
  "Executed",
  "Archived",
];

const defaultMockComments: CommentItem[] = [
  {
    id: "cmt_1",
    author: "Martin Okorie (Advisor)",
    text: "Initial modeling complete for 2026 Q1 client tax scenario.",
    createdAt: "2026-03-01 10:15",
  },
  {
    id: "cmt_2",
    author: "Sarah Jenkins (Firm Admin)",
    text: "Reviewing bracket allocations and deduction disclosures.",
    createdAt: "2026-03-02 14:30",
  },
];

const defaultMockAuditTrail: AuditLogEntry[] = [
  {
    id: "audit_1",
    action: "Plan Cycle Opened",
    actor: "Martin Okorie",
    timestamp: "2026-03-01 09:00",
  },
  {
    id: "audit_2",
    action: "Transitioned to Modeling",
    actor: "Martin Okorie",
    timestamp: "2026-03-01 10:15",
  },
  {
    id: "audit_3",
    action: "Submitted for Review",
    actor: "Martin Okorie",
    timestamp: "2026-03-02 14:00",
  },
];

export function usePlanCycleDetail({
  initialStage = "Review",
  initialComments = defaultMockComments,
  initialAuditTrail = defaultMockAuditTrail,
}: UsePlanCycleDetailProps = {}): UsePlanCycleDetailReturn {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [currentStage] = useState<PlanCycleStage>(initialStage);
  const [draftComment, setDraftComment] = useState<string>("");
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [auditTrail] = useState<AuditLogEntry[]>(initialAuditTrail);

  // Compute stepper step statuses based on current stage index
  const stepperSteps = useMemo(() => {
    const currentIndex = ALL_STAGES.indexOf(currentStage);
    return ALL_STAGES.map((stage, index) => {
      let status: "completed" | "current" | "upcoming" = "upcoming";
      if (index < currentIndex) {
        status = "completed";
      } else if (index === currentIndex) {
        status = "current";
      }
      return {
        stage,
        label: stage,
        status,
      };
    });
  }, [currentStage]);

  const addComment = (text: string) => {
    if (!text.trim()) return;
    const newComment: CommentItem = {
      id: `cmt_${Date.now()}`,
      author: "Martin Okorie (Advisor)",
      text: text.trim(),
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    setComments((prev) => [...prev, newComment]);
    setDraftComment(""); // Clear draft after posting
  };

  return {
    activeTab,
    setActiveTab,
    currentStage,
    stepperSteps,
    draftComment,
    setDraftComment,
    comments,
    addComment,
    auditTrail,
  };
}
