import React from "react";
import styles from "./QueueStates.module.css";

export function QueueSkeleton(): React.ReactElement {
  return (
    <div className={styles.skeletonContainer} aria-label="Loading queue skeleton">
      <div className={styles.skeletonRow} />
      <div className={styles.skeletonRow} />
      <div className={styles.skeletonRow} />
      <div className={styles.skeletonRow} />
    </div>
  );
}

export type QueueEmptyProps = {
  message?: string;
};

export function QueueEmpty({
  message = "No open plan cycles found for this tenant.",
}: QueueEmptyProps): React.ReactElement {
  return (
    <div className={styles.stateContainer}>
      <div className={styles.title}>Queue is Empty</div>
      <div className={styles.message}>{message}</div>
    </div>
  );
}

export type QueueErrorProps = {
  message?: string;
  onRetry?: () => void;
};

export function QueueError({
  message = "Failed to load plan cycle queue. Please try again.",
  onRetry,
}: QueueErrorProps): React.ReactElement {
  return (
    <div className={styles.stateContainer}>
      <div className={styles.title}>Error Loading Queue</div>
      <div className={styles.message}>{message}</div>
      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
