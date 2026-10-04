<!--
Sync Impact Report
==================
Version change: (template, unversioned) → 1.0.0
Bump rationale: initial ratification; all placeholders replaced with project-specific content.

Principles defined:
  - [PRINCIPLE_1_NAME] → I. Static Web, Zero Build
  - [PRINCIPLE_2_NAME] → II. One Fly, One Worker
  - [PRINCIPLE_3_NAME] → III. Connectome-Grounded Brain Snapshots
  - [PRINCIPLE_4_NAME] → IV. Configurable, Reproducible Extraction
  - [PRINCIPLE_5_NAME] → V. Faithful, Inspectable LIF Simulation
  - (added)            → VI. Living World, Embodied Flies
  - (added)            → VII. Simplicity

Added sections:
  - Technology & Architecture Constraints (was [SECTION_2_NAME])
  - Development Workflow & Quality Gates (was [SECTION_3_NAME])

Removed sections: none

Dependent artifacts: templates and commands read this file at runtime; none modified.

Deferred TODOs: none
-->

# Microfly Constitution

## Core Principles

### I. Static Web, Zero Build

The application MUST run in a browser as a static website made only of HTML, CSS and
JavaScript.

- Running `python3 -m http.server 8000` from the repository root (or the documented web root)
  MUST start the whole application. No other server, build step, bundler, transpiler or
  package install is allowed for running the app.
- JavaScript MUST be plain, standards-based code using native ES modules. UI frameworks
  (React, Vue, Svelte, Angular and similar) MUST NOT be used.
- Third-party browser libraries are allowed only as vendored files in the repository, loaded
  without a build step, and each one MUST be justified in the plan that introduces it.
- The app MUST NOT depend on a backend at runtime. All data it needs (brain snapshots, world
  definitions) MUST be static files served next to the code.

Rationale: anyone can clone the repository and run the simulation with one command, and the
site can be hosted on any static host.

### II. One Fly, One Worker

Each simulated fly MUST run in its own Web Worker. The worker owns that fly's brain: its
neural network loaded from a brain snapshot and its Leaky Integrate-and-Fire (LIF) state.

- The main thread MUST NOT run neural computation. It handles the world, rendering and user
  input only.
- Workers and the main thread MUST communicate only through a documented, versioned message
  protocol (for example: sensory input in, motor output and telemetry out). Messages SHOULD
  use transferable objects or typed arrays for bulk data.
- A worker MUST NOT reach into another fly's state. Flies interact only through the world.
- Adding or removing a fly MUST mean creating or terminating one worker, with no effect on
  other flies.

Rationale: one worker per fly keeps the UI responsive, uses multiple cores, and gives each
fly a clear, isolated boundary.

### III. Connectome-Grounded Brain Snapshots

Every brain the app simulates MUST be a snapshot derived from the MaleCNS flat-connectome
dataset (described in `malecns.md`) by the Python utilities in this repository.

- The dataset is external. It MUST NOT be committed to the repository, and its location MUST
  be configurable (argument or environment variable), never hard-coded.
- Each snapshot MUST record its provenance: dataset release, file variant used (full,
  traced-only or significant-only), extraction configuration, configuration hash, tool
  version and creation time.
- Connection weights MUST come from the dataset (synapse counts) and neuron identity MUST keep
  dataset identifiers (`bodyId`, `type`, `class`, `superclass`). Neurotransmitter sign, when
  used, MUST come from the dataset predictions, with the rule for low-confidence predictions
  stated in the configuration.
- Hand-made or synthetic networks are allowed only as test fixtures and MUST be labelled as
  such.

Rationale: the point of the project is to simulate a real fly connectome; the result is only
meaningful if every snapshot can be traced back to the data.

### IV. Configurable, Reproducible Extraction

Brain snapshot extraction MUST be driven by declarative configuration files, not by code
edits.

- A configuration MUST be able to choose which neuron classes, types, superclasses or regions
  are included, how many neurons of each are kept, which sensory and motor neurons form the
  input and output interfaces, and how the topology is pruned (for example weight thresholds
  or edge-variant choice).
- The same configuration and the same dataset MUST produce a byte-identical snapshot. Any
  sampling MUST use a seed stored in the configuration.
- The snapshot file format is a contract between the Python pipeline and the browser. It MUST
  be documented and versioned, and the browser MUST reject snapshots with an unsupported
  format version, showing a clear error.
- Extraction MUST handle the dataset's size (files up to tens of GB) with column selection,
  filtering or batched reads. It MUST NOT require loading whole large files into memory.
- Snapshots MUST be compact enough to load in a browser worker; each configuration SHOULD
  state its expected neuron and edge counts and the pipeline MUST report the actual ones.

Rationale: comparing different topologies and neuron selections is a core goal; that only
works if each one is a reproducible, named configuration.

### V. Faithful, Inspectable LIF Simulation

The neural model is Leaky Integrate-and-Fire. Its implementation MUST be explicit, testable
and observable.

- All model parameters (membrane time constant, resting, threshold and reset potentials,
  refractory period, synaptic weight scale, time step) MUST be named, documented and
  configurable. No unexplained constants in the integration code.
- The LIF core MUST be a pure JavaScript module with no DOM or worker dependencies, so it can
  be tested on its own.
- Given the same snapshot, parameters, inputs and random seed, a simulation MUST produce the
  same spike sequence.
- The simulation MUST expose telemetry for inspection: at least spike events and firing
  rates for selected neurons, and the sensory and motor signals crossing the brain–world
  boundary.

Rationale: a simulation that cannot be inspected or reproduced cannot be trusted or debugged.

### VI. Living World, Embodied Flies

Flies MUST live and interact in an interactive environment rendered by the same web app, in
the spirit of AI Town or "Generative Agents: Interactive Simulacra of Human Behavior".

- The world owns physics, objects, other flies and the user's interactions. Flies perceive
  the world only through sensory inputs and act on it only through motor outputs.
- The mapping from world stimuli to sensory neurons, and from motor neurons to fly actions,
  MUST be declared in data (configuration or snapshot), not hidden in world code.
- Fly behaviour MUST come from the simulated brain. Scripted behaviour MUST NOT override
  brain output, except in clearly labelled debug or baseline modes.
- The world MUST stay responsive while flies are simulated; world updates and rendering run
  on the main thread at an interactive frame rate.

Rationale: behaviour emerging from the connectome, observable in a shared world, is the
product.

### VII. Simplicity

Start with the smallest design that works and add complexity only when a real need appears.

- Prefer the browser platform (Canvas, Web Workers, typed arrays, ES modules) over libraries.
- Prefer standard Python data tooling (`pyarrow`, `pandas`, `numpy`) over custom frameworks.
- Any extra layer, dependency or abstraction MUST be justified in the plan's complexity
  tracking.

Rationale: the project spans two languages and a large dataset; simplicity keeps it
understandable.

## Technology & Architecture Constraints

- **Repository layout:** the web app (static files), the Python extraction utilities, the
  extraction configurations and the documentation live in the same repository, in clearly
  separated top-level directories.
- **Browser:** current versions of evergreen browsers (Chrome, Firefox, Safari). Required
  APIs: ES modules, Web Workers (including module workers), Canvas 2D, typed arrays.
  WebGL/WebGPU MAY be used for rendering or computation if justified.
- **Python:** Python 3 utilities with dependencies pinned in a requirements file. The
  pipeline runs as a command-line tool: configuration in, snapshot file(s) out.
- **Data flow:** MaleCNS dataset (external) → Python extraction (configuration) → snapshot
  file (static asset) → fly worker (LIF) ↔ world (main thread).
- **Dataset caveats:** extraction MUST follow the caveats in `malecns.md` (for example,
  choosing the edge variant explicitly and not mixing variants).
- **Generated artifacts:** large generated snapshots MUST NOT be committed unless they are
  small reference snapshots used by the default app or by tests.

## Development Workflow & Quality Gates

- **Spec-driven:** features follow the Spec Kit flow (specify → plan → tasks → implement).
  Every plan MUST include a Constitution Check against the principles above.
- **Tests:**
  - The LIF core MUST have unit tests that run without a build step (for example with Node's
    built-in test runner, or a test page served by `python3 -m http.server`).
  - The Python pipeline MUST have tests that run on a small fixture dataset, checking
    configuration parsing, selection, determinism and the snapshot format.
  - Any change to the snapshot format or the worker message protocol MUST include contract
    tests on both sides.
- **Run check:** before a feature is done, the app MUST start with
  `python3 -m http.server 8000` and run with at least one fly, with no console errors.
- **Documentation:** the snapshot format, the configuration schema and the worker message
  protocol MUST be documented and updated in the same change that alters them.

## Governance

This constitution takes precedence over other project practices. When a plan or a change
conflicts with it, the constitution wins unless it is amended first.

- **Amendments:** proposed through `/speckit-constitution`, with a Sync Impact Report
  describing what changed and why. Amendments are recorded in version control.
- **Versioning:** semantic versioning.
  - MAJOR: removal or incompatible redefinition of a principle or governance rule.
  - MINOR: a new principle or section, or materially expanded guidance.
  - PATCH: clarifications and wording fixes with no change in meaning.
- **Compliance:** every plan's Constitution Check and every review MUST verify compliance.
  Deviations MUST be justified in the plan's complexity tracking, or the constitution amended.

**Version**: 1.0.0 | **Ratified**: 2026-10-04 | **Last Amended**: 2026-10-04
