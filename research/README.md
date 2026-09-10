# ZORYQ Research Lab

This directory is for research artifacts that are separate from production claims.

Recommended structure as real work appears:

```text
research/
  papers/
  experiments/
  prototypes/
  notes/
  results/
```

Do not create empty directories/files merely for appearance.

## Experiment record

Each experiment should record:

- hypothesis;
- related work;
- method;
- environment and hardware;
- commit hash;
- configuration;
- raw result location;
- interpretation;
- limitations;
- failure modes;
- next experiment.

## Integrity rule

A failed hypothesis is not deleted. Document why it failed and what was learned.

Future-looking work must be labeled as one of:

- KNOWN SCIENCE
- CURRENT RESEARCH
- ENGINEERING HYPOTHESIS
- SPECULATIVE IDEA

See the root `RESEARCH.md` for the project-wide research policy.
