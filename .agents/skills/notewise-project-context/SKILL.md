---
name: notewise-project-context
description: Maintain an accurate project handoff for the Notewise MIDI music-training app. Use when planning, implementing, reviewing, testing, debugging, documenting, or handing off any change in the Notewise repository, especially changes to trainer behavior, MIDI/audio input, settings, local storage, local launch, tests, or roadmap.
---

# Notewise Project Context

Read `project_description.md` in the repository root before taking action. Treat it as the living handoff, not as a substitute for the source code.

## Work with the context

1. Read the full document before planning or changing Notewise.
2. Inspect the affected source files before relying on a claim in the document. Prefer code and executed checks when they disagree.
3. Keep question generation and answer rules in `app/trainers/`, UI in `app/components/`, and browser/device logic in `app/hooks/` or `app/lib/`.
4. Preserve old browser data when changing `localStorage`; add a safe fallback or migration.
5. Update `project_description.md` in the same change set whenever behavior, structure, local storage, launch, validation status, or roadmap changes.
6. Keep future work in the roadmap until it is implemented and verified. State unrun checks explicitly, especially tests with real MIDI hardware.

## Handoff checklist

- Link new important files in the structure table.
- Mark a feature as complete only after implementation and proportionate validation.
- Move completed roadmap work into the current-state sections.
- Keep the local-first product decision clear unless the user changes it.
- Leave the document understandable to a new agent with no chat history.

## Update the handoff

Use short, factual edits. Update only sections affected by the work, then re-read the changed text and check paths, commands, settings names, and numbers against the code. Do not record secrets, tokens, or machine-specific credentials.

If the handoff has become misleading, correct it even when the current task is only a small fix; explain the discrepancy in the handoff or final report if it matters to continuation.

## Scope

Use this skill only for this repository. The source of product detail is the root `project_description.md`; do not duplicate it into the skill.
