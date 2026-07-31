Week 6 · Day 1
Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis
Make the capstone event-driven — an event taxonomy with CloudEvents 1.0 schemas, then SNS+SQS fan-out, EventBridge, and Kinesis wired against LocalStack, all behind a pick-the-right-tool decision for federal use cases.

1
Topic 1 of 6
Event vs message vs command vs query — and CloudEvents schemas
Why Do I Need to Know This?
Your capstone is about to publish its first domain events, and the word everyone reaches for is "message" — which hides three different ideas with three different ownership rules. If a producer treats a request-to-act as if it were a fact-that-happened, consumers wire themselves to the wrong thing and the bus becomes impossible to reason about. Naming each idea precisely, and giving every event one standard envelope, is what makes the rest of this week’s tooling decisions tractable.

Scenario
The four-person team is adding events to the filing flow. When a citizen submits a tax filing, three things should react: an audit record is written, a notification is queued, and an analytics counter ticks. Before wiring anything, the team agrees on two rules: a published event names something that already happened (filing.submitted), never an instruction, and every event carries a CloudEvents envelope so any consumer — the three it has now or a fourth added next quarter — can read it without a private agreement with the producer.

Theory
An event is a fact; a command is a request
These four terms are not interchangeable, and the difference is about who depends on whom.

An event is an immutable statement that something happened: filing.submitted. The producer announces it and does not know or care who listens.
A command is a request for a specific action: SubmitFiling. It is sent to one known handler that is expected to act.
A query is a request for data: "give me filing 8842." It expects a response.
A message is the envelope on the wire that carries any of the above between services.
The coupling story is the point. A command names its handler, so the sender depends on the receiver. An event names nothing, so the producer depends on no one — consumers depend on the event. Mislabel a command as an event and you get a fact no one is obligated to act on; mislabel an event as a command and you have re-coupled the services you were trying to separate.

CloudEvents gives every event one standard envelope
A self-describing event needs a standard set of fields, and CloudEvents 1.0 — a CNCF spec for a standard event envelope — defines them. Four context attributes are required on every event:

id — unique per event from this source; the handle a consumer dedupes on.
source — the system that produced it (a URI-reference).
specversion — "1.0" for this version of the spec.
type — what happened, used for routing (gov.treasury.filing.submitted).
Optional attributes include time, subject, datacontenttype, and the data payload itself. Because the envelope is identical across tools, the same filing.submitted event is readable whether it arrives through SNS, EventBridge, or Kinesis — the producer writes the schema once, in the shared-schemas package, and every consumer validates against it.

Events invert the dependency — that is the power and the hazard
A request/response call points from caller to callee: the caller must know the callee exists. An event reverses that arrow — the producer emits a fact and finishes, and consumers subscribe on their own. This is what lets you add the fourth consumer next quarter without touching the producer.

The hazard is the same arrow. Because there is no compile-time call binding a producer to a consumer, nothing stops a producer from changing an event’s shape and silently breaking every listener. The schema is the contract now, which is why a CloudEvents envelope plus a versioned schema is non-negotiable for events.

i
Note
Why this matters for federal work. An audit trail built on events needs every record to be self-describing and replayable years later. A bare JSON blob with no id, source, or type is not auditable; a CloudEvents envelope is.

The four terms on two axes
Each term differs on whether it states a fact or asks for something, and on whether the sender knows the receiver.

Event — a fact about the past
filing.submitted
Producer does not know its consumers.
Command — a request to act
SubmitFiling
Sender knows the one handler.
Query — a request for data
GetFiling(8842)
Sender knows the responder; expects a reply.
Message — the transport envelope
carries an event, command, or query on the wire.
Example
a `filing.submitted` cloudevents 1.0 envelope
{
  "specversion": "1.0",
  "id": "9f1c2e7a-3b4d-4c2a-8e11-2a7c5d8b1f04",
  "source": "/treasury/filing-service",
  "type": "gov.treasury.filing.submitted",
  "time": "2026-06-22T14:03:00Z",
  "subject": "filing/8842",
  "datacontenttype": "application/json",
  "data": { "filingId": "8842", "taxpayerId": "tp_5571", "amountDue": "1240.50" }
}
Copy
The four required attributes — specversion, id, source, type — appear first; an event missing any one of them is not a valid CloudEvent.
type is the past-tense fact (...submitted), not an instruction; this is what a router like EventBridge matches on.
data carries the domain payload; datacontenttype tells a consumer how to read it. The amountDue is a string, not a float, to preserve exact cents.
AI Practice
Prompt it
Have Codex draft the capstone’s event taxonomy, then check each entry is a past-fact event with a valid CloudEvents envelope.

For our tax-filing capstone, propose 5 core domain events for the filing lifecycle. For each, give a CloudEvents 1.0 envelope (specversion, id, source, type, time, subject, datacontenttype, data) with a past-tense type like gov.treasury.filing.submitted. Do not include commands or queries. Explain in one line why each is a fact about the past, not a request to act.
Copy
Watch out
Codex often slips a command into the list disguised as an event — filing.validate or send.notification is an instruction, not a fact, and names a handler. It may also drop a required CloudEvents attribute (commonly source or specversion) or put a number where the spec wants a string. Confirm every type is past-tense, all four required attributes are present, and no entry is really a command.

Verify
For each proposed event, ask: could two unrelated teams consume it without the producer knowing? If the answer needs a specific handler, it is a command — reject it. Check each envelope has specversion, id, source, and type, and that type reads as something that already happened. Record any command-disguised-as-event Codex produced in your prompt journal.

Knowledge Check
1. A developer wants the filing service to tell the notification service to send an email. They name it filing.notify and publish it as an event. What is wrong?
It is a command, not a past-tense fact.
The name uses a dot, but a slash like filing/notify is required to validate the event.
Events are not allowed to trigger outbound email, so this approach can never work.
It must carry the recipient’s email address inside the source context attribute.
2. You receive a JSON payload with type and data but no specversion or id. Why does this fail as a CloudEvent?
A data field is forbidden unless datacontenttype is also present in the envelope.
specversion and id are required, so the envelope is invalid.
The type value has to be a fully-qualified URL before the event will validate.
Without a time attribute, a consumer cannot order the event correctly.
3. Why does emitting an event invert the dependency compared with a direct call?
The event bus automatically sends a response back to the producer once consumers finish.
Consumers must register with the producer in advance before they can receive its events.
The producer emits a fact and names no consumer.
The producer keeps retrying each consumer until every one of them acknowledges receipt.
4. Your team plans to evolve the data shape of an existing event next sprint. What does the dependency inversion require you to protect?
Nothing — each consumer re-reads the producer’s source on deploy.
The event’s versioned schema, the only thing binding producer to consumer.
The producer’s database transaction, shared by every consumer at runtime.
The SNS topic name, changed alongside every payload edit.
2
Topic 2 of 6
SNS + SQS fan-out — standard, FIFO, and dead-letter queues
Why Do I Need to Know This?
The first eventing pattern the capstone needs is one-to-many delivery that survives a slow or crashed consumer. Amazon SNS fanned out to Amazon SQS queues is the workhorse for exactly that: one publish reaches many consumers, each with its own durable queue it drains at its own pace. Knowing the standard-versus-FIFO trade-off and how a dead-letter queue catches a poison message is what separates a delivery that quietly loses work from one you can trust.

Scenario
The team wires the filing.submitted event to its three reactions. A single SNS topic, filing-events, fans out to three SQS queues — audit, notify, analytics — each subscribed independently. The analytics consumer has a bug that throws on a malformed record; the team configures a dead-letter queue so that poison message is set aside after a few tries instead of blocking every later filing.

i
Note
These run on LocalStack. As in Module 4, the AWS services in this lesson run locally through LocalStack — endpoint http://localhost:4566, account 000000000000 — so no real AWS account or cost is involved. Docker brings LocalStack up as a black-box runner; you write SDK code against it exactly as you would against AWS.

Theory
One SNS topic fans out to many SQS queues
When several independent consumers each need every copy of an event, you publish once to an SNS topic and subscribe one SQS queue per consumer. SNS delivers a copy of each message to every subscribed queue, and each queue is a durable buffer the consumer drains on its own schedule. If the notification consumer is down for an hour, its messages wait in its queue while audit and analytics keep working — the queues isolate consumers from each other.

This is why you put a queue between the topic and each consumer rather than subscribing the consumer directly: the queue absorbs bursts and outages instead of dropping messages.

Standard delivers at-least-once; FIFO delivers in order, once per group
SQS offers two queue types, and the choice trades ordering for throughput.

A standard queue is at-least-once and unordered: nearly unlimited throughput, but a message can arrive more than once and out of order. Every consumer must therefore be idempotent (the discipline from 4.1 NoSQL, Caching & Idempotency) — a duplicate must not double-write.
A FIFO queue preserves order and removes duplicates within a MessageGroupId, using a MessageDeduplicationId to drop repeats, at a lower throughput ceiling.
The default choice for fan-out is standard, because most consumers can be made idempotent and the throughput is worth more than global ordering. Reach for FIFO only when a consumer genuinely cannot tolerate reordering within a single entity.

!
Warning
At-least-once means duplicates are normal, not exceptional. On a standard queue a consumer will eventually see the same message twice. Design every consumer to dedupe by the event’s id; carrying that idempotency end-to-end is its own topic in 6.2 Reliable Eventing: Outbox, Sagas, DLQs & Idempotency.

A dead-letter queue catches the poison message
A message that fails every time — bad data, a bug in the consumer — will be redelivered indefinitely unless you set a limit, wasting consumer cycles on a message that can never succeed. On a standard queue the other messages still flow around it (delivery is unordered and parallel); on a FIFO message group the stuck message holds up the rest of its group until it is cleared. SQS uses a redrive policy: after a message has been received maxReceiveCount times without being deleted, SQS moves it to a separate dead-letter queue (DLQ). The poisoned message is set aside — preserved in the DLQ for inspection and later reprocessing — instead of being retried forever.

The DLQ is plumbing the consumer never reads in the happy path — it exists so one bad record cannot be retried endlessly (and, on a FIFO group, cannot stall the messages behind it).

Fan-out with a dead-letter queue
One published event reaches three independent queues; the analytics queue sheds a poison message to its DLQ after the receive limit.

received > maxReceiveCount

filing.submitted (published once)

SNS topic: filing-events

SQS: audit

SQS: notify

SQS: analytics

SQS: analytics-dlq

Example
publish to the topic, receive from a subscribed queue
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";

const cfg = { region: "us-east-1", endpoint: "http://localhost:4566" }; // (1) LocalStack
const sns = new SNSClient(cfg);
const sqs = new SQSClient(cfg);

await sns.send(new PublishCommand({                                     // (2) publish once
  TopicArn: "arn:aws:sns:us-east-1:000000000000:filing-events",
  Message: JSON.stringify(cloudEvent),
}));

const queueUrl = "http://localhost:4566/000000000000/audit";
const res = await sqs.send(new ReceiveMessageCommand({                  // (3) each queue drains independently
  QueueUrl: queueUrl,
  MaxNumberOfMessages: 10,
  WaitTimeSeconds: 5,                                                   // (4) long-poll, not a busy loop
}));

for (const msg of res.Messages ?? []) {
  handleAuditRecord(JSON.parse(msg.Body));
  await sqs.send(new DeleteMessageCommand({                             // (5) delete only after success
    QueueUrl: queueUrl,
    ReceiptHandle: msg.ReceiptHandle,
  }));
}
Copy
Annotation (1) — pointing endpoint at http://localhost:4566 sends every call to LocalStack; remove it and the same code talks to real AWS.
Annotation (2) — one PublishCommand to the topic reaches all three subscribed queues; the producer never names a queue.
Annotation (3) — the audit consumer reads only its own queue; a backlog here does not affect notify or analytics.
Annotation (4) — WaitTimeSeconds long-polls so the consumer waits for messages instead of spinning.
Annotation (5) — DeleteMessageCommand runs only after the message is handled; an undeleted message is what eventually trips the DLQ.
AI Practice
Prompt it
Have Codex scaffold the SNS→SQS fan-out against LocalStack, then verify the DLQ catches a poison message.

Using @aws-sdk/client-sns and @aws-sdk/client-sqs against LocalStack
(endpoint http://localhost:4566), scaffold: an SNS topic filing-events, three SQS queues (audit, notify, analytics) subscribed to it, and a redrive policy sending analytics failures to analytics-dlq after maxReceiveCount of 3. Write a consumer for analytics that throws on a record missing filingId. Show the setup and the consumer loop.
Copy
Watch out
Codex may subscribe the consumers directly to SNS with no SQS queue in between, which loses messages whenever a consumer is down. It often forgets to delete a message after handling it (so every message looks like a failure and floods the DLQ), or sets maxReceiveCount without actually creating the DLQ. Confirm each consumer reads from its own queue, deletes on success, and that the redrive policy points at a real DLQ.

Verify
Publish one valid event and confirm all three queues receive a copy. Publish a record with no filingId to analytics and confirm it lands in analytics-dlq after the third receive — not on the first failure, and not never. Confirm the audit and notify queues keep draining while the poison message is being retried. Record whether Codex deleted messages on success in your prompt journal.

Knowledge Check
1. The notification consumer is offline for 30 minutes. With one SNS topic fanning out to three SQS queues, what happens to its messages?
SNS holds the messages itself and redelivers them once the consumer reconnects to the topic.
They wait in its queue until it returns.
They are dropped, because a fan-out delivers only to consumers that are currently live.
They are rerouted to the audit and analytics queues so that no message is lost.
2. A standard SQS queue occasionally delivers the same filing.submitted twice. What must the consumer do?
Dedupe by the event id so a repeat does not write twice.
Switch the SNS topic to deliver each message exactly once.
Lower MaxNumberOfMessages to 1 to prevent any duplicate reads.
Delete the message before processing it to avoid a second receive.
3. When is a FIFO queue the right choice over a standard queue?
Whenever the system needs the highest possible message throughput it can reach.
Whenever the consumers are too complex to be made idempotent against duplicates.
When a consumer cannot tolerate reordering within one entity.
When you want SNS to stop delivering duplicate copies of a message to the queue.
4. A malformed record makes the analytics consumer throw on every retry. With a redrive policy at maxReceiveCount 3, what happens?
The message is deleted after its very first failure to keep the queue moving.
The whole queue is paused until an operator manually clears the bad record.
SNS stops publishing to the analytics queue until the consumer bug is fixed.
After the third receive, SQS moves it to the dead-letter queue.
3
Topic 3 of 6
EventBridge — rules, schema registry, archive and replay
Why Do I Need to Know This?
SNS fan-out delivers the same event to a fixed set of queues, but federal systems often need to route an event by its content to different targets and to prove, months later, exactly what was emitted. Amazon EventBridge adds content-based routing rules, a registry that versions event schemas, and an archive you can replay. These are the capabilities an auditor and a recovery procedure both depend on, and they are why EventBridge, not raw SNS, carries the events that need governance.

Scenario
The capstone must route filing events by type: a filing.submitted goes to the processing pipeline, a filing.rejected goes to a remediation queue, and both go to audit. Hard-coding that in publishers would couple every producer to the full target list. The team puts the events on an EventBridge bus with rules that match on type, and turns on an archive so that when the remediation consumer ships a bug, they can replay the prior day’s filing.rejected events after the fix.

Theory
Rules route events by a content pattern, not a fixed subscription
The reason to reach for EventBridge first is routing that depends on what is inside the event. A rule carries an event pattern — a JSON match on fields like type or values inside data — and forwards matching events to one or more targets (a queue, a function, another bus). Publishers send every event to the bus and know nothing about the targets; routing lives in the rules, so adding a target is a rule change, not a producer change.

One naming detail bridges this to the first topic: when a producer puts an event on an EventBridge bus, it maps the CloudEvents type onto the entry’s detail-type field — EventBridge does not do this automatically; the producer sets DetailType on the PutEvents call. A rule pattern then matches on detail-type to route by the same value the first topic called type.

This is the difference from SNS fan-out: SNS copies every message to every subscriber, while an EventBridge rule delivers only the events whose content matches its pattern.

A schema registry versions the event shapes
Because consumers depend on an event’s shape, that shape needs a governed home. The EventBridge schema registry stores and versions event schemas — it can infer a schema from events flowing on the bus, and it keeps versions so a consumer can pin the shape it was built against. The registry is where "the schema is the contract" from the first topic becomes an artifact the whole team shares, rather than a convention in one producer’s code.

i
Note
Confirm schema-registry availability before relying on it locally. The local AWS emulator supports EventBridge rules and archive/replay well, but its support for the schema registry is less certain and may require a paid tier. If your environment does not provide it, treat this beat as conceptual — the "schema is the contract" discipline still holds through the versioned schemas in the shared-schemas package — and do not block the lesson on running the registry.

Archive and replay re-drive past events
A bus that only delivers live events cannot help you recover from a consumer bug that already dropped work. An EventBridge archive retains matching events for a retention window, and a replay re-emits archived events back to the bus over a chosen time range. After fixing the remediation consumer, the team replays the window of filing.rejected events and the fixed consumer processes them — recovery, backfill, and audit reconstruction all use the same mechanism.

i
Note
Replayed events are real events. A replay puts archived events back on the bus, so every consumer’s rule sees them again. Idempotent consumers (the idempotency topic in 6.2 Reliable Eventing: Outbox, Sagas, DLQs & Idempotency) are what keep a replay from double-processing the events that did succeed the first time.

A rule routes by pattern; an archive feeds replay
The bus matches each event against rule patterns and fans only matches to targets; the archive retains events for later replay.

replay a time range

Producers publish to the bus

EventBridge bus

Rule: type = filing.submitted

Rule: type = filing.rejected

Target: processing queue

Target: remediation queue

Archive (retains events)

Example
a rule with an event pattern, plus an archive
import { EventBridgeClient, PutRuleCommand, PutTargetsCommand,
         CreateArchiveCommand } from "@aws-sdk/client-eventbridge";

const eb = new EventBridgeClient({ region: "us-east-1", endpoint: "http://localhost:4566" });

await eb.send(new PutRuleCommand({                                     // (1) match by content
  Name: "route-rejected",
  EventBusName: "filing-bus",
  EventPattern: JSON.stringify({ "detail-type": ["gov.treasury.filing.rejected"] }),
}));

await eb.send(new PutTargetsCommand({                                  // (2) deliver matches to a target
  Rule: "route-rejected",
  EventBusName: "filing-bus",
  Targets: [{ Id: "remediation", Arn: "arn:aws:sqs:us-east-1:000000000000:remediation" }],
}));

await eb.send(new CreateArchiveCommand({                               // (3) retain for replay
  ArchiveName: "filing-archive",
  EventSourceArn: "arn:aws:events:us-east-1:000000000000:event-bus/filing-bus",
  RetentionDays: 30,
}));
Copy
Annotation (1) — the EventPattern matches only rejected filings; submitted filings do not reach this rule’s target.
Annotation (2) — the target is attached to the rule, not to the producer; routing changes are rule edits.
Annotation (3) — the archive retains 30 days of bus events; a later StartReplayCommand over a time range re-emits them to the bus for the fixed consumer.
To put an event on the bus in the first place, a producer calls PutEventsCommand with each entry’s Source, DetailType (set from the CloudEvents type), and Detail (the payload); the rule then matches on that detail-type.
AI Practice
Prompt it
Have Codex set up the EventBridge routing and archive, then verify a non-matching event is not delivered.

Using @aws-sdk/client-eventbridge against LocalStack, create an event bus
filing-bus with two rules: one matching detail-type gov.treasury.filing.submitted to a processing queue, one matching gov.treasury.filing.rejected to a remediation queue. Add a 30-day archive over the bus. Then show how to start a replay of the last 24 hours of rejected events. Use event patterns, not code-side filtering.
Copy
Watch out
Codex sometimes filters events in consumer code instead of in the rule’s EventPattern, which defeats EventBridge’s routing and delivers everything everywhere. It may match on the wrong field (putting type where the bus expects detail-type) or create the archive without a retention window. Confirm the pattern matches at the rule, each rule targets the correct queue, and the archive has a retention period before you trust a replay.

Verify
Publish a filing.submitted and confirm only the processing queue receives it; publish a filing.rejected and confirm only remediation receives it. Confirm neither rule delivers the other’s events. Start a replay over a past window and confirm the remediation queue receives the archived rejected events again. Record any code-side filtering Codex used instead of an event pattern in your prompt journal.

Knowledge Check
1. You need filing.rejected events to reach a remediation queue while filing.submitted events do not. Which EventBridge feature does this?
A schema registry version that is pinned to the rejected event’s shape.
An archive with a retention window that covers the rejected events.
A rule whose event pattern matches the rejected type.
A FIFO queue that orders rejected events ahead of the submitted ones.
2. How does routing with an EventBridge rule differ from SNS fan-out?
A rule retries failed targets forever, whereas SNS delivers each message only once.
SNS can match on event content, whereas EventBridge always copies to every target.
A rule delivers only events matching its pattern; SNS copies to all.
A rule requires the producer to name each target explicitly, whereas SNS does not.
3. A consumer shipped a bug and dropped a day of filing.rejected events. The bug is now fixed. What recovers the lost work?
Replaying the archive over that time range.
Re-subscribing the consumer to the SNS topic so it pulls in the old messages again.
Increasing the queue’s maxReceiveCount so the dropped events are retried.
Bumping the event’s schema version so the past events are redelivered to it.
4. Why store event shapes in the schema registry rather than only in the producer’s code?
Because EventBridge refuses to route any event that has no registered schema.
Because the registry encrypts the event payloads in transit between the services.
Because consumers read their input directly from the registry at runtime.
So consumers share a versioned contract they can pin to.
4
Topic 4 of 6
Kinesis — ordered, sharded streams you can replay by time
Why Do I Need to Know This?
Some capstone data is not a set of discrete reactions but a high-volume, continuous stream — every status change on every filing, ordered per entity, that several consumers read at their own pace. A queue delivers and then deletes, so it cannot give a late consumer the last hour of history. Amazon Kinesis Data Streams is the right shape for this: an ordered, retained log that many consumers replay independently. Knowing when a stream beats a queue is what keeps you from forcing a streaming problem into SQS.

Scenario
The capstone’s analytics needs every filing status change in order, and a new dashboard consumer joins a week after launch and needs the last 24 hours to backfill its charts. A queue would have deleted those messages as the first consumer read them. The team puts status changes on a Kinesis stream keyed by filingId, so each filing’s changes stay ordered, and the late dashboard consumer replays from a timestamp without affecting the existing readers.

Theory
A stream is an ordered, sharded log that is not deleted on read
A Kinesis stream is an append-only log split into shards. Each record carries a partition key; all records for a given key go to the same shard, and within a shard records stay ordered by arrival. Crucially, reading a record does not remove it — records stay for the retention window, so many consumers can read the same records, and a consumer can re-read.

Keying by filingId is what gives per-entity ordering: every status change for filing 8842 lands on one shard in the order it happened, even as thousands of other filings stream in parallel across the other shards.

Records are retained, so consumers replay by timestamp
Because records persist, a consumer can start reading from a point in time rather than only "new messages." Kinesis retains records for 24 hours by default, extendable up to 365 days, and a consumer asks for an AT_TIMESTAMP shard iterator to begin at any moment inside that window. That is exactly what the late dashboard consumer uses to backfill the last 24 hours — it reads history the existing consumers already passed, with no effect on them.

A queue delivers and deletes; a stream retains and replays
The choice between SQS and Kinesis comes down to one property. With a queue, a successful read removes the message — once a consumer takes it, it is gone, and a second consumer or a replay is impossible. With a stream, the read leaves the record in place, so multiple consumers and time-based replay are first-class. Use a queue when each message is a unit of work for one consumer; use a stream when the same ordered history must be read by many, or re-read over time.

!
Warning
A stream is not a work queue. If you reach for Kinesis to hand out tasks to one worker, you inherit shard management and consumer-checkpoint complexity for no benefit. Match the tool to the shape: discrete work for one consumer is SQS; an ordered history many consumers replay is Kinesis.

Per-key ordering across shards, replayed by time
Records hash to a shard by partition key and stay ordered within it; consumers read independently and can start from a timestamp.

Status changes (key = filingId)

Shard 1: ordered records

Shard 2: ordered records

Analytics consumer (live)

Dashboard consumer (replay AT_TIMESTAMP)

Example
replay a stream from a timestamp
import { KinesisClient, GetShardIteratorCommand,
         GetRecordsCommand } from "@aws-sdk/client-kinesis";

const k = new KinesisClient({ region: "us-east-1", endpoint: "http://localhost:4566" });

const { ShardIterator } = await k.send(new GetShardIteratorCommand({
  StreamName: "filing-status",
  ShardId: "shardId-000000000000",
  ShardIteratorType: "AT_TIMESTAMP",                                   // (1) start from a point in time
  Timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),              // (2) 24 hours ago
}));

const { Records } = await k.send(new GetRecordsCommand({ ShardIterator })); // (3) read history forward
for (const r of Records) {
  handleStatusChange(JSON.parse(Buffer.from(r.Data).toString()));      // (4) re-reads do not remove records
}
Copy
Annotation (1) — AT_TIMESTAMP makes the consumer start at a chosen moment instead of only new records; LATEST (only records arriving after the iterator is created) or TRIM_HORIZON (the oldest record still retained) are the other starting points.
Annotation (2) — the timestamp must fall inside the retention window (24 hours here), or there is nothing to read.
Annotation (3) — GetRecordsCommand reads forward from the iterator; you advance through the shard by following the returned next iterator.
Annotation (4) — reading does not delete; the live analytics consumer still sees these same records, because a stream retains them.
AI Practice
Prompt it
Have Codex build a Kinesis producer and a replay consumer, then verify per-key ordering and a time-bounded replay.

Using @aws-sdk/client-kinesis against LocalStack, create a stream filing-status, write 50 status-change records partitioned by filingId, then write a consumer that uses an AT_TIMESTAMP shard iterator to replay the last hour. Show that records for the same filingId arrive in order, and that the replay re-reads records a live consumer already processed. Do not use SQS.
Copy
Watch out
Codex sometimes uses a single partition key for every record (collapsing the stream to one shard and one bottleneck) or a random key (losing per-entity ordering). It may pick LATEST and then wonder why a replay reads nothing, or treat GetRecords like a queue receive and assume the record is consumed. Confirm the partition key is filingId, the iterator type is AT_TIMESTAMP for replay, and the code follows the next-iterator to page through the shard.

Verify
Write several status changes for one filingId and confirm the consumer reads them in the order written. Start a second consumer with an AT_TIMESTAMP iterator one hour back and confirm it re-reads records the first consumer already saw — proof that reads do not delete. Set the timestamp outside the retention window and confirm nothing returns. Record whether Codex preserved per-key ordering in your prompt journal.

Knowledge Check
1. A dashboard consumer joins a week after launch and needs the last 24 hours of status changes. Why does a Kinesis stream make this possible where an SQS queue would not?
The stream re-sends every record to each consumer that has ever subscribed to it.
The stream retains records, so a late consumer can read history.
A queue could do this too, simply by raising its message retention to one week.
The stream copies each record into a separate per-consumer queue automatically.
2. You partition the stream by filingId. What ordering guarantee does that give?
All records for one filingId stay ordered on a single shard.
Every record across the entire stream is placed into one global order.
Records are ordered only when the stream is configured with exactly one shard.
Ordering is guaranteed for the live consumer but not for any later replay.
3. A developer wants to hand filing-export tasks to a single worker, one task each. Which tool fits, and why?
Kinesis, because its shards would parallelize the export work across many workers.
Kinesis, because an AT_TIMESTAMP iterator lets the worker retry old tasks.
Either tool works identically here, so pick whichever is already configured.
SQS, since each task is consumed once by one worker.
4. A replay consumer sets AT_TIMESTAMP to 48 hours ago on a stream with default retention and reads nothing. Why?
An AT_TIMESTAMP iterator can only start at the current moment, never in the past.
The live consumer already deleted those records when it first read them.
Default retention is 24 hours, so 48-hour-old records aged out.
Replays require FIFO ordering, which this stream has not yet enabled.
5
Topic 5 of 6
Pick the right tool — a decision tree for federal use cases
Why Do I Need to Know This?
You now have four overlapping capabilities — SNS+SQS, EventBridge, Kinesis, and plain SQS — and the expensive mistake is defaulting to one for everything: forcing audit-grade routing through raw SNS, or streaming history through a queue that deletes it. A short decision tree grounded in the questions federal systems actually ask — is this auditable, ordered, replayable, fan-out? — turns four tools into one defensible architecture. Recording each pick in an ADR is what lets a reviewer six months from now see why a flow uses Kinesis and not SQS.

Scenario
With all four wired against LocalStack, the team assigns each capstone flow a tool. Fan-out of filing.submitted to independent consumers goes to SNS+SQS; content-routed, auditable, replayable filing lifecycle events go to EventBridge; the high-volume ordered status-change history goes to Kinesis. They write ADR-0014 recording each decision and its reason, so no one later "simplifies" the architecture down to one tool and breaks a guarantee.

Theory
Match the tool to the capability the flow needs
Each tool has a shape it fits best, and the decision is driven by what the flow requires, not by familiarity.

SNS + SQS — durable fan-out to several independent consumers, each draining its own queue. Reach for it when many consumers each need every event and a buffer per consumer.
EventBridge — content-based routing to many targets, plus schema governance and archive/replay. Reach for it when routing depends on event content and the events must be auditable and replayable.
Kinesis — an ordered, retained stream many consumers replay by time. Reach for it for high-volume ordered history that more than one consumer reads.
SQS alone — a simple point-to-point work queue: discrete tasks for one consumer, no fan-out.
The overlap is real — you could force fan-out through EventBridge or tasks through Kinesis — but each tool is cheapest to operate inside its own shape.

Federal lenses sharpen the choice
For Treasury-style systems, three questions weigh more than raw throughput. Auditability and replay: can you prove what was emitted and re-drive it? — that points at EventBridge’s archive or Kinesis’s retention. Ordering: must per-entity events stay in order? — that rules out unordered standard delivery for those flows. Least-surprise operations: the on-call engineer should not have to reason about shard checkpoints for a flow that is really a work queue. These lenses often decide between two tools that both technically work.

The choice is an ADR, not a default
Every tool pick is a decision worth recording, because the next engineer needs the reason, not just the result. The program rule (AGENTS.md) is that each messaging-tool choice is captured in an Architecture Decision Record — ADR-0014 for this module — naming the flow, the tool, and the capability that drove it. An unrecorded choice looks arbitrary later and invites a well-meaning "cleanup" that re-introduces the problem the choice avoided.

The pick-the-right-tool decision tree
Answer the capability questions in order; each leaf is the tool whose shape fits.

yes

no

yes

no

yes

no

A flow to carry

Ordered, high-volume history many consumers replay?

Kinesis

Route by event content, with audit + replay?

EventBridge

Many independent consumers each need every event?

SNS + SQS fan-out

SQS (point-to-point work queue)

Example
three capstone flows, three tools
filing.submitted → 3 independent reactions (audit, notify, analytics)   → SNS + SQS   # (1)
filing lifecycle  → route by type, must be auditable and replayable      → EventBridge # (2)
status changes    → high-volume, ordered per filing, replayed by time    → Kinesis     # (3)
Copy
Annotation (1) — fan-out to independent consumers with a buffer each; no content routing needed, so SNS+SQS is the simplest fit.
Annotation (2) — routing depends on type and the events must be replayable for audit, which is EventBridge’s shape, not SNS’s.
Annotation (3) — ordered, retained, multi-consumer history is a stream; a queue would delete the history the dashboard needs to backfill.
AI Practice
Prompt it
Have Codex draft the decision tree and tool assignments, then ratify them in ADR-0014 and reject one-tool-for-everything.

For our tax-filing capstone, map each of these flows to SNS+SQS, EventBridge, Kinesis, or plain SQS, and justify each with the capability that drives it: (a) fan-out of filing.submitted to audit/notify/analytics, (b) routing filing lifecycle events by type with audit and replay, (c) ordered high-volume status changes replayed by time, (d) a single-worker export task queue. Then draft an ADR-0014 entry recording each decision and its reason.
Copy
Watch out
Codex tends to collapse the architecture toward one familiar tool — routing everything through SNS, or proposing Kinesis for the export tasks because streams sound powerful. It may also write an ADR that states the choice without the reason, which is the part a future reviewer needs. Confirm each flow’s tool matches its capability, the export tasks use plain SQS, and the ADR names the driving capability for every pick.

Verify
For each flow, check the assigned tool against the decision tree: history-many-consumers → Kinesis, content-routing-with-audit → EventBridge, fan-out → SNS+SQS, single-worker tasks → SQS. Reject any assignment that cannot name the capability that requires that tool. Confirm ADR-0014 records the flow, the tool, and the reason for each. Record any one-tool-for-everything tendency Codex showed in your prompt journal.

Knowledge Check
1. A flow carries high-volume status changes that must stay ordered per filing and be replayed by a late consumer. Which tool, and why?
EventBridge, because its content rules can route the status changes by their type.
SNS+SQS, because fan-out gives each consumer its own independent copy of the events.
SQS alone, because a single durable work queue is the simplest available option.
Kinesis — an ordered, retained log replayed by time.
2. Why record each messaging-tool choice in ADR-0014 rather than just wiring it?
So a later engineer sees the reason behind each pick.
Because EventBridge refuses to route any events unless a matching ADR is registered.
Because the ADR file is what actually configures the SNS topics and routing rules.
Because AWS bills the account differently for flows that have an ADR attached to them.
3. Two tools could technically carry a fan-out flow to several consumers. Which is the least-surprise choice, and why?
Kinesis, because its shards would let each consumer scale up independently.
SNS+SQS — fan-out to a durable queue per consumer is its shape.
EventBridge, because every fan-out flow also needs content-based routing rules.
Plain SQS, because one shared queue can serve all of the consumers at once.
4. A teammate proposes routing every event — fan-out, content-routed, and streaming — through SNS to keep things simple. What is the problem?
SNS cannot publish more than one event type, so it will reject most of these flows.
SNS would order the streaming events incorrectly but handle the other flows fine.
SNS lacks content routing, audit/replay, and ordered retained history.
Nothing — consolidating onto a single tool is always the right call for simplicity.
6
Topic 6 of 6
Practice — design the capstone's event backbone
Why Do I Need to Know This?
This lesson’s payoff is one defensible decision: which of the four messaging tools carries each of the capstone’s flows, with a CloudEvents schema on every event and an ADR recording each pick. The way to know you have it is to build all four against LocalStack, route a real event through each, and then attack the design — publish a duplicate and confirm the consumer dedupes, replay an archive and confirm a fixed consumer reprocesses, point a streaming flow at a queue and watch the history vanish. This exercise drives Codex through the wiring and verifies by breaking each guarantee.

AI Practice
Prompt it
Hands-on practice for this lesson — wire all four tools against LocalStack and assign the capstone’s flows, then try to break each guarantee.

Against LocalStack, build the capstone's event backbone in TypeScript: (1) define 5 filing-lifecycle events as CloudEvents 1.0 schemas; (2) wire SNS+SQS fan-out of filing.submitted to audit/notify/analytics with a DLQ at maxReceiveCount 3; (3) put filing-lifecycle events on an EventBridge bus with content-routing rules and a 30-day archive; (4) put ordered status changes on a Kinesis stream keyed by filingId with an AT_TIMESTAMP replay consumer; (5) assign each flow its tool in an ADR-0014 entry with the driving capability. Show the schemas, the wiring for each tool, and the ADR.
Copy
Watch out
Codex is likely to emit a command disguised as an event, subscribe consumers directly to SNS with no queue, filter EventBridge events in code instead of in a rule, collapse the Kinesis stream to one partition key, configure the DLQ or archive without actually creating it, and write an ADR that states picks without reasons. Each passes a quick demo while breaking a guarantee the backbone depends on. Read where each event is routed, whether queues sit between SNS and consumers, where filtering happens, the partition key, and whether the ADR names a capability before trusting it.

Verify
Confirm every event validates as CloudEvents 1.0 (four required attributes, past-tense type). Publish a duplicate to a standard queue and confirm the consumer dedupes by id; push a poison record and confirm it reaches the DLQ after three receives. Publish a non-matching type and confirm the EventBridge rule does not deliver it; replay the archive and confirm the fixed consumer reprocesses. Write same-filingId records and confirm per-key ordering, then replay by timestamp and confirm reads do not delete. Confirm ADR-0014 names the capability behind each pick. Record every guarantee that failed on the first pass in your prompt journal.

