---
name: spec-driven-development
description: Workflow for any feature, fix or behaviour change in this repo — write or update the spec in specs/ first, then plan, tasks, implement with requirement-ID traceability, and verify. Use when the user asks for a new feature, a change in behaviour, or "write a spec".
---

# Spec-driven development

`specs/` is the source of truth. Code implements specs; tests prove requirements.

## Layout

```
specs/
  README.md                 index of all specs with status
  _templates/spec.md        copy for new specs
  _templates/plan.md
  _templates/tasks.md
  NNN-short-name/
    spec.md                 WHAT and WHY (requirements, acceptance criteria)
    plan.md                 HOW (design, files touched, risks) — optional for small changes
    tasks.md                ordered checklist, each task names requirement IDs — optional for small changes
```

## Statuses

`draft` → `approved` (user agreed) → `implemented` (code + tests pass) → `verified-on-car` (user confirmed with the real ECU).
Only the user can move a spec to `approved` or `verified-on-car`.

## Steps

1. **Find the spec.** Check `specs/README.md`. Extend an existing spec when the change belongs to it; otherwise create `NNN-name/` with the next free number from the template.
2. **Write requirements.** Each requirement:
   - has a stable ID with the spec prefix (e.g. `CP-405`); never renumber, mark removed ones `~~withdrawn~~`
   - uses MUST / SHOULD / MAY
   - has a testable acceptance criterion (Given / When / Then or a concrete example with bytes/values)
   - lists its source when it encodes car facts (FSM page, forum, captured log)
3. **Open questions.** Anything not confirmed on the real car goes in "Open questions" — do not guess silently.
4. **Ask for approval** when the change is user-visible or touches the ECU command set. Small internal refactors can skip approval.
5. **Plan/tasks** for anything bigger than one file: design, affected files, test strategy, risks.
6. **Implement.** Reference IDs in module/function comments and test names (`describe("CP-401: ...")`).
7. **Verify.** `npm test && npm run typecheck`. Update the spec's *Traceability* table (requirement → code → test) and set status `implemented`.
8. **Report** what was implemented, what is still unverified on the car, and any spec drift you noticed.

## Rules

- No behaviour without a requirement. If code does something the spec doesn't say, either add the requirement or remove the behaviour.
- Car-facing write commands (anything beyond read + C1 clear) need their own approved spec with a safety section.
- Keep specs short; prefer tables and byte examples over prose.
