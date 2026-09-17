---
diagram:
  name: 'feeder-rfid'
  caption: 'how a visit becomes a result'
  label: 'Pipeline: a feeder visit by a PIT-tagged hummingbird or bat is read by an RFID logger (ESP32 or Feather M0), processed by a tested Polars core with parity against 5.4 million legacy rows, shown in a bilingual Streamlit app with offline launchers, and used by field biologists.'
  art: |
    ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
    │ [[FEEDER]]       │       │ [[RFID LOGGER]]  │       │ {{POLARS CORE}}  │
    │ hummingbird  │ ────► │ ESP32 /      │ ────► │ hexagonal,   │
    │ or bat with  │       │ Feather M0   │       │ tested,      │
    │ a PIT tag    │       │ raw reads    │       │ parity 5.4M  │
    └──────────────┘       └──────────────┘       └──────┬───────┘
                                                         │
                                                         ▼
                           ┌──────────────┐       ┌──────────────┐
                           │ [[BIOLOGISTS]]   │       │ [[STREAMLIT]]    │
                           │ results, no  │ ◄──── │ ES / EN,     │
                           │ terminal     │       │ offline      │
                           │ needed       │       │ launchers    │
                           └──────────────┘       └──────────────┘
stations:
  - title: 'Solar autonomy'
    desc: 'A design proposal to keep the RFID stations running off-grid.'
    kind: proposal
  - title: 'ESP32 trap controller'
    desc: 'Firmware for a servo-driven capture mechanism, debugged down to wiring and grounding.'
    stack: ['c', 'esp-idf', 'platformio']
    kind: firmware
  - title: 'Printed parts'
    desc: 'Modeled in FreeCAD, printed at home.'
    stack: ['freecad', 'orcaslicer']
    kind: hardware
---

Software and electronics for **Centro de Investigación Colibrí Gorriazul**, a
hummingbird research center in Fusagasugá, Cundinamarca. Feeders at the
station carry RFID readers that log every visit from PIT-tagged
hummingbirds and nectar bats (_Anoura geoffroyi_).

The analysis used to live in a pandas notebook only its author could run.
I'm rebuilding it as a hexagonal app: a tested Polars core that holds the
science, a Streamlit shell in Spanish and English on top, and offline
launchers so biologists never open a terminal.
