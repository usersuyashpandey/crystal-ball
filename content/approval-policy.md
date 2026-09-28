# Site Operations — Maintenance & Approval Policy (v1)

This is the reference document the "Help me" action is grounded in. It is
split into short, headed sections on purpose: each section becomes one
retrieval chunk (see `lib/rag.ts`), so keep any edits to this file
section-sized rather than one long paragraph.

## Review SLAs

Every submission gets a target decision time, not a hard deadline: folders
(onboarding packs, checklists) should be reviewed within 72 hours,
videos and images within 48 hours, and PDFs within 24 hours. An item past
its SLA should be called out to the reviewer, not silently reprioritized —
the queue is a decision aid, not a decision-maker.

## Safety-critical submissions

Any item flagged `safety-critical` (equipment specs, sensor calibration
docs, incident reports) skips the normal single-reviewer path. It needs
sign-off from a Safety Lead in addition to the operator, and it cannot be
auto-approved or bulk-approved under any circumstance. If a safety-critical
item is also past its SLA, that is the single highest-priority thing in the
queue, full stop.

## Customer-facing content

Anything flagged `customer-facing` (demo videos, client-shared drawings)
needs a visual quality pass before approval, not just a compliance check —
watch for framing, audio clarity, and any accidentally-captured internal
UI. These items should never be approved from a thumbnail alone.

## Rejections and re-submission

A rejection must include a one-line reason visible to the submitter. There
is no formal appeals process — the submitter fixes the noted issue and
re-submits as a new item; the old item is marked superseded, not deleted,
so the audit trail stays intact.

## Approval authority

Operators can approve folders, videos, and images within their own site.
PDFs and anything safety-critical require the Safety Lead regardless of
which site it came from. Nobody approves their own submission, even if
they hold the authority level to approve that content type.
