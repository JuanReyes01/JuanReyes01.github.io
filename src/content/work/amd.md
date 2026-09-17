---
title: 'Automatic Machine Detection'
build: 2
lane: caio
summary: 'Detects when a call lands on voicemail and ends it before it costs anything.'
stack:
  - telephony
  - voice agents
metric:
  value: '~90%'
  label: 'lower call cost'
problem: 'A voice-agent call that reaches voicemail still burns the same minute of usage as a real conversation.'
decisions:
  - 'Detect voicemail during the call and hang up automatically.'
  - "Feed the detection back into the dispatcher so live-agent capacity isn't wasted on dead calls."
results:
  - value: '~90%'
    label: 'lower call cost'
---

A feature of CreditBay's call dispatcher, not a separate product or company.
