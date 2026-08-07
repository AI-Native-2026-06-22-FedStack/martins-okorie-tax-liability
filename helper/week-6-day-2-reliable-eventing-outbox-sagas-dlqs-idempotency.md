Week 6 · Day 2
Reliable Eventing: Outbox, Sagas, DLQs & Idempotency
Make the event bus trustworthy — solve the dual-write problem with the Outbox pattern, coordinate multi-step workflows with sagas and compensating actions, handle failure with DLQs and redrive, and carry idempotency end-to-end from HTTP through event to consumer.

1
Topic 1 of 5
The dual-write problem and the Outbox pattern
Why Do I Need to Know This?
In 6.1 Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis the capstone started emitting events, and that introduced a quiet failure mode: a service that saves a filing and publishes filing.submitted is doing two separate things, and a crash between them leaves the data saved but the event lost. No error is raised, no consumer reacts, and the system is silently inconsistent. For an audit trail that must account for every filing, a lost event is a missing record, so the capstone needs the standard fix — the Outbox pattern — before the bus can be trusted.

Scenario
The filing service handler does two writes: it inserts the filing into Postgres, then calls SNS to publish filing.submitted. In a load test the process is killed between the two, and the result is a filing in the database that the audit and analytics consumers never hear about. The team stops publishing directly from the handler. Instead it writes the event into an outbox table inside the same database transaction as the filing, and a separate relay reads that table and publishes — so the filing and its event are now saved or lost together, never one without the other.

Theory
The dual-write problem: two writes that are not atomic
A handler that writes to its database and then publishes to a broker is performing two independent operations against two systems. Nothing makes them atomic. If the process crashes, the network drops, or the broker is briefly unavailable after the database commit, you get one without the other: a committed filing with no event (a lost event), or — if you publish first — an event for a filing that never committed (a phantom event). This is the dual-write problem (reference), and it is invisible in a demo because the crash window is small; it surfaces under real load.

The Outbox pattern: one transaction, then a relay
The fix is to make the event part of the same transaction as the data. The service writes the event as a row in an outbox table in the same database transaction that writes the filing — so both commit or neither does. A separate relay then polls the outbox, publishes each unsent event to the broker, and marks the row as sent. The atomic write you can trust (the database transaction) now covers the event, and publishing becomes a separate, retryable step.

The relay is what turns "I hope both writes happened" into "both writes happened, and publishing will catch up."

The relay is at-least-once — so is the consumer
The relay marks a row as sent only after the broker confirms the publish. If it crashes after publishing but before marking the row, the next run republishes that event — so the relay delivers at-least-once, and a consumer can see the same event twice. Every consumer must therefore be idempotent (the Idempotency end-to-end: HTTP → event → consumer topic later in this lesson). When several relay instances run for fault tolerance, each claims rows with SELECT … FOR UPDATE SKIP LOCKED, which locks the rows it takes and skips rows another relay already holds, so two relays never publish the same event.

!
Warning
Mark the row sent only after the broker confirms. If the relay marks rows sent before the publish succeeds, a crash loses the event for good — the row looks handled but nothing was delivered. Confirm first, then mark.

One transaction writes the data and the event; a relay publishes
The filing and its outbox row commit together; the relay later publishes and marks the row sent, and the consumer dedupes.

Consumer
Broker (SNS)
Relay
Postgres (filing + outbox)
Filing handler
BEGIN, insert filing + outbox row, COMMIT
1
claim unsent rows (FOR UPDATE SKIP LOCKED)
2
publish event
3
confirmed
4
mark row sent
5
deliver event (consumer dedupes by id)
6
Example
the outbox table and a parallel-safe relay
// (1) written in the SAME transaction as the filing insert
await tx.query(
  `INSERT INTO outbox (id, type, payload, sent_at)
   VALUES ($1, 'gov.treasury.filing.submitted', $2, NULL)`,
  [eventId, JSON.stringify(cloudEvent)],
);

// --- relay process, runs on its own loop ---
const { rows } = await db.query(
  `SELECT id, payload FROM outbox
   WHERE sent_at IS NULL
   ORDER BY created_at
   FOR UPDATE SKIP LOCKED                       // (2) two relays never grab the same row
   LIMIT 100`,
);
for (const row of rows) {
  await sns.send(new PublishCommand({ TopicArn, Message: row.payload })); // (3) publish
  await db.query(`UPDATE outbox SET sent_at = now() WHERE id = $1`, [row.id]); // (4) mark sent AFTER confirm
}
Copy
Annotation (1) — the outbox INSERT runs inside the filing’s transaction (tx), so the event row commits with the filing or not at all.
Annotation (2) — FOR UPDATE SKIP LOCKED lets multiple relay instances poll in parallel; each skips rows another instance already locked.
Annotation (3) — publishing is a separate, retryable step; if it throws, the row stays sent_at IS NULL and is retried next loop.
Annotation (4) — the row is marked sent only after sns.send resolves, so a crash before this line causes a safe republish, not a lost event.
AI Practice
Prompt it
Have Codex build the outbox write and relay, then verify atomicity and parallel-safety.

For our filing service (TypeScript + Postgres + @aws-sdk/client-sns), implement
the Outbox pattern: an outbox table, an insert into it inside the same transaction
as the filing insert, and a relay that claims unsent rows with FOR UPDATE SKIP
LOCKED, publishes each to SNS, and marks the row sent only after the publish is
confirmed. Show the table DDL, the transactional write, and the relay loop.
Copy
Watch out
Codex often publishes to SNS inside the request handler instead of writing to the outbox, which re-introduces the dual write it was asked to remove. It may mark rows sent before the publish confirms (losing events on a crash), omit SKIP LOCKED (so two relays double-publish), or wrap the publish itself in the database transaction (which cannot be rolled back). Confirm the only publish is in the relay, the row is marked sent after confirmation, and row claiming uses FOR UPDATE SKIP LOCKED.

Verify
Insert a filing and kill the process before the relay runs; confirm the outbox row is present (the event survived the crash) and the relay publishes it on restart. Run two relay instances against a full outbox and confirm no event is published twice. Force a publish to fail and confirm the row stays unsent and is retried, not marked sent. Record any direct-publish-in-handler Codex left in your prompt journal.

Knowledge Check
1. A handler inserts a filing into Postgres, then calls SNS to publish the event. The process is killed between the two steps. What is the result?
Postgres automatically rolls back the filing insert because the publish never ran.
SNS detects the missing commit and refuses to deliver the orphaned event.
The filing is saved but the event is lost.
Both the filing and the event are discarded to keep the system consistent.
2. Why does writing the event to an outbox table fix the dual-write problem?
The event row commits in the same transaction as the data.
The outbox table publishes the event to SNS the moment the row is inserted.
Writing to the outbox makes the SNS publish call part of the database transaction.
The outbox guarantees each event is delivered to consumers exactly once.
3. Why must the relay mark an outbox row sent only after the broker confirms the publish?
Because marking before publishing would slow the relay’s polling loop.
Because the broker rejects events whose rows are already marked sent.
Because two relays would otherwise claim the same row at once.
So a crash before confirmation cannot lose the event.
4. Two relay instances run for fault tolerance. What stops them from publishing the same event twice?
Each relay is assigned a fixed half of the outbox table by row id.
SKIP LOCKED lets each relay skip rows another already locked.
SNS deduplicates the second publish because the event id repeats.
The second relay waits for the first to finish the entire table.
2
Topic 2 of 5
Sagas — orchestration, choreography, and compensating actions
Why Do I Need to Know This?
Some capstone actions span several services and several writes, and a single database transaction cannot cover them — there is no BEGIN that wraps a call to the SOAP integration, a row in Postgres, and an event. When step three fails, steps one and two are already committed, and "roll back" is not available across services. A saga is how a multi-step workflow stays consistent without a global lock: each step has a compensating action that undoes its effect when a later step fails.

Scenario
Submitting a filing kicks off three steps across services: reserve a confirmation number, debit a prepaid balance, and record the filing. The debit (step two) succeeds, but recording the filing (step three) fails validation. The reserved number and the debit are already committed in their own services, so the team models the flow as a saga: each step declares a compensating action — release the number, refund the debit — and the saga runs those in reverse when a later step fails, leaving the system as if the submission never happened.

Theory
A saga is a sequence of local transactions with compensations
A saga (reference) replaces one impossible distributed transaction with a sequence of local ones. Each step commits in its own service, and each step defines a compensating action that semantically undoes it. If any step fails, the saga executes the compensating actions for the steps that already succeeded, in reverse order. There is no distributed rollback — the steps really happened — so consistency is restored by doing more work, not by un-committing.

Choreography reacts to events; orchestration directs the steps
There are two ways to drive a saga, and they trade coupling for visibility.

Choreography: each step emits an event, and the next step’s service reacts to it. There is no central coordinator — the workflow is the sum of the reactions (a natural fit for the EventBridge routing from 6.1 Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis). Loose coupling, but the flow is implicit and hard to see end-to-end.
Orchestration: a central coordinator calls each step and decides what happens next, including running compensations on failure. AWS Step Functions is the orchestration tool — explicit ordering and visible state, at the cost of a coordinator the services now depend on.
i
Note
Step Functions appears here as an intro, not a deep unit. You need it only to recognize orchestration as the alternative to choreography and to know it is where a coordinated saga would live. This module does not build a full Step Functions workflow.

A compensation is a new action, not a rollback
A compensating action is not a database rollback — the original step already committed. It is a new operation that offsets the effect: a refund offsets a debit, a release offsets a reservation. Because a saga can retry, a compensation must itself be idempotent and safe to run more than once — refunding twice must not double-refund. This is why "undo" in a distributed system is designed, not free.

A three-step saga with compensations on the failure path
Each step commits locally; when step three fails, the saga compensates steps two and one in reverse.

fails

Step 1: reserve number

Step 2: debit balance

Step 3: record filing

Compensate 2: refund debit

Compensate 1: release number

System consistent -- as if never submitted

Example
a saga step with its compensation
const steps = [
  { do: () => reserveNumber(filingId),  undo: () => releaseNumber(filingId) },  // (1) step + compensation
  { do: () => debitBalance(taxpayerId, amount), undo: () => refundDebit(taxpayerId, amount) },
  { do: () => recordFiling(filing),     undo: () => deleteFilingRecord(filingId) },
];

const done: typeof steps = [];
try {
  for (const step of steps) { await step.do(); done.push(step); }  // (2) run forward, remember progress
} catch (err) {
  for (const step of done.reverse()) await step.undo();            // (3) compensate in reverse on failure
  throw err;
}
Copy
Annotation (1) — every step pairs a do with an undo; the compensation is defined alongside the action, not bolted on later.
Annotation (2) — completed steps are pushed to done, so the saga knows exactly which ones need compensating if a later step throws.
Annotation (3) — on failure the saga runs undo for the committed steps in reverse order; each undo must be idempotent in case the compensation itself is retried.
AI Practice
Prompt it
Have Codex implement the filing saga with compensations, then verify each compensation actually offsets its step.

Implement a saga for our filing submission with three steps — reserve a
confirmation number, debit a prepaid balance, record the filing — each with a
compensating action (release, refund, delete). Run steps forward; if any step
fails, compensate the completed steps in reverse order. Make each compensation
idempotent. Show the saga runner and the step definitions. Use choreography or
orchestration and state which you chose and why.
Copy
Watch out
Codex often writes the happy path correctly but compensates in the wrong order, or compensates steps that never ran. It may treat compensation as a database rollback (calling ROLLBACK on an already-committed step, which does nothing), or write a refund that is not idempotent so a retried compensation double-refunds. Confirm only completed steps are compensated, in reverse order, and that each compensation is a new offsetting action that is safe to run twice.

Verify
Force step three to fail and confirm the debit is refunded and the number released, in that order, leaving no committed effect. Force a compensation to run twice and confirm it does not double-refund. Confirm no step calls ROLLBACK on another service’s committed work. Record whether Codex chose choreography or orchestration and whether its reasoning matched the workflow’s need for visibility in your prompt journal.

Knowledge Check
1. Step three of a saga fails after steps one and two have committed in their own services. What restores consistency?
A distributed transaction rolls back all three steps at once.
The saga runs compensating actions for steps two and one.
The database automatically reverts the two committed steps on the failure.
The saga retries step three until it eventually succeeds or times out.
2. When does choreography fit a saga better than orchestration?
When the workflow needs a single place to see and audit its full state.
When every step must run in a strictly enforced, centrally controlled order.
When a coordinator must decide which compensation to run on failure.
When loose coupling matters more than seeing the flow in one place.
3. Why is a compensating action not the same as a database rollback?
The step already committed, so undo is a new action.
A rollback is slower than a compensation in a distributed system.
Compensations run inside the same transaction as the original step.
A rollback can cross services, while a compensation cannot.
4. Why must a saga’s compensating action be idempotent?
Because compensations always run before the step they undo.
Because the coordinator runs every compensation exactly once, guaranteed.
Because idempotency lets the saga skip the forward steps entirely.
Because a retried compensation must not double-undo its step.
3
Topic 3 of 5
DLQs and redrive — retries, recovery, and alerting
Why Do I Need to Know This?
In any real event system some messages fail every time they are delivered — a malformed record, a bug in one consumer. 6.1 Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis introduced the dead-letter queue as the place a poison message lands; this topic is the operational loop around it: how a failed message is set aside without blocking the queue, how you reprocess it after a fix, and why a dead-letter queue that no one watches is a silent outage. For federal software, "the events stopped and no one noticed" is the failure mode this loop exists to prevent.

Scenario
A schema change ships a malformed filing.submitted, and the analytics consumer throws on it every time the queue redelivers it. Without a limit, that one message is retried forever and the messages behind it never get processed. The team sets a redrive policy so the poison message moves to a dead-letter queue after a few attempts, wires an alert that fires when the dead-letter queue is non-empty, fixes the consumer, and then redrives the held messages back to the main queue to reprocess them.

Theory
A DLQ holds what fails past the receive limit
A dead-letter queue (reference) is a separate queue that catches messages a consumer could not process. The source queue’s redrive policy sets maxReceiveCount: once a message has been received that many times without being deleted, SQS moves it to the DLQ instead of redelivering it again. The poison message is preserved for inspection, and — the operational point — the messages behind it in the source queue keep flowing.

Redrive returns messages to the source after a fix
The DLQ is a holding area, not a graveyard. Once the bug is fixed, redrive moves the messages from the DLQ back to the source queue, where the corrected consumer processes them — recovery with no data loss. The lifecycle is: fail past the limit → land in the DLQ → fix the code → redrive back → reprocess. A message that lands in the DLQ is work that still needs doing, not work you are allowed to forget.

A silent DLQ is a silent outage
A message in the DLQ is invisible unless something watches the DLQ. If a consumer quietly fails every message, work piles into the DLQ while every dashboard stays green — the events "stopped" and no one was told. The DLQ’s depth must therefore be alerted on: a non-empty (or growing) DLQ raises an alert so someone investigates. In this module the alert target is local stdout; in production it is a real alarm, but the discipline — never let a DLQ fill silently — is the same.

!
Important
A dead-letter queue with no alert is worse than no DLQ at all: it hides the failure behind a queue that looks healthy. Always pair a DLQ with an alert on its depth.

The poison-message lifecycle
A message that fails past the limit moves to the DLQ and raises an alert; after the fix, a redrive returns it to the source.

received > maxReceiveCount

redrive

Source queue

Dead-letter queue

Alert on DLQ depth (stdout for now)

Fix the consumer

Example
a redrive policy and a redrive back to source
import { SQSClient, SetQueueAttributesCommand,
         StartMessageMoveTaskCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: "us-east-1", endpoint: "http://localhost:4566" });

await sqs.send(new SetQueueAttributesCommand({                           // (1) point the source at its DLQ
  QueueUrl: "http://localhost:4566/000000000000/analytics",
  Attributes: {
    RedrivePolicy: JSON.stringify({
      deadLetterTargetArn: "arn:aws:sqs:us-east-1:000000000000:analytics-dlq",
      maxReceiveCount: 3,                                               // (2) move after 3 failed receives
    }),
  },
}));

await sqs.send(new StartMessageMoveTaskCommand({                        // (3) redrive DLQ → source after the fix
  SourceArn: "arn:aws:sqs:us-east-1:000000000000:analytics-dlq",
}));
Copy
Annotation (1) — the redrive policy lives on the source queue and names the DLQ as its deadLetterTargetArn.
Annotation (2) — maxReceiveCount: 3 means a message is retried three times before it is moved, not dropped on the first failure.
Annotation (3) — once the consumer is fixed, StartMessageMoveTaskCommand redrives the held messages from the DLQ back to the source for reprocessing.
AI Practice
Prompt it
Have Codex configure the DLQ, alert, and redrive, then verify the full lifecycle.

For our analytics SQS queue against LocalStack, configure a redrive policy sending
failures to analytics-dlq after maxReceiveCount 3. Add a check that logs an alert
to stdout whenever the DLQ depth is greater than zero. Then show how to redrive
the DLQ messages back to the source queue after a fix using a message move task.
Show the policy, the alert check, and the redrive.
Copy
Watch out
Codex sometimes puts the redrive policy on the DLQ instead of the source queue, so nothing is ever moved. It may set maxReceiveCount to 1 (moving on the first transient failure) or omit the DLQ-depth alert entirely, which hides the outage. It can also confuse moving messages to the DLQ with redriving them back. Confirm the policy is on the source queue, the receive count tolerates transient retries, an alert watches DLQ depth, and the redrive direction is DLQ back to source.

Verify
Send a poison message and confirm it moves to the DLQ after the third receive, while valid messages keep processing. Confirm the alert fires once the DLQ depth is above zero. Fix the consumer, redrive the DLQ, and confirm the held message is reprocessed from the source queue. Set maxReceiveCount to 1 and observe a transient failure moving to the DLQ prematurely, then restore it. Record any missing DLQ alert in your prompt journal.

Knowledge Check
1. A malformed message makes the analytics consumer throw on every delivery, and there is no redrive policy. What happens to the messages behind it?
They are blocked while the poison message is retried indefinitely.
They skip the poison message and are processed in order after it.
They are moved to a dead-letter queue along with the poison message.
They are deleted after a short visibility timeout to unblock the queue.
2. The bug behind a batch of dead-lettered messages is now fixed. How do you reprocess them?
Lower the source queue’s maxReceiveCount so the DLQ drains automatically.
Re-publish the original events from SNS so new copies are delivered.
Redrive the DLQ messages back to the source queue.
Delete the DLQ so the messages flow back to the source on its recreation.
3. Why must a dead-letter queue’s depth be alerted on?
Because SQS charges a higher rate for messages stored in a DLQ.
Because a filling DLQ is a failure no dashboard otherwise shows.
Because the DLQ stops accepting messages once it passes a depth limit.
Because alerting is what moves the messages from the DLQ back to the source.
4. A team sets maxReceiveCount to 1 on the source queue. What is the likely problem?
Messages will never reach the DLQ because one receive is too few.
The DLQ will reject the moved messages for exceeding the count.
The source queue will stop delivering messages after the first one.
A single transient failure sends a message to the DLQ prematurely.
4
Topic 4 of 5
Idempotency end-to-end — HTTP → event → consumer
Why Do I Need to Know This?
The Outbox relay and SQS both deliver at-least-once, which means a consumer will eventually see the same event twice — and the DLQ redrive from DLQs and redrive — retries, recovery, and alerting deliberately replays messages, multiplying the chances. If the audit consumer writes a row every time it sees filing.submitted, a duplicate becomes a second audit record for one filing. Carrying an idempotency key from the original HTTP request all the way through the event to the consumer is what keeps a retried or replayed message from double-writing.

Scenario
A citizen’s browser retries a slow POST /filings, and 4.1 NoSQL, Caching & Idempotency’s HTTP idempotency layer correctly returns the same result for both requests — one filing. But the event is published once per successful handling path, and a relay republish plus a DLQ redrive mean the audit consumer receives filing.submitted three times. Without dedup it writes three audit rows. The team threads the original Idempotency-Key into the event as an attribute, and the audit consumer records each processed key, so the second and third deliveries are recognized and skipped.

Theory
At-least-once makes duplicates the normal case
Every delivery mechanism in this module is at-least-once: the Outbox relay can republish after a crash, SQS standard queues can redeliver, and a DLQ redrive replays on purpose. So a duplicate is not a rare bug to be surprised by — it is the expected case to design for. The rule is to make every consumer idempotent: handling the same event twice produces the same result as handling it once. You achieve that by deduping on a key, not by hoping a duplicate never arrives.

The key travels end-to-end
Idempotency works only if the same key identifies the same logical operation at every hop. The Idempotency-Key the client sent on POST /filings (4.1 NoSQL, Caching & Idempotency) is carried into the event as an attribute, and the consumer dedupes on that key. Reusing the original key — rather than minting a new id per hop — is what lets the consumer recognize "I already processed this operation," even across a republish or a redrive. The CloudEvents id from 6.1 Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis can serve as that key when the event maps one-to-one to the operation. Concretely, the producer sets the event’s id to the original Idempotency-Key, so the event.id the consumer dedupes on below is exactly that same end-to-end key.

A consumer dedupes against a processed-key store
A consumer makes itself idempotent by recording the keys it has already handled and checking that store before acting. The capstone reuses the same idempotency store from 4.1 NoSQL, Caching & Idempotency — Redis with a TTL, or DynamoDB — so a consumer’s first move is "have I seen this key?" If yes, skip; if no, process and record the key in the same step. Idempotency composes with the rest of the module: it is what makes the Outbox relay’s republish and the DLQ’s redrive safe to replay.

i
Note
Record the key as part of processing, not after. If a consumer processes the event and then records the key as a separate step, a crash between them lets the next delivery process it again. Record the key in the same transaction as the work, or use a conditional write that both checks and claims the key at once.

One key from HTTP through the event to the consumer
The client’s idempotency key rides into the event and drives the consumer’s skip-or-process decision.

yes

no

POST /filings (Idempotency-Key: k)

Handler writes filing + outbox event (carries k)

Relay publishes event (attribute: k)

Consumer: seen k?

Skip -- already processed

Process + record k in the dedupe store

Example
an idempotent consumer keyed on the event
async function handleFilingSubmitted(event: CloudEvent) {
  const key = event.id;                                       // (1) the end-to-end idempotency key

  const claimed = await redis.set(`seen:${key}`, "1",         // (2) check-and-claim in one atomic step
    { NX: true, EX: 60 * 60 * 24 });                          // NX = only if absent; EX = 24h TTL
  if (claimed === null) return;                               // (3) already processed — skip

  await writeAuditRow(event.data);                            // (4) the real work runs exactly once
}
Copy
Annotation (1) — the consumer dedupes on the event’s id, the key carried from the original request through the outbox and the broker.
Annotation (2) — SET key value NX EX both checks for the key and claims it in one atomic command, closing the gap a separate check-then-set would leave.
Annotation (3) — null means the key already existed, so this is a duplicate delivery; the consumer returns without re-writing.
Annotation (4) — the audit write runs only on the first delivery, so a republish or a DLQ redrive cannot create a second row.
AI Practice
Prompt it
Have Codex make the audit consumer idempotent, then verify duplicates and a replay produce one effect.

Make our audit consumer idempotent against duplicate filing.submitted events. Use
the event id as the idempotency key and the Module 4 Redis idempotency store: claim
the key with SET NX EX (24h TTL) and skip if it already exists, otherwise write the
audit row. Then thread the original HTTP Idempotency-Key into the published event
so it is the same key end-to-end. Show the consumer and where the key is attached.
Copy
Watch out
Codex frequently checks the key and then sets it in two separate calls, leaving a race where two concurrent duplicates both pass the check. It may mint a new id at the consumer instead of using the key carried from the request (so a republish looks new), or write the audit row before claiming the key (so a crash between them double-writes). Confirm the check-and-claim is a single atomic operation, the key is the one carried end-to-end, and the work runs only after the key is claimed.

Verify
Deliver the same event three times and confirm exactly one audit row is written. Replay the event through a DLQ redrive and confirm no new row appears. Send two duplicates concurrently and confirm only one wins the claim. Confirm the event’s key matches the original HTTP Idempotency-Key, not a freshly minted id. Record any check-then-set race or pre-claim write Codex produced in your prompt journal.

Knowledge Check
1. Why is handling duplicate events the normal case in this module, not a rare bug?
Because SNS intentionally sends every event twice for redundancy.
Because the CloudEvents envelope permits a consumer to be invoked twice per id.
Because federal audit rules require each event to be delivered twice.
Because the relay, SQS, and DLQ redrive all deliver at-least-once.
2. Why thread the original HTTP Idempotency-Key into the event instead of generating a new id at each hop?
Because a new id per hop would exceed the event’s maximum attribute size.
Because the broker rejects events whose ids change between hops.
The same operation keeps one key, so a repeat is recognizable.
Because generating ids at each hop is slower than reusing one key.
3. Why claim the idempotency key with a single SET NX EX rather than a separate check then set?
Because two commands use more Redis memory than a single command does.
Because a separate check-then-set has a race window.
Because SET NX EX also writes the audit row within the very same call.
Because a separate check and set cannot place a TTL on the key.
4. A consumer writes the audit row and then records the key as a separate step. What can go wrong?
A crash between the two lets the next delivery write a second row.
The key is recorded twice, overwriting the first audit row.
The TTL on the key expires before the audit row is committed.
The consumer cannot read the key it just wrote on the next delivery.
5
Topic 5 of 5
Practice — make the capstone's eventing reliable end to end
Why Do I Need to Know This?
This lesson’s payoff is an event bus you can trust under failure: no lost events (Outbox), multi-step workflows that stay consistent when a step fails (sagas), poison messages that are caught and reprocessed instead of blocking or vanishing (DLQ + redrive), and consumers that survive the duplicates all of that produces (end-to-end idempotency). The way to know you have it is to build the path and then attack it — crash between the write and the publish, fail a saga’s third step, poison a queue, deliver the same event three times — and confirm each guarantee holds. This exercise drives Codex through the reliable path and verifies by breaking each link.

AI Practice
Prompt it
Hands-on practice for this lesson — build the reliable eventing path with Codex, then break each guarantee.

Make our filing eventing reliable end to end against LocalStack + Postgres:
(1) write filing.submitted via an Outbox table in the filing's transaction, with a
relay that claims rows FOR UPDATE SKIP LOCKED and marks them sent only after the
SNS publish confirms; (2) model the three-step submission as a saga with reverse
compensations; (3) configure the analytics queue with a DLQ at maxReceiveCount 3,
a DLQ-depth alert, and a redrive; (4) make the audit consumer idempotent on the
event id with SET NX EX, threading the original HTTP Idempotency-Key end to end.
Show the outbox + relay, the saga, the DLQ/redrive config, and the consumer.
Copy
Watch out
Codex is likely to publish directly from the handler (re-creating the dual write), mark outbox rows sent before the publish confirms, compensate saga steps in the wrong order or rollback already-committed work, put the redrive policy on the DLQ instead of the source, skip the DLQ alert, and check-then-set the idempotency key in two calls. Each looks correct in a quick demo while breaking a guarantee under failure. Read where the publish happens, when rows are marked sent, the compensation order, which queue holds the redrive policy, and whether the key claim is atomic before trusting it.

Verify
Crash between the filing write and the relay and confirm the event survives in the outbox and publishes on restart. Fail the saga’s third step and confirm steps two and one are compensated in reverse with no leftover effect. Poison the analytics queue and confirm the message reaches the DLQ after three receives, the alert fires, and a redrive reprocesses it after the fix. Deliver one event three times and confirm a single audit row. Confirm the event’s idempotency key matches the original HTTP key. Record every guarantee that failed on the first pass in your prompt journal.

