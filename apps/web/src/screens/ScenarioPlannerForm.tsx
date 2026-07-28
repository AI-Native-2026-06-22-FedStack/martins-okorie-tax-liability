import { zodResolver } from "@hookform/resolvers/zod";
import { createPlanCycleSchema } from "@capstone/shared-schemas";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreatePlanCycle } from "../api/usePlanCycles";
import { QueueError } from "../atoms/QueueStates";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import styles from "./PlanCycleDetailScreen.module.css";

type ScenarioPlannerValues = z.infer<typeof createPlanCycleSchema>;

export type ScenarioPlannerFormProps = {
  auth: AuthSessionReturn;
  onCreated?: (cycleId: string) => void;
};

function errorId(fieldName: keyof ScenarioPlannerValues): string {
  return `scenario-${String(fieldName)}-error`;
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function ScenarioPlannerForm({
  auth,
  onCreated,
}: ScenarioPlannerFormProps): React.ReactElement {
  const createMutation = useCreatePlanCycle(auth);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ScenarioPlannerValues>({
    defaultValues: {
      client_id: "",
      due_date: "",
      hold_reason: null,
      on_hold: false,
      owner: auth.user?.email ?? "",
      planning_period: "",
      priority: "Medium",
    },
    resolver: zodResolver(createPlanCycleSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await createMutation.mutateAsync(values);
    reset({
      client_id: "",
      due_date: "",
      hold_reason: null,
      on_hold: false,
      owner: auth.user?.email ?? "",
      planning_period: "",
      priority: "Medium",
    });
    onCreated?.(result.id);
  });

  const disabled = isSubmitting || createMutation.isPending;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.caseTitle}>New Plan Cycle</h1>
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              Create a TaxPulse scenario workspace for an advisor's client.
            </span>
          </div>
        </div>
      </div>

      {createMutation.isError && <QueueError message={createMutation.error.message} />}

      <form className={styles.panel} onSubmit={onSubmit} noValidate>
        <div className={styles.gridProps}>
          <div className={styles.propCard}>
            <label className={styles.propLabel} htmlFor="client_id">
              Client Identifier
            </label>
            <input
              aria-describedby={errors.client_id ? errorId("client_id") : undefined}
              aria-invalid={Boolean(errors.client_id)}
              id="client_id"
              type="text"
              {...register("client_id")}
            />
            {errors.client_id?.message && (
              <span id={errorId("client_id")} role="alert">
                {errors.client_id.message}
              </span>
            )}
          </div>

          <div className={styles.propCard}>
            <label className={styles.propLabel} htmlFor="planning_period">
              Planning Period
            </label>
            <input
              aria-describedby={errors.planning_period ? errorId("planning_period") : undefined}
              aria-invalid={Boolean(errors.planning_period)}
              id="planning_period"
              type="text"
              {...register("planning_period")}
            />
            {errors.planning_period?.message && (
              <span id={errorId("planning_period")} role="alert">
                {errors.planning_period.message}
              </span>
            )}
          </div>

          <div className={styles.propCard}>
            <label className={styles.propLabel} htmlFor="owner">
              Owner
            </label>
            <input
              aria-describedby={errors.owner ? errorId("owner") : undefined}
              aria-invalid={Boolean(errors.owner)}
              id="owner"
              type="email"
              {...register("owner")}
            />
            {errors.owner?.message && (
              <span id={errorId("owner")} role="alert">
                {errors.owner.message}
              </span>
            )}
          </div>

          <div className={styles.propCard}>
            <label className={styles.propLabel} htmlFor="priority">
              Priority
            </label>
            <select
              aria-describedby={errors.priority ? errorId("priority") : undefined}
              aria-invalid={Boolean(errors.priority)}
              id="priority"
              {...register("priority")}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            {errors.priority?.message && (
              <span id={errorId("priority")} role="alert">
                {errors.priority.message}
              </span>
            )}
          </div>

          <div className={styles.propCard}>
            <label className={styles.propLabel} htmlFor="due_date">
              Due Date
            </label>
            <input
              aria-describedby={errors.due_date ? errorId("due_date") : undefined}
              aria-invalid={Boolean(errors.due_date)}
              id="due_date"
              type="date"
              {...register("due_date")}
            />
            {errors.due_date?.message && (
              <span id={errorId("due_date")} role="alert">
                {errors.due_date.message}
              </span>
            )}
          </div>

          <div className={styles.propCard}>
            <label className={styles.propLabel} htmlFor="on_hold">
              On Hold
            </label>
            <input id="on_hold" type="checkbox" {...register("on_hold")} />
          </div>

          <div className={styles.propCard}>
            <label className={styles.propLabel} htmlFor="hold_reason">
              Hold Reason
            </label>
            <textarea
              aria-describedby={errors.hold_reason ? errorId("hold_reason") : undefined}
              aria-invalid={Boolean(errors.hold_reason)}
              id="hold_reason"
              {...register("hold_reason", { setValueAs: normalizeOptionalText })}
            />
            {errors.hold_reason?.message && (
              <span id={errorId("hold_reason")} role="alert">
                {errors.hold_reason.message}
              </span>
            )}
          </div>
        </div>

        <button className={styles.postButton} disabled={disabled} type="submit">
          {disabled ? "Creating..." : "Create Plan Cycle"}
        </button>
      </form>
    </div>
  );
}
