import React from "react";
import styles from "./Badge.module.css";

export type BadgeVariant =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "overdue";

export type BadgeProps = {
  variant: BadgeVariant;
  label?: string;
  className?: string;
};

const variantClassMap: Record<BadgeVariant, string> = {
  draft: styles.badgeDraft,
  submitted: styles.badgeSubmitted,
  in_review: styles.badgeInReview,
  approved: styles.badgeApproved,
  overdue: styles.badgeOverdue,
};

const defaultLabelMap: Record<BadgeVariant, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In Review",
  approved: "Approved",
  overdue: "Overdue",
};

export function Badge({ variant, label, className }: BadgeProps): React.ReactElement {
  const badgeClass = `${styles.badge} ${variantClassMap[variant]} ${className || ""}`.trim();
  const text = label || defaultLabelMap[variant];

  return <span className={badgeClass}>{text}</span>;
}
