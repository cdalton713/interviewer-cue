# Technical Interview Demo
@document sim-demo

## 00:00
Interviewer: Tell me about the queueing design.
Candidate: We introduced a durable queue to smooth write spikes.

## 00:30
Candidate: The worker pool drains jobs with idempotent retries and dead-letter handling.
Interviewer: How did you detect backpressure?

## 01:00
Candidate [id=answer-3 final=false]: We watched queue depth and lag...
Candidate [id=answer-3 final=true]: We watched queue depth, processing lag, and retry rates.

## 01:30
Interviewer: What did you use for the durable queue itself?
Candidate: We landed on SQS for the primary path because it gave us at-least-once delivery with a managed dead-letter queue.
Candidate: For the higher-throughput internal fan-out we used Kafka with a consumer group per worker fleet.

## 02:00
Interviewer: Why split between SQS and Kafka instead of standardizing on one?
Candidate [id=answer-rationale final=false]: The two systems solve different problems for us...
Candidate [id=answer-rationale final=true]: The two systems solve different problems for us — SQS is cheap and operationally boring for request-driven work, while Kafka's log semantics matter when we need replay or multiple independent consumers.

## 02:45
Interviewer: How do you handle poison messages?
Candidate: Each consumer wraps the handler in a retry budget with exponential backoff, capped at five attempts.
Candidate: After the budget is exhausted the message goes to a DLQ, and we page on DLQ depth crossing a threshold rather than on individual failures.

## 03:30
Interviewer: Walk me through what happens when the database is the bottleneck instead of the workers.
Candidate: The queue absorbs the spike, but worker concurrency is gated by a token bucket sized to the database's safe write rate.
Candidate: When latency climbs past our SLO we shed load on non-critical topics first — analytics writes get paused before billing events.

## 04:15
Interviewer: How do you guarantee idempotency end to end?
Candidate [id=idempotency final=false]: Every job carries a client-supplied idempotency key...
Candidate [id=idempotency final=true]: Every job carries a client-supplied idempotency key, and the worker performs an upsert keyed on it inside the same transaction as the side effect.

## 05:00
Interviewer: What breaks if two workers pick up the same message?
Candidate: The upsert collapses to a no-op for the second worker because the key already exists.
Candidate: The tricky case is external side effects — for those we use a transactional outbox so the side effect is recorded atomically with the state change and then dispatched by a separate relay.

## 05:45
Interviewer: Tell me about a time this design failed in production.
Candidate: We had an incident last quarter where a downstream provider started returning 200s but silently dropping payloads.
Candidate: Our retry logic didn't fire because the responses looked successful, so the DLQ stayed empty even though nothing was actually being delivered.

## 06:30
Interviewer: How did you detect it, and what did you change?
Candidate: A customer reported missing data about forty minutes in. We added end-to-end probes that write a synthetic event every minute and assert it appears downstream within the SLA.
Candidate: We also stopped trusting the provider's 200 — we now require an echoed correlation ID in the response body before marking a job complete.

## 07:15
Interviewer: Anything you'd redesign with what you know now?
Candidate: I'd push more of the orchestration into a workflow engine like Temporal instead of hand-rolling the retry and outbox plumbing.
Candidate: The custom code worked, but every new team that wanted to add an async job had to learn our specific conventions, and that didn't scale across the org.

## 08:00
Interviewer: Last question — how would you onboard a new engineer to this system?
Candidate: I'd start them on a runbook walkthrough for a real incident from the postmortem archive, then have them ship a small consumer end-to-end in their first week.
Candidate: Reading the code in isolation doesn't teach you the failure modes; you have to see the system under stress to build the right intuition.
