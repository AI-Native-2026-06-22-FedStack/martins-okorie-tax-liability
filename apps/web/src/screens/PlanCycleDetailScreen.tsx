import React from "react";
import { Badge } from "../atoms/Badge";
import { AppShell } from "../components/AppShell";
import { UsePlanCycleDetailReturn } from "../hooks/usePlanCycleDetail";
import styles from "./PlanCycleDetailScreen.module.css";

export type PlanCycleDetailScreenProps = {
  caseId?: string;
  clientName?: string;
  detail: UsePlanCycleDetailReturn;
  onBack?: () => void;
  onLogout?: () => void;
};

export function PlanCycleDetailScreen({
  caseId = "CYCLE-2026-Q1-001",
  clientName = "Acme Wealth Management",
  detail,
  onBack,
  onLogout,
}: PlanCycleDetailScreenProps): React.ReactElement {
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

  return (
    <AppShell title={`Case Detail: ${caseId}`} onLogout={onLogout}>
      <div className={styles.container}>
        {/* Top Header Card */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <div>
              <h1 className={styles.caseTitle}>{clientName}</h1>
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
                  <Badge variant="in_review" label={currentStage} />
                </div>
              </div>
              <div className={styles.propCard}>
                <span className={styles.propLabel}>Assigned Advisor</span>
                <span className={styles.propValue}>Martin Okorie</span>
              </div>
              <div className={styles.propCard}>
                <span className={styles.propLabel}>Quality Reviewer</span>
                <span className={styles.propValue}>Sarah Jenkins (Firm Admin)</span>
              </div>
              <div className={styles.propCard}>
                <span className={styles.propLabel}>Target Due Date</span>
                <span className={styles.propValue} style={{ color: "#f43f5e" }}>
                  2026-03-31 (Overdue)
                </span>
              </div>
              <div className={styles.propCard}>
                <span className={styles.propLabel}>Priority</span>
                <span className={styles.propValue}>High</span>
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
    </AppShell>
  );
}
