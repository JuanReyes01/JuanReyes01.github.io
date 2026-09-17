---
title: credit-brain
build: 3
summary: 'A company-wide knowledge base you can ask how any part of the product works.'
stack:
  - python
  - rag
  - mcp
  - dolt
  - gcp
metric:
  value: '10'
  label: 'mcp tools'
problem: "Product knowledge was scattered across code, docs and people's heads, and coding agents had no reliable way to query it."
decisions:
  - 'Retrieval-augmented search over code, docs and engineering memory.'
  - 'Exposed as MCP tools so any agent can query it directly.'
  - 'Versioned in Dolt so every answer traces back to a specific data version.'
results:
  - value: '10'
    label: 'mcp tools'
---

Retrieval over code, docs and engineering memory, exposed to agents as MCP
tools, versioned in Dolt so answers are auditable.
