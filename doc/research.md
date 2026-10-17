# Research notes: why the forager brains do not steer, and what works elsewhere

Findings from one working session (2026-10-16/17) on the wide-I/O brain. This is a record of what was measured
and what was recalled, not a literature review. Literature items are from memory and are **not verified** against
the papers; check them before citing.

## 1. Measured in this repository

### 1.1 Connectivity of the 11K cuts (`scripts/connectivity-audit.py`)

Linear 8-step probe, D12 weights, whole allTraced graph at `minSynapses` 5 (165,122 neurons, 6.2M edges).

- **No sense is disconnected.** Every input pool reaches every output pool in the same number of hops as in the
  whole graph (mostly 3). Under 1.2 % of any pool's forward mass is trapped.
- **LH and MB are not the steering route** in this probe. Removing the whole LH, or the whole MB, from the whole
  graph changes the food L/R turn contrast by under 10 %.
- **The cut dropped the premotor layer.** Food steering ran through SIP022, LAL030_a/b, CB0356 and LAL035, all
  presynaptic partners of the output pools, all missing. The 11K cut kept 14 % of the whole graph's food
  contrast; forward (DNp09) kept 26 % of its input.
- **Fix shipped:** [ADR 009](../adrs/009-output-partner-seeds.md), output-partner seeds at 14,500 neurons. Food
  contrast 92 %, every output pool holds 97–100 % of its real input.

### 1.2 The readout is where the signal is not

Bilateral DN types ranked by the L/R contrast each sense puts on them, whole graph:

| Sense        | DNa01 rank (of 472) | DNa02 rank | Where the contrast lands |
| ------------ | ------------------- | ---------- | ------------------------ |
| Food odour   | 230                 | 18         | DNp29, DNc01, DNp32      |
| Danger odour | 401                 | 167        | DNp29, DNp32, DNb05      |
| Heat         | 173                 | 74         | DNc02, DNpe043, DNb05    |

No cut can fix this: it is a property of the connectome under this probe. The turn readout is one DNa01 and one
DNa02 per side.

### 1.3 Calibration of the 14.5K brain (ADR 008 D21/D22 grid)

- 960 points, 6 seeds × 400 ticks: 23 pass A1, 1 robust (synapticScale 5, inhibitoryScale 0.5, noise
  (0.3, 0.5), adapt (20, 0.05), thresholdJitter 0.1). Steering is correct and consistent: food +0.18, heat −0.21,
  touch +1.55, rest bias 0.01.
- **A2 cannot reach the forward target.** At outputScale 8192 forward drive is 0.046 (target 0.3–0.5); at
  131072 it is 0.049. The output neurons already fire on nearly every input spike: forward is limited by how
  rarely DNp09's inputs fire, not by readout gain.
- **World stage (5 calibration seeds, 3,000 ticks): find 0 %, 0 contacts.** Random walk: 30 %.

### 1.4 The trade-off

One global synaptic scale has to serve every pathway. At a quiet setting the bulk carries correct, sense-specific
steering but too little drive reaches the motor pools. At a louder setting the bulk ignites, or the turn bias grows,
and the sense-specific signal is lost. Two weeks of grid search have found no point that does both. The evidence
says the search is looking for a regime that a single set of uniform LIF parameters on this graph does not have.

## 2. What other work does (from memory, unverified)

| Work                                                                    | What it shows                                                                                     | How it gets there                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Shiu et al. 2024, *Nature*: whole-brain LIF on FlyWire                  | Sugar GRNs activate MN9 (feeding) and other pathway predictions, several confirmed experimentally | Whole brain, not a cut. Open loop: activate a sensory set, read named downstream neurons. No navigation       |
| Lappalainen et al. 2024, *Nature*: connectome-constrained visual system | Predicts neural responses across the fly visual system that it was not trained on                 | Connectome fixes wiring and signs; unknown per-cell-type parameters are trained by gradient descent on a task |
| NeuroMechFly v2 (Wang-Chen et al. 2024)                                 | Odour taxis and other behaviours in a physics body                                                | Simple or designed controllers, not a connectome brain                                                        |

None of these gets closed-loop navigation from a connectome with uniform, hand-swept LIF parameters. Results
come either from open-loop readout of named neurons, or from fitting per-type parameters with the connectome as
a constraint.

### 2.1 Connectome-constrained fitting (option for this project)

Keep the snapshot's edges, synapse counts and signs fixed. Fit a small number of parameters **per cell type**
(gain, threshold offset, optionally a time constant), shared between the left and right copies of a type. The
wide brain has 3,583 types (592 single neurons), so ~11,000 parameters against 731,000 edges. The 232,000 type
pairs are too many to fit.

- Loss: the A1 gates already in `profiles/wide-io.mjs` (quiet rest, food toward, heat away, touch toward, taste
  raises feed), with L2 regularisation of every parameter towards its default.
- Method: surrogate-gradient training offline (PyTorch or JAX). Gradient-free search in the Node engine is too slow
  (one A1 probe ≈ 50 s).
- Controls: train the same way on the matched random graph. If it learns the task as well, the connectome adds
  nothing. Test on held-out seeds and stimulus strengths.
- Feasibility spike: port `lif-v1`, check spike agreement with JS, fit gains on the brain-only loss, compare
  with the random graph. Go/no-go on that result.

It needs a constitution amendment (Principle III: weights are synapse-derived × a fitted per-type gain).

## 3. Prior-art analysis: why it moves toward food

MaleCNS slice simulations uses same LIF but it as harness and simulations are naive fly 43 % of the time on food, random walk 3 %. It is not calibration-free. It is calibrated in different places, mostly outside the brain:

| Mechanism        | prior-art                                                                                                                                                | microfly                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Steering readout | Hundreds of DNs per side, **selected because they are side-selective in simulation** (\|L−R\|/(L+R) > 0.35): sweet 112/149, ferment 76/84, danger 75/106 | One DNa01 + one DNa02 per side, chosen by name     |
| Readout bias     | Per-pool L/R balance ratio measured at symmetric input and divided out                                                                                   | None; a shared turn scale (BUG-001)                |
| Turn sign        | `turnSign: -1`, "fixed empirically: flies must turn toward attractive odor"                                                                              | Must come from the brain                           |
| Input contrast   | World amplifies the L/R concentration contrast ×6 before driving ORNs, so one side is often silent                                                       | Each side driven by its own concentration          |
| Locomotion       | Base speed 0.9 tiles/s when motor pools are quiet; random heading noise; brain only modulates speed                                                      | Forward speed comes only from the `forward` output |
| Search strategy  | Surge/cast (run-and-tumble on the temporal derivative of drive) and upwind turning computed in world code                                                | None outside the brain                             |
| Brain regime     | Tonic `baseline` current on every neuron (self-sustained up-state); hand-set pathway gains ORN→PN ×5, PN→KC ×3 with recurrent input ×0.3                 | One global synaptic scale; noise only              |
| Feeding          | Eats when the proboscis pool fires **or** hunger > 0.9                                                                                                   | Eats only from the `feed` output                   |
| Null arm         | Random walk only; no random-graph control                                                                                                                | Random walk and matched random graph               |

In previous research, the brain decides which way to turn, read from neurons picked for carrying that signal, and the body
does the rest. That is an engineering choice its README states openly. microfly's constitution forbids most of
these mechanisms (§4).

## 4. Rules in microfly that block further development

- Principle VI and AGENTS hard rule 6: behaviour comes from the brain; the world never steers, stops or feeds a fly.
  Blocks: base speed, heading noise, surge/cast, the turn-sign flip, the hunger override.
- ADR 006 lesson 2: no selection by an objective. Blocks: readout pools chosen by simulated side selectivity.
- Principle III: weights from synapse counts only. Blocks: pathway gains (ORN→PN ×5), and per-type fitting (§2.1).
