🕐 Last Updated: 2026-07-30 17:29:26 UTC
📌 Commit: e1aa43be
Week 9 · Day 2
Pipelines & Data Quality
Build a production data pipeline — extract, validate, transform, load, publish event — with pydantic v2 at every boundary, data-quality checks, bad-row quarantine, and per-stage metrics.

1
Topic 1 of 5
Pipeline architecture — extract, validate, transform, load, publish event
Why Do I Need to Know This?
The corpus exploration from 9.1 Python Data Tooling told the team what its data looks like; now they have to ingest it for real, on a schedule, into the database the AI-Assist feature reads from. A pipeline written as one long script is impossible to debug when a row count comes out wrong. Splitting it into named stages with a clear contract between them is what lets the team find which stage dropped rows and prove the corpus loaded correctly.

This staged shape is the spine of the week’s pipeline deliverable: every later topic — validation, data quality, batch scheduling — attaches to one stage of this architecture.

Scenario
The team’s first ingest is a single 200-line function. When the loaded row count comes out lower than the source row count, no one can tell which step lost the rows — the read, a transform, or the write. They re-architect it into five named stages — extract, validate, transform, load, publish event — each emitting count_in, count_out, and count_bad, and the leak becomes obvious at a glance.

Theory
Five stages, each with one job
A pipeline is a sequence of stages, each with a single responsibility and a typed input and output: extract (read from the source), validate (reject malformed rows), transform (reshape and enrich), load (write to the database), and publish event (announce the corpus changed). Because each stage has one job, a failure is localized to a stage instead of buried in a monolith — the team can point at the validate stage rather than guess.

Every stage emits its counts
Each stage emits three metrics: count_in (rows received), count_out (rows passed on), and count_bad (rows rejected). This is the program’s AGENTS.md rule, and it makes row conservation verifiable: at any stage, count_out + count_bad must equal count_in. When the loaded total is wrong, the stage where count_out drops below count_in without a matching count_bad is the leak.

The last stage publishes a domain event
The final stage emits a domain event announcing the corpus has been refreshed, reusing the event backbone from 6.1 Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis (SNS / EventBridge). Downstream consumers — including the retrieval index the AI-Assist depends on — subscribe to that event instead of polling, so a refreshed corpus propagates without anyone re-running anything by hand.

The five-stage pipeline with per-stage counts
Each stage reports its counts; rejected rows branch to quarantine instead of vanishing.

count_bad

count_bad

extract

validate

transform

load

publish event

quarantine

Example
a staged pipeline that reports its counts
# pipeline/run.py — five stages, each logging count_in / count_out / count_bad
# extract/validate/transform/load/quarantine/publish_corpus_refreshed are each defined in their own stage module
import logging
log = logging.getLogger("pipeline")

def run(source: str) -> None:
    rows = extract(source)                       # (1) read
    log.info("extract", extra={"count_in": len(rows), "count_out": len(rows), "count_bad": 0})

    good, bad = validate(rows)                    # (2) split valid from invalid
    log.info("validate", extra={
        "count_in": len(rows), "count_out": len(good), "count_bad": len(bad),
    })
    quarantine(bad)                              # (3) bad rows are kept, not dropped

    shaped = transform(good)                      # (4) reshape + enrich
    load(shaped)                                 # (5) write to Postgres
    publish_corpus_refreshed(len(shaped))        # (6) emit the domain event
Copy
(1) extract reports count_out equal to the rows it read; nothing is filtered yet.
(2) validate returns two lists, so count_out + count_bad equals its count_in exactly — the conservation check.
(3) The rejected rows go to quarantine, never silently dropped, so a wrong count always has a paper trail.
(4)–(5) transform and load operate only on the good rows.
(6) publish_corpus_refreshed emits the event that tells the retrieval index to rebuild.
AI Practice
Prompt it
Have Codex plan the pipeline as named stages and wire the per-stage counts.

Plan our corpus ingest as a pipeline with five named stages — extract, validate,
transform, load, publish event — each as a typed function. Every stage must log
count_in, count_out, and count_bad. Rejected rows go to a quarantine sink, not dropped. Show the run() that wires the stages and the log line each emits.
Copy
Watch out
Codex tends to collapse the stages back into one function (so a failure can’t be localized), drop rejected rows instead of quarantining them (so count_out + count_bad no longer equals count_in), or log only a final total instead of per-stage counts. Each makes the pipeline look done while removing the thing that makes a wrong count diagnosable. Confirm the stages are separate, the counts balance at each one, and bad rows are quarantined.

Verify
Run the pipeline on a sample with a few deliberately malformed rows and confirm each stage logs count_in, count_out, and count_bad, and that count_out + count_bad == count_in at the validate stage. Confirm the rejected rows landed in quarantine, not nowhere. Confirm the publish stage emits the corpus-refreshed event. Then, without AI, explain how the per-stage counts let you find which stage leaked rows.

Knowledge Check
1. A monolithic ingest script loads fewer rows than the source contains, and no one can tell where the rows went. Which re-architecture makes the leak diagnosable, and why?
Wrap the whole script in a try/except that logs the final loaded count, so the error message reveals the missing rows.
Run the script twice and diff the two loaded counts, since a stable difference points directly at the offending line.
Split it into named stages that each emit count_in, count_out, and count_bad, so the leaking stage is visible.
Add more logging statements throughout the single function, so every intermediate variable’s length is printed somewhere.
2. At the validate stage, count_in is 10,000, count_out is 9,950, and count_bad is 20. What does this tell you?
30 rows are unaccounted for, because count_out plus count_bad should equal count_in but sums to 9,970.
The stage is healthy, because count_out is close enough to count_in and 20 bad rows is an acceptable rejection rate.
9,950 rows were rejected, because count_out always records the number of rows the stage filtered out as invalid.
Nothing is wrong yet, because count_bad will be reconciled against count_out automatically at the load stage later.
3. Why does the final pipeline stage publish a domain event rather than having downstream consumers poll the database for changes?
Because publishing an event is the only way to write to Postgres, since the load stage cannot commit its rows without one being emitted first.
Because polling is forbidden by pydantic, which rejects any consumer that reads the table without a validated event.
Because the event carries the full refreshed corpus inline, so consumers never need to read the database at all.
Because consumers subscribe to the refresh event and rebuild on it, so a refreshed corpus propagates without manual re-runs.
4. Where in the five-stage pipeline does a malformed row get stopped, and what happens to it?
At the extract stage, where the row is read and immediately deleted from the source so it cannot enter the pipeline.
At the validate stage, where it is rejected and written to quarantine rather than passed to transform.
At the load stage, where the database constraint rejects it and the pipeline silently skips it to keep loading.
At the publish-event stage, where the consumer inspects each row and returns the malformed ones to the source.
2
Topic 2 of 5
pydantic v2 validation at every boundary
Why Do I Need to Know This?
Every place data enters or leaves the pipeline is a place a bad assumption can corrupt everything downstream. A source file that quietly changes a date format, a field that arrives null when the code assumes a value — these slip through untyped reads and surface as a wrong answer in the AI-Assist much later. pydantic v2 models at each boundary turn "I hope this row has the right shape" into a typed contract that fails loudly and early.

The validate stage from the pipeline architecture is where these models live; this topic is how that stage actually rejects a bad row.

Scenario
A source file changes its date format from ISO to a regional one, and the old pipeline happily loads rows with garbage dates that later break every date-range query the AI-Assist runs. A pydantic v2 model at the extract boundary rejects those rows at the door, with a precise error naming the field and the offending value — so the bad input is caught the moment it arrives, not three stages later.

Theory
A boundary is any edge data crosses
A boundary is where validation belongs. Validate at the boundary and the typed core of the pipeline can trust its inputs; skip it and every downstream stage has to defend itself against malformed data. The extract and load stages are the two boundaries this pipeline guards.

pydantic v2 models declare and enforce the shape
A pydantic model declares each field’s type and constraints, and model_validate(data) either returns a typed instance or raises ValidationError with a per-field breakdown of what was wrong (pydantic docs). pydantic v2 is the current major and its validation core is written in Rust (pydantic-core), so validating every row at the boundary is fast enough to do on the whole corpus.

»
Tip
For a rule a plain type can’t express — a money field that must be positive, a code that must match a pattern — add a field_validator. Raise ValueError inside it and pydantic folds the failure into the same ValidationError as a type mismatch (pydantic validators).

Boundary validation is structural, not statistical
pydantic checks each row’s shape: are the required fields present, are the types right, does each value satisfy its declared constraint. It does not check whether the set of rows makes sense — that a total reconciles, that there are no duplicates, that today’s batch isn’t suspiciously small. Those are data-quality checks, covered next; boundary validation and data-quality checks are complementary, not the same.

A pydantic model splits valid rows from rejected ones
Each incoming row is validated; failures carry field-level detail to quarantine.

valid

invalid

raw row

model_validate

typed row -> transform

ValidationError -> quarantine

Example
a pydantic v2 model at the extract boundary
from datetime import datetime
from pydantic import BaseModel, field_validator, ValidationError

# (1) the typed contract for one income event
class IncomeEvent(BaseModel):
    filer_id: str
    amount_cents: int
    filed_at: datetime

    @field_validator("amount_cents")             # (2) a rule a type can't express
    @classmethod
    def non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("amount_cents must be >= 0")
        return v

def validate(rows: list[dict]) -> tuple[list[IncomeEvent], list[dict]]:
    good, bad = [], []
    for row in rows:
        try:
            good.append(IncomeEvent.model_validate(row))   # (3) returns typed or raises
        except ValidationError as e:
            bad.append({"row": row, "errors": e.errors()})  # (4) field-level detail kept
    return good, bad
Copy
(1) The model declares the three fields and their types; a missing field or wrong type fails validation automatically.
(2) The field_validator adds the non-negative rule that the int type alone can’t enforce.
(3) model_validate returns a typed IncomeEvent or raises ValidationError — no halfway-valid row gets through.
(4) The error’s errors() gives a per-field breakdown, which is stored with the bad row so quarantine is inspectable.
AI Practice
Prompt it
Have Codex generate pydantic v2 models for the pipeline boundaries.

Generate pydantic v2 models for our extract and load boundaries from this schema and
sample rows. Declare every field's type, mark required vs optional correctly, and add
field_validator rules for the money field (non-negative) and any code that must match a pattern. Show the validate() that returns (good, bad) and keeps the field-level errors on each bad row.
Copy
Watch out
Codex may reach for pydantic v1 syntax (parse_obj, @validator) instead of v2 (model_validate, field_validator), mark genuinely-required fields as Optional so nulls slip through, or catch the ValidationError and drop the row without keeping its error detail. Each looks like validation while weakening it. Confirm the v2 API, that required fields are not optional, and that bad rows retain their field-level errors for quarantine.

Verify
Feed the model a row with a missing field, a wrong type, and a negative amount, and confirm each is rejected with a field-level ValidationError. Confirm the code uses v2 model_validate/field_validator, not v1 parse_obj/@validator. Confirm validate() returns both good and bad lists and that each bad row keeps its errors() detail. Then, without AI, explain why boundary validation does not replace the data-quality checks coming next.

Knowledge Check
1. Why does the pipeline validate rows with a pydantic model at the extract boundary rather than letting bad data flow in and checking it later?
Because pydantic validation is the only operation that can read a file, so extraction itself depends on the model.
Because validating at the boundary lets the typed core trust its inputs, so downstream stages need not re-defend against bad data.
Because rows that fail validation are automatically repaired by pydantic and re-inserted into the source file.
Because boundary validation removes the need for any database constraints, since pydantic already enforces every single rule the database otherwise would.
2. A money field must never be negative, but int alone can’t express that. How do you enforce it in a pydantic v2 model?
Override __init__ on the model to check the value, since field-level rules are not supported in pydantic v2.
Catch the bad value in the transform stage instead, because pydantic can only check types and never value ranges.
Add a field_validator that raises ValueError when the value is negative, which pydantic folds into the ValidationError.
Declare the field as PositiveInt and nothing else, since that alias silently coerces any negative number to its absolute value.
3. What is the difference between what a pydantic boundary model checks and what a data-quality check covers?
They are the same check applied twice; the model runs it at extract and the data-quality layer re-runs it at load for safety.
The model checks the whole batch’s statistics, while a data-quality check validates one row’s types in isolation.
The model checks database constraints, while a data-quality check only formats the error messages for the quarantine log.
The model checks each row’s shape and types; a data-quality check reasons about the set of rows, like totals or duplicates.
4. Codex hands you a validation model using parse_obj and @validator. What should you change, and why?
Nothing; parse_obj and @validator are the current pydantic v2 API and are the recommended way to validate a row.
Replace them with json.loads and a manual if per field, since pydantic should not be used inside a pipeline at all.
Keep @validator but rename the file, because the decorator name is fine and only the module path matters in v2.
Switch to v2 model_validate and field_validator, because parse_obj and @validator are the deprecated v1 API.
3
Topic 3 of 5
Data-quality checks, bad-row quarantine, and alerting
Why Do I Need to Know This?
Boundary validation catches the wrong shape; it does not catch a value that is well-formed but wrong — a negative income that slipped a missing validator, a filing dated in the future, a duplicate filer. Data-quality checks catch those, and a bad row must be quarantined and surfaced, never silently dropped. A corpus that quietly absorbs bad data produces an AI-Assist that confidently cites wrong numbers.

This is where the pipeline earns trust: the team can show an auditor that a bad row triggers a documented, alerting path rather than disappearing.

Scenario
A source delivers a batch where half a percent of rows have a negative amount — structurally valid integers, semantically impossible for income. The data-quality checks flag them, the rows land in a quarantine bucket with the reason attached, and when the quarantine rate crosses a threshold an alarm pages a human — instead of the bad data reaching the corpus and surfacing as a wrong AI-Assist answer.

Theory
Data-quality checks assert expectations about values
A data-quality check tests whether the data is sensible, not just well-typed: amounts within a plausible range, filer ids unique, every jurisdiction code present in the reference table, the batch recent enough. You can write these as custom assertions, or use a library like Great Expectations (GX Core), which packages these as reusable, named checks.

A failed row is quarantined, never dropped
A row that fails a data-quality check is written to a quarantine sink with the reason it failed, so it can be inspected and replayed after the source is fixed. Silently dropping it destroys the evidence and hides the problem; quarantining it keeps the count honest (it shows up as count_bad) and the row recoverable.

Quarantine above a threshold pages a human
A few bad rows is noise; a spike is a signal that the source changed or broke. When the quarantine rate crosses a threshold, the pipeline fires an alarm — reusing the runbook discipline from 8.4 The Secure-Release Gate and the CloudWatch alarm pattern from 8.5 Deploy, Observe & Triage — Sprint 5 — so a bad batch becomes a paged human with a runbook, not a corrupted corpus discovered weeks later. This is the "how a single bad row becomes a paged human" path.

The data-quality gate and its alerting path
Rows pass or are quarantined with a reason; a quarantine spike pages a human.

pass

fail

yes

no

validated rows

data-quality checks

load to corpus

quarantine + reason

quarantine rate > threshold?

alarm + runbook

Example
a data-quality check with quarantine and an alert threshold
# pipeline/dq.py — custom data-quality assertions over a validated batch
def check_quality(rows: list[IncomeEvent], seen_ids: set[str]) -> tuple[list, list]:
    good, bad = [], []
    for r in rows:
        reasons = []
        if r.amount_cents <= 0:                       # (1) range expectation
            reasons.append("amount_not_positive")
        if r.filer_id in seen_ids:                    # (2) uniqueness expectation
            reasons.append("duplicate_filer_id")
        if reasons:
            bad.append({"row": r, "reasons": reasons})  # (3) reason travels to quarantine
        else:
            seen_ids.add(r.filer_id)
            good.append(r)
    return good, bad

def gate(good, bad, alarm) -> None:
    rate = len(bad) / max(len(good) + len(bad), 1)    # (4) quarantine rate
    if rate > 0.02:                                   # (5) threshold -> page a human
        alarm.fire("dq_quarantine_rate_high", rate=rate,
                   runbook="/runbooks/dq-spike")
Copy
(1)–(2) Each expectation is a named check on the data’s values, beyond what the pydantic types guaranteed.
(3) A failing row carries its reasons to quarantine, so the quarantine record explains itself.
(4) The quarantine rate is bad rows over total rows for the batch.
(5) Crossing the threshold fires an alarm with a runbook link — the same alarm discipline as 8.4 The Secure-Release Gate / 8.5 Deploy, Observe & Triage — Sprint 5 — turning a bad batch into a paged human.
AI Practice
Prompt it
Have Codex draft the data-quality checks, then prove one fires on a planted bad row.

Draft five data-quality checks for our income-event batch beyond pydantic types: a
range check on amount, a uniqueness check on filer_id, a referential check that
jurisdiction_code exists in the reference table, a freshness check on filed_at, and a
batch-size sanity check. Each failing row goes to quarantine with its reason. Add a
gate that fires an alarm with a runbook link when the quarantine rate exceeds 2%.
Copy
Watch out
Codex tends to write checks that drop failing rows instead of quarantining them with a reason, set the alarm threshold so high it never fires (or so low it always does), or duplicate the pydantic type checks as "data quality" rather than adding real value-level expectations. Confirm every failing row is quarantined with a reason, the threshold is defensible, and the checks assert things pydantic could not.

Verify
Plant a batch with a negative amount, a duplicate filer id, and an unknown jurisdiction code, and confirm each lands in quarantine with the correct reason rather than being dropped or loaded. Confirm the alarm fires when the quarantine rate crosses the threshold and stays quiet below it. Confirm the checks assert value-level expectations, not the type rules pydantic already covered. Then, without AI, explain why a bad row must be quarantined rather than dropped.

Knowledge Check
1. A row passes the pydantic model but carries a filing dated next year. Which layer should catch it, and why does the pydantic model not?
A data-quality freshness check catches it, because the date is structurally valid so the type model has no reason to reject it.
The pydantic model should catch it, because any datetime field automatically rejects dates outside the current year.
The database load stage catches it, because a timestamp column rejects any value that is later than the insert time.
No layer should catch it, because a future filing date is always perfectly valid data and never indicates any kind of source problem.
2. Why must a row that fails a data-quality check be written to quarantine rather than silently dropped?
Because dropping a row crashes the pipeline, so quarantine is the only way to keep the run from aborting on bad data.
Because quarantine keeps the row inspectable and recoverable and keeps count_bad honest, while dropping hides the problem.
Because quarantined rows are automatically re-validated and then loaded on the very next run once the source has been fixed upstream.
Because the database requires every rejected row to be stored in a separate table before it will accept any good rows.
3. The pipeline fires an alarm only when the quarantine rate crosses a threshold rather than on every quarantined row. What is the reasoning?
A few bad rows are routine noise, but a spike signals the source changed or broke, which is what should page a human.
A per-row alarm is impossible because alarms can only read aggregate metrics and never see an individual row event.
Quarantining a single row never indicates a real problem, so individual quarantined rows should not be recorded at all.
The threshold exists only to reduce CloudWatch costs, since each individual alarm evaluation is billed per quarantined row.
4. A check labeled "data quality" simply re-runs the pydantic type validation on each row. Why is this not a real data-quality check?
It is a genuine data-quality check, because re-validating the row types a second time is in fact the entire core purpose of the data-quality layer.
It is fine as long as it runs in a different file, since the data-quality layer is defined by its location, not its content.
It only repeats the shape check pydantic already did, instead of asserting value- or batch-level expectations pydantic can’t see.
It is wrong because pydantic validation must never run more than once, and a second run corrupts the already-typed rows.
4
Topic 4 of 5
Batch versus streaming, and when to upgrade
Why Do I Need to Know This?
The team’s pipeline runs in scheduled batches, and that is the right default — but a learner should be able to say when batch stops being enough and what a streaming upgrade actually costs, so the choice is deliberate rather than dogmatic or driven by novelty. Picking streaming when batch would do buys a lot of operational complexity for latency no one needed.

Scenario
A stakeholder asks whether the AI-Assist can answer questions about a filing the moment it is submitted. The team weighs that latency requirement against the cost of running a streaming system and decides a batch every fifteen minutes meets the actual need — the corpus is fresh enough for the feature, without the operational weight streaming would add.

Theory
Batch and streaming differ in when work runs
Batch processing runs on a schedule and is simple, cheap, and high-latency. Stream processing processes records as they arrive: low-latency, but with more infrastructure, more failure modes, and more to operate. The same five pipeline stages apply to both; what changes is whether they run on a clock or per-record.

Upgrade on a real latency requirement, not novelty
The trigger to move from batch to streaming is a latency requirement the business will actually pay for — "users must see this within seconds" — not the appeal of real-time architecture. Most pipelines are correctly batch, and the team’s fifteen-minute schedule is a deliberate answer to a measured need — the same choice made in the scenario above.

Streaming builds on the event backbone you already have
A streaming upgrade is not a rewrite from zero: it builds on the 6.1 Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis event backbone (SNS / SQS / EventBridge / Kinesis), and the pipeline’s existing "publish event" stage already emits the signal a streaming consumer would react to. That means the team can start batch and upgrade the latency-sensitive path later without throwing the architecture away.

Batch versus streaming trade-offs
The two models compared on the axes that decide between them.

Batch vs streaming
Axis	Batch	Streaming
Latency	minutes to hours	seconds or less
Complexity	low — one scheduled job	high — always-on consumers
Cost	runs only on schedule	always-on infrastructure
Upgrade when…	a real latency requirement the business will pay for forces it
Example
a scheduled batch trigger, with the streaming alternative sketched
# (1) BATCH: the pipeline runs on a schedule (EventBridge cron → this entry point)
def main() -> None:
    run("s3://atlas-corpus/incoming/")   # the five-stage pipeline from Topic 1

# Scheduled every 15 minutes by an EventBridge rule:
#   schedule_expression = "rate(15 minutes)"   # (2) the latency the feature needs

# (3) STREAMING alternative (pseudocode) — only if a real-time requirement appears:
#   for record in kinesis_stream:            # always-on consumer, not a schedule
#       run_one(record)                      # same stages, per-record
#   # cost: a running consumer, checkpointing, retries, ordering — operate all of it
Copy
(1) The batch entry point runs the same five-stage pipeline; batch vs streaming changes the trigger, not the stages.
(2) A fifteen-minute schedule is the deliberate answer to the feature’s latency need — fresh enough, cheap to run.
(3) The streaming sketch (marked pseudocode) shows the upgrade path: an always-on consumer over the 6.1 Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis stream, taken on only when a real latency requirement justifies the extra operational weight.
AI Practice
Prompt it
Have Codex contrast a batch and streaming design for the corpus, then justify the choice.

For our corpus ingest, sketch both a batch design (an EventBridge-scheduled run of our
five-stage pipeline) and a streaming design (an always-on consumer over a Kinesis
stream). For each, list latency, operational complexity, and cost. Then recommend one
for a feature whose freshness requirement is "within 15 minutes" and justify it.
Copy
Watch out
Codex may default to the streaming design because it sounds more advanced, understate the operational cost of an always-on consumer (checkpointing, retries, ordering, scaling), or recommend streaming for a 15-minute requirement that batch meets easily. Confirm the recommendation matches the actual latency requirement and that the streaming cost is stated honestly, not glossed over.

Verify
Confirm the comparison states latency, complexity, and cost for both designs, and that the streaming side names its real operational burdens (always-on consumer, checkpointing, retries). Confirm the recommendation for a 15-minute freshness requirement is batch, with the latency requirement cited as the reason. Then, without AI, state the one condition that would justify upgrading this pipeline to streaming.

Knowledge Check
1. A feature needs its data "fresh within 15 minutes." The team runs a scheduled batch every 15 minutes instead of building a streaming pipeline. Why is this the right call?
Because streaming cannot achieve 15-minute freshness, since stream consumers only flush their buffers on an hourly cycle.
Because batch meets the stated latency requirement at much lower operational cost, and the requirement does not justify streaming.
Because batch is always superior to streaming for every workload, so a streaming pipeline is never the correct choice.
Because the pipeline’s five stages only work in batch mode and simply cannot be run on a per-record basis inside a streaming consumer.
2. What is the legitimate trigger for upgrading a batch pipeline to streaming?
A real latency requirement the business will pay for, such as users needing to see a change within seconds.
The discovery that streaming architectures are newer, since adopting the more modern approach is reason enough on its own.
The pipeline exceeding a few thousand rows per run, because batch processing cannot scale beyond small row counts.
Any increase in the number of data-quality checks, since more checks can only run efficiently in a streaming consumer.
3. Why is moving this pipeline from batch to streaming described as an upgrade path rather than a rewrite?
Because streaming reuses the exact same EventBridge schedule, simply lowering the interval until it effectively runs continuously.
Because the pipeline’s stages must all be completely rewritten for streaming, though the database schema itself can be reused unchanged.
Because it builds on the 6.1 Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis event backbone and the existing publish-event stage already emits the signal a consumer reacts to.
Because streaming and batch are identical at runtime, so no code changes of any kind are required to switch between them.
4. Which statement most accurately characterizes the cost difference between batch and streaming?
Streaming is cheaper because processing records one at a time uses far less memory than loading and holding a whole batch at once.
Batch is more expensive because a scheduled job must keep a server running continuously between its runs to stay ready.
They cost the same, since both run the identical five stages and the trigger has no bearing on the resources consumed.
Batch runs only on its schedule, while streaming requires always-on consumers and the operational overhead of running them.
5
Topic 5 of 5
Practice — build the production pipeline with data-quality gates
Why Do I Need to Know This?
This lesson’s payoff is the pipeline the rest of the feature depends on: a staged, observable ingest that validates every row at the boundary, quarantines bad data with a reason, alerts on a quarantine spike, and loads a corpus the AI-Assist can trust. The way to know you have it is to build it and then attack it — feed it a malformed row, a semantically-wrong row, and a bad batch — and confirm each is caught, counted, quarantined, and (past the threshold) paged. This exercise drives Codex through the pipeline and verifies by trying to slip bad data past it.

AI Practice
Prompt it
Hands-on practice for this lesson — build the production pipeline and its data-quality gates.

Build our corpus ingest pipeline: (1) five named stages — extract, validate, transform, load, publish event — each logging count_in/count_out/count_bad; (2) pydantic v2 models at the extract and load boundaries (model_validate, field_validator for money and codes); (3) five data-quality checks beyond types (range, uniqueness, referential, freshness, batch-size) with bad rows quarantined plus their reason; (4) an alarm with a runbook link when the quarantine rate exceeds 2%; (5) an EventBridge schedule and a one-paragraph ADR-0027 justifying batch over streaming. Then add tests: 6 transforms + 2 invariants, and a deliberate bad row that must be quarantined.
Copy
Watch out
Codex is likely to collapse the stages into one function, use pydantic v1 syntax, drop bad rows instead of quarantining them with a reason, duplicate the type checks as "data quality," set an alarm threshold that never fires, or default to a streaming design for a 15-minute requirement. Each leaves a pipeline that looks complete but loses the count conservation, the recoverable quarantine, or the right batch/streaming call. Read the stage boundaries, the v2 API, the quarantine reasons, and the ADR before trusting it.

Verify
Confirm the five stages each log count_in/count_out/count_bad and that the counts conserve at validate. Confirm boundary models use v2 model_validate/field_validator and reject a missing field, a wrong type, and a negative amount with field-level errors. Confirm the five data-quality checks quarantine a planted bad row with its reason (never dropped) and that the alarm fires above 2% and stays quiet below. Confirm the deliberate bad-row test passes and ADR-0027 justifies batch against the 15-minute requirement. Then close Codex and, without AI, walk one transform and explain how the per-stage counts would localize a row leak.

