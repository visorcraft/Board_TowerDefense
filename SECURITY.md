# Security Policy

Thanks for helping keep **Tower Defense** and its players safe.

## Supported versions

Tower Defense is an alpha project (`0.1.0`) shipped as a self-contained Board webapp. Security fixes are applied only to the latest `master`; there are no backported release branches.

| Version          | Supported          |
| ---------------- | ------------------ |
| `master` (latest)| :white_check_mark: |
| older commits    | :x:                |

## Reporting a vulnerability

**Please do not report security issues through public GitHub issues, discussions, or pull requests.**

Report privately through **GitHub's private vulnerability reporting**:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Fill in the advisory form with the details below.

This keeps the report confidential between you and the maintainers until a fix is ready.

> **Maintainer note:** private reporting must be enabled once, under **Settings → Code security and analysis → Private vulnerability reporting → Enable**. Until then the "Report a vulnerability" button will not appear.

Please include as much of the following as you can:

- a description of the issue and its impact,
- step-by-step instructions to reproduce,
- the affected commit / version and the environment (browser preview, or Board OS version and Piece Set),
- any proof-of-concept, logs, or screenshots,
- a suggested fix or mitigation, if you have one.

## What to expect

- **Acknowledgement** of your report within a few days.
- An initial assessment and, where confirmed, a remediation plan.
- Progress updates through the private advisory thread until the issue is resolved.
- Credit for your responsible disclosure in the fix or advisory, unless you prefer to remain anonymous.

We ask that you give us a reasonable opportunity to ship a fix before any public disclosure.

## Scope

Tower Defense runs fully offline as a Board webapp: pure-canvas rendering, procedural WebAudio, deterministic seeded game logic, and on-device saves through Board save services. It has no backend and makes no network calls of its own, so the most relevant concerns are local data handling, save integrity, and dependency vulnerabilities.

**Out of scope here** (please report upstream to the respective projects):

- the Board Web SDK and Board OS,
- the *Save the Bloogs* Piece Set model and other licensed `.tflite` assets,
- third-party npm dependencies (report to their maintainers; you may still tell us so we can bump the pin).
