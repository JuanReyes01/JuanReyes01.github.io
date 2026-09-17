---
title: 'Opinion corpus + argument mining'
build: 5
summary: 'A scraping and normalization pipeline for opinion journalism, plus models that tag claims and premises.'
stack:
  - selenium
  - drissionpage
  - pandas
  - longformer
  - gemma
  - pydantic-ai
metric:
  value: '100k+'
  label: articles
problem: "Studying argumentation in opinion journalism needed a large, labeled corpus that didn't exist yet."
decisions:
  - 'A scraping and normalization pipeline built on Selenium and DrissionPage.'
  - 'Longformer and Gemma span classification to tag claims and premises.'
  - 'PydanticAI agents on top of the classifiers for structured extraction.'
results:
  - value: '100k+'
    label: articles
---

A scraping and normalization pipeline for opinion journalism, plus models
that tag claims and premises inside each article.
