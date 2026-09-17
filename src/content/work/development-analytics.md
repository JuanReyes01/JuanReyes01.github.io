---
title: development-analytics
build: 4
lane: caio
summary: 'A terminal app that measures how the team actually ships.'
stack:
  - python
  - textual
  - sqlite
  - uv
metric:
  value: '3'
  label: 'delivery metrics'
problem: "Engineering decisions about process were being made on opinion instead of the team's own delivery data."
decisions:
  - 'A terminal app (Textual) reading from a local SQLite store.'
  - 'Tracks deploy cadence, lead time and cycle time.'
  - 'Every process decision gets recorded as an ADR.'
results:
  - value: '3'
    label: 'delivery metrics'
---

Deploy cadence, lead time, cycle time — decisions recorded as ADRs.
