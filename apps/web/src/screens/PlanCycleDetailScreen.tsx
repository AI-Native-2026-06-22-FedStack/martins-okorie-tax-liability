import React from "react";
import { Badge, BadgeVariant } from "../atoms/Badge";
import { QueueEmpty, QueueError, QueueSkeleton } from "../atoms/QueueStates";
import { PlanCycleDetailRecord, usePlanCycleDetailQuery } from "../api/usePlanCycles";
import { AppShell } from "../components/AppShell";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import { usePlanCycleDetail, UsePlanCycleDetailReturn } from "../hooks/usePlanCycleDetail";
import styles from "./PlanCycleDetailScreen.module.css";

const stageBadgeVariant: Record<PlanCycleDetailRecord["stage"], BadgeVariant> = {
  Intake: "draft",
  "Data Aggregation": "draft",
  Modeling: "submitted",
  Review: "in_review",
  "Client Approval": "submitted",
  Executed: "approved",
  Archived: "approved",
};

export type PlanCycleDetailScreenProps = {
  caseId?: string;
  clientName?: string;
  detail: UsePlanCycleDetailReturn;
  serverCycle?: PlanCycleDetailRecord;
  onBack?: () => void;
  onLogout?: () => void;
};

export type PlanCycleDetailContentProps = Omit<PlanCycleDetailScreenProps, "onLogout">;

export type PlanCycleDetailServerScreenProps = {
  auth: AuthSessionReturn;
  caseId: string | null;
  onBack?: () => void;
  onLogout?: () => void;
};

export function PlanCycleDetailContent({
  caseId = "CYCLE-2026-Q1-001",
  clientName = "Acme Wealth Management",
  detail,
  serverCycle,
  onBack,
}: PlanCycleDetailContentProps): React.ReactElement {
  const {
    activeTab,
    setActiveTab,
    currentStage,
    stepperSteps,
    draftComment,
    setDraftComment,
    comments,
    addComment,
    auditTrail,
  } = detail;

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    addComment(draftComment);
  };

  const displayClientName = serverCycle?.clientName ?? clientName;
  const displayOwner = serverCycle?.owner ?? "Martin Okorie";
  const displayDueDate = serverCycle?.dueDate ?? "2026-03-31";
  const displayPriority = serverCycle?.priority ?? "High";
  const displayOverdue = serverCycle?.isOverdue ?? true;

  return (
    <div className={styles.container}>
      {/* Top Header Card */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.caseTitle}>{displayClientName}</h1>
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              Case Ref: {caseId}
            </span>
          </div>
          {onBack && (
            <button
              type="button"
              className={styles.postButton}
              onClick={onBack}
              aria-label="Back to Queue"
            >
              Back to Queue
            </button>
          )}
        </div>

        {/* Stage Stepper Bar */}
        <div className={styles.stepperContainer} aria-label="Stage Stepper">
          {stepperSteps.map((step, index) => {
            const dotClass =
              step.status === "completed"
                ? styles.stepDotCompleted
                : step.status === "current"
                ? styles.stepDotCurrent
                : styles.stepDotUpcoming;

            return (
              <div key={step.stage} className={styles.stepperItem}>
                <div className={`${styles.stepDot} ${dotClass}`}>{index + 1}</div>
                <span className={styles.stepLabel}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabsContainer} role="tablist" aria-label="Detail Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          className={`${styles.tabButton} ${activeTab === "overview" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "comments"}
          className={`${styles.tabButton} ${activeTab === "comments" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("comments")}
        >
          Comments ({comments.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "audit"}
          className={`${styles.tabButton} ${activeTab === "audit" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          Audit Trail ({auditTrail.length})
        </button>
      </div>

      {/* Overview Tab Content */}
      {activeTab === "overview" && (
        <div className={styles.panel} role="tabpanel" aria-label="Overview Panel">
          <h2 style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--font-size-lg)" }}>
            Plan Cycle Properties
          </h2>
          <div className={styles.gridProps}>
              <div className={styles.propCard}>
                <span className={styles.propLabel}>Current Stage</span>
                <div style={{ marginTop: "4px" }}>
                  <Badge variant={stageBadgeVariant[currentStage]} label={currentStage} />
                </div>
              </div>
            <div className={styles.propCard}>
              <span className={styles.propLabel}>Assigned Advisor</span>
              <span className={styles.propValue}>{displayOwner}</span>
            </div>
            <div className={styles.propCard}>
              <span className={styles.propLabel}>Quality Reviewer</span>
              <span className={styles.propValue}>Sarah Jenkins (Firm Admin)</span>
            </div>
            <div className={styles.propCard}>
              <span className={styles.propLabel}>Target Due Date</span>
              <span className={styles.propValue} style={{ color: displayOverdue ? "#f43f5e" : undefined }}>
                {displayDueDate}
                {displayOverdue ? " (Overdue)" : ""}
              </span>
            </div>
            <div className={styles.propCard}>
              <span className={styles.propLabel}>Priority</span>
              <span className={styles.propValue}>{displayPriority}</span>
            </div>
          </div>
        </div>
      )}

      {/* Comments Tab Content */}
      {activeTab === "comments" && (
        <div className={styles.panel} role="tabpanel" aria-label="Comments Panel">
          <div className={styles.commentList}>
            {comments.map((c) => (
              <div key={c.id} className={styles.commentCard}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentAuthor}>{c.author}</span>
                  <span>{c.createdAt}</span>
                </div>
                <div className={styles.commentText}>{c.text}</div>
              </div>
            ))}
          </div>

          <form className={styles.addCommentBox} onSubmit={handlePostComment}>
            <label htmlFor="draft-comment" style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>
              Add Comment / Recommendation Note
            </label>
            <textarea
              id="draft-comment"
              aria-label="Add Comment Input"
              className={styles.textarea}
              placeholder="Type a comment or review note..."
              value={draftComment}
              onChange={(e) => setDraftComment(e.target.value)}
            />
            <button type="submit" className={styles.postButton}>
              Post Comment
            </button>
          </form>
        </div>
      )}

      {/* Audit Trail Tab Content */}
      {activeTab === "audit" && (
        <div className={styles.panel} role="tabpanel" aria-label="Audit Trail Panel">
          <table className={styles.auditTable} aria-label="Audit Trail Table">
            <thead>
              <tr>
                <th className={styles.auditTh}>Action</th>
                <th className={styles.auditTh}>Actor</th>
                <th className={styles.auditTh}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {auditTrail.map((entry) => (
                <tr key={entry.id}>
                  <td className={styles.auditTd}>{entry.action}</td>
                  <td className={styles.auditTd}>{entry.actor}</td>
                  <td className={styles.auditTd}>{entry.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function PlanCycleDetailScreen({
  onLogout,
  caseId = "CYCLE-2026-Q1-001",
  ...contentProps
}: PlanCycleDetailScreenProps): React.ReactElement {
  return (
    <AppShell title={`Case Detail: ${caseId}`} onLogout={onLogout}>
      <PlanCycleDetailContent caseId={caseId} {...contentProps} />
    </AppShell>
  );
}

export function PlanCycleDetailServerContent({
  auth,
  caseId,
  onBack,
}: Omit<PlanCycleDetailServerScreenProps, "onLogout">): React.ReactElement {
  const query = usePlanCycleDetailQuery(auth, caseId);
  const detail = usePlanCycleDetail({ initialStage: query.data?.stage ?? "Review" });

  if (query.isPending) {
    return <QueueSkeleton />;
  }

  if (query.isError) {
    return (
      <QueueError
        message={query.error.message}
        onRetry={() => {
          const retry = query.refetch;
          void retry();
        }}
      />
    );
  }

  if (!caseId || !query.data) {
    return <QueueEmpty message="No plan cycle detail is available." />;
  }

  return (
    <PlanCycleDetailContent
      caseId={query.data.id}
      clientName={query.data.clientName}
      detail={detail}
      onBack={onBack}
      serverCycle={query.data}
    />
  );
}

export function PlanCycleDetailServerScreen({
  auth,
  caseId,
  onBack,
  onLogout,
}: PlanCycleDetailServerScreenProps): React.ReactElement {
  return (
    <AppShell title={`Case Detail: ${caseId ?? "Loading"}`} onLogout={onLogout}>
      <PlanCycleDetailServerContent auth={auth} caseId={caseId} onBack={onBack} />
    </AppShell>
  );
}
