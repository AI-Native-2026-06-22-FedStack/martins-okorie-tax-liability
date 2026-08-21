# Release-Incident & Rollback Runbook: Core Case Service

## Incident Context: Elevated Latency or Error Rates After Release

**Trigger Conditions**:
- **Release-Health Golden-Signal Alarm Firing**: (e.g. CloudWatch `High5xxRateAlarm` > 1% or `P95LatencyAlarm` > 250ms over a 3-minute evaluation period).
- **Post-Deploy Health Check Failure**: Post-traffic-shift synthetic probe returns non-200 or times out during the bake window.

---

## Response Workflow: Confirm → Locate → Decide → Act → Verify

```
[ Alarm Fires / Post-Deploy Check Fails ]
                   │
                   ▼
       1. CONFIRM Breach is Real
                   │
                   ▼
        2. LOCATE Failing Span
       (AWS X-Ray / CloudWatch)
                   │
                   ▼
        3. DECIDE: Release-Related?
                  ╱ ╲
           YES   ╱   ╲   NO
                ╱     ╲
               ▼       ▼
    ACT: ROLL BACK   Investigate Dependency
    Path 1 (Seconds) & Escalate On-Call
    Path 2 (Reconcile)
               │
               ▼
        4. VERIFY Health (200) & Alarm OK
```

---

### Step 1: CONFIRM the Breach is Real
Before executing remediation, confirm the alarm is not a transient single-datapoint spike:
1. Verify the metric breach persisted across the alarm's full evaluation window (e.g. 3 consecutive 1-minute datapoints).
2. Check CloudWatch Alarm status:
   ```bash
   aws cloudwatch describe-alarms \
     --alarm-names "taxpulse-staging-core-case-5xx-errors" "taxpulse-staging-core-case-p95-latency" \
     --query "MetricAlarms[*].[AlarmName,StateValue,StateReason]" \
     --output table
   ```

---

### Step 2: LOCATE the Slow or Failing Span
Identify which component is generating errors or latency:
1. Open the **AWS X-Ray Service Map** / CloudWatch ServiceLens:
   ```bash
   aws xray get-service-graph \
     --start-time $(date -u -v-15M +%s) \
     --end-time $(date -u +%s) \
     --query "Services[*].[Name,SummaryStatistics]" \
     --output table
   ```
2. Identify whether the fault originates in:
   - **Core Case Service (Node API)**: HTTP 500s on stage transitions, unhandled exceptions in request pipelines.
   - **Tax Engine (Python Compute)**: Timeout or compute errors during scenario tax calculations.
   - **Downstream Stores**: Postgres RDS connection exhaustion or DynamoDB write throttling.

---

### Step 3: DECIDE — Is the Degradation Release-Related?

| Condition | Decision | Action |
| :--- | :--- | :--- |
| **Degradation correlates with Green deployment timestamp** | **YES (Release-Induced)** | Proceed immediately to **ACT: Path 1 (Fast Traffic Switch)**, followed by **Path 2 (IaC Reconciliation)**. |
| **Degradation is systemic (e.g. AWS regional outage, DB network partition)** | **NO (Non-Release Fault)** | **Do NOT roll back.** A rollback cannot resolve infrastructural outages. Escalate to DB/Infrastructure on-call engineer per standard escalation policy. |

---

### Step 4: ACT — Execute Rollback (Two Explicit Paths)

#### PATH 1 (Fast Path — Seconds): Switch Traffic Back to Blue Target Group
*Objective: Instantaneously restore service to the known-good Blue revision without waiting for an image rebuild or CI/CD re-scaffold.*

1. **Retrieve Target Group ARNs**:
   ```bash
   ALB_ARN=$(aws elbv2 describe-load-balancers --names "taxpulse-staging-alb" --query "LoadBalancers[0].LoadBalancerArn" --output text)
   LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query "Listeners[0].ListenerArn" --output text)
   RULE_ARN=$(aws elbv2 describe-rules --listener-arn "$LISTENER_ARN" --query "Rules[?contains(Actions[0].TargetGroupArn, 'tg-api')].RuleArn | [0]" --output text)
   BLUE_TG_ARN=$(aws elbv2 describe-target-groups --names "taxpulse-staging-tg-api" --query "TargetGroups[0].TargetGroupArn" --output text)
   ```

2. **Shift Production Traffic 100% Back to Blue Target Group**:
   ```bash
   aws elbv2 modify-rule \
     --rule-arn "$RULE_ARN" \
     --actions Type=forward,TargetGroupArn="$BLUE_TG_ARN"
   ```
   *Alternative if modifying default listener action directly:*
   ```bash
   aws elbv2 modify-listener \
     --listener-arn "$LISTENER_ARN" \
     --default-actions Type=forward,TargetGroupArn="$BLUE_TG_ARN"
   ```

3. **Allow In-Flight Green Requests to Drain**:
   - The Core Case Service graceful shutdown contract ensures in-flight requests complete within the 30-second deregistation delay.

---

#### PATH 2 (Reconcile Path): Revert Declared State in IaC
*Objective: Align Terraform configuration so that Blue is the declared state, preventing subsequent CI/CD runs from inadvertently redeploying the faulty Green revision.*

1. **Revert the Task Definition / Revision in Terraform**:
   - In `infra/terraform/modules/app/`, ensure `aws_lb_listener_rule.api_production` and default listener forward to `aws_lb_target_group.api.arn` (Blue).
2. **Execute Terraform Plan & Apply**:
   ```bash
   cd infra/terraform
   terraform plan -out=rollback.tfplan
   terraform apply rollback.tfplan
   ```
3. **Commit Revert to VCS**:
   ```bash
   git checkout main
   git revert HEAD -m "revert: rollback release to blue revision due to latency breach"
   git push origin main
   ```

---

### Step 5: VERIFY the Rollback
*Never assume a rollback succeeded without explicit empirical verification:*

1. **Probe Health Endpoint**:
   ```bash
   curl -i -s -f "http://localhost:3000/health" || echo "FAIL"
   ```
   - Expect HTTP status `200 OK` with payload `{"service":"taxpulse-api","status":"ok"}`.

2. **Confirm CloudWatch Alarm Returns to OK**:
   ```bash
   aws cloudwatch describe-alarms \
     --alarm-names "taxpulse-staging-core-case-5xx-errors" "taxpulse-staging-core-case-p95-latency" \
     --query "MetricAlarms[*].[AlarmName,StateValue]" \
     --output table
   ```
   - Verify `StateValue` is `OK`.

3. **Log Incident & Disposition**:
   - Record the root-cause summary and disposition in `docs/security/disposition-log.md`.
