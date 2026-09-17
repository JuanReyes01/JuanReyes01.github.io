---
title: CreditBay
build: 1
lane: caio
summary: 'A debt-recovery platform where AI voice agents make the calls.'
stack:
  - python
  - fastapi
  - postgres
  - next.js
  - sip.js
  - terraform
  - gcp
metric:
  value: '20 → 600'
  label: 'calls / min'
problem: 'Debt collectors call thousands of accounts a day, and every idle rep or missed callback costs money.'
decisions:
  - 'A FastAPI monorepo split into ERP and CRM services, hexagonal + DDD, strict TDD.'
  - 'AI voice agents make the outbound calls instead of a human dialer.'
  - 'Automatic Machine Detection hangs up on voicemail before it counts against call cost.'
  - 'A Next.js front end with an in-browser softphone.'
results:
  - value: '20 → 600'
    label: 'calls / min'
  - value: '~90%'
    label: 'lower call cost (via Automatic Machine Detection)'
---

An ERP service holds the portfolio; a CRM service runs campaigns, dispatches
calls, processes outcomes and manages payment agreements.
