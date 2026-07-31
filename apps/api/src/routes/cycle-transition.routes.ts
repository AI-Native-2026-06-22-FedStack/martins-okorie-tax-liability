import { and, eq } from "drizzle-orm";
import { Router } from "express";

import { validateStageTransition } from "../../../../src/typescript/stage-transition.js";
import { requireAuth } from "../auth/verifier.js";
import { writeAuditEntry } from "../audit/audit-writer.js";
import { getDb } from "../db/client.js";
import { taxPlanCycle, type TaxPlanCycleStage } from "../db/schema.js";
import { publishStageChanged } from "../events/publishStageChanged.js";
import {
  findCycleByIdForTenant,
  insertStageTransitionForTenant
} from "../repository/cycle.repository.js";
import { tenantRateLimiter, tenantSlowDown } from "../middleware/rate-limit.js";
import { getPlanCycleQueueProjector } from "../store/dynamo.js";
import { invalidatePlanCycleQueueCacheForTenant } from "../store/queueCache.js";

export const cycleTransitionRouter = Router();

interface TransitionRequestBody {
  toStage?: unknown;
  reason?: unknown;
}

cycleTransitionRouter.patch(
  "/:id/transition",
  requireAuth,
  tenantSlowDown,
  tenantRateLimiter,
  async (req, res) => {
    const id = String(req.params.id);
    const body = req.body as TransitionRequestBody;
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "Authentication is required."
      });
    }
    const tenantContext = { tenant_id: user.tenant_id };

    const toStage = String(body.toStage ?? "") as TaxPlanCycleStage;
    const reason = String(body.reason ?? "");

    if (!body.toStage || !body.reason) {
      return res.status(400).json({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        detail: "toStage and reason are required."
      });
    }

    // 1. Retrieve the existing cycle to determine the starting stage
    const cycle = await findCycleByIdForTenant(tenantContext, id);
    if (!cycle) {
      return res.status(404).json({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        detail: `Tax Plan Cycle ${id} was not found for this tenant.`
      });
    }

    const fromStage = cycle.stage;

    // 2. Validate transition legality (Check if this move is allowed in workflow)
    const isLegalTransition = validateStageTransition(fromStage, toStage);
    if (!isLegalTransition) {
      // Record denied attempt in audit_entry table (outside transaction since cycle is not mutated)
      await writeAuditEntry({
        tenant_id: user.tenant_id,
        case_id: cycle.id,
        actor: user.id,
        action: `cycle.transition.denied: ${fromStage} -> ${toStage}`,
        reason,
        result: "failure"
      });

      return res.status(422).json({
        type: "about:blank",
        title: "Unprocessable Entity",
        status: 422,
        detail: `Illegal stage transition from ${fromStage} to ${toStage}.`
      });
    }

    // 3. Enforce roles permission matrix
    // - Review -> Client Approval / Modeling requires Firm Admin
    // - Executed -> Archived requires Firm Admin
    // - Advisor may transition other allowed paths
    let isAuthorized = false;
    if (user.role === "Firm Admin") {
      isAuthorized = true;
    } else if (user.role === "Advisor") {
      const requiresFirmAdmin = fromStage === "Review" || toStage === "Archived";
      isAuthorized = !requiresFirmAdmin;
    }

    if (!isAuthorized) {
      // Record unauthorized attempt in audit_entry table
      await writeAuditEntry({
        tenant_id: user.tenant_id,
        case_id: cycle.id,
        actor: user.id,
        action: `cycle.transition.denied: ${fromStage} -> ${toStage} (unauthorized)`,
        reason,
        result: "failure"
      });

      return res.status(403).json({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
        detail: `Role ${user.role} is not authorized to transition cycle from ${fromStage} to ${toStage}.`
      });
    }

    // 4. Perform database mutation inside transaction
    const db = getDb();
    try {
      const updatedAt = new Date();
      await db.transaction(async (tx) => {
        // Update target cycle stage
        await tx
          .update(taxPlanCycle)
          .set({ stage: toStage, updated_at: updatedAt })
          .where(and(eq(taxPlanCycle.tenant_id, user.tenant_id), eq(taxPlanCycle.id, id)));

        // Insert stage transition record
        await insertStageTransitionForTenant(
          tenantContext,
          {
            actor: user.id,
            case_id: id,
            from_stage: fromStage,
            to_stage: toStage
          },
          tx
        );

        // Write audit entry in the SAME transaction
        await writeAuditEntry(
          {
            tenant_id: user.tenant_id,
            case_id: id,
            actor: user.id,
            action: `cycle.transition.success: ${fromStage} -> ${toStage}`,
            reason,
            result: "success"
          },
          tx
        );
      });
      await getPlanCycleQueueProjector().deleteCycle(cycle);
      await getPlanCycleQueueProjector().upsertCycle({
        ...cycle,
        stage: toStage,
        updated_at: updatedAt
      });
      await invalidatePlanCycleQueueCacheForTenant(user.tenant_id);
      try {
        await publishStageChanged({
          actor: user.id,
          changedAt: updatedAt,
          cycleId: id,
          fromStage,
          tenantId: user.tenant_id,
          toStage
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        req.log.warn({ err: errorMsg }, "Stage-changed event publish failed");
      }

      return res.json({
        status: "success",
        message: `Tax Plan Cycle successfully transitioned to ${toStage}.`
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      req.log.error({ err: errorMsg }, "Database transition transaction failed");
      return res.status(500).json({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "Transaction failed."
      });
    }
  }
);
