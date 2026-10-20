# Changelog

# 2026-10-20

Root-cause analysis of the failed MB regime gate, and a retry (ADR 011 D40, D41). The gate now **passes** and
Phase 4 is unblocked.
* **Root cause.** The probe built the brain without `inputNeurons`, so it measured a noise-free network the fly never
  runs. With `postFractionAbsolute` × `synapticScale` 15, one PN spike fires 92.5% of KCs, ORN input spreads to ~90%
  of PNs, KC→KC edges spread the code further, and `baselineCurrent` 0.03 drives KCs at rest. The D38 remedy's gains
  came from smallfly's raw-count weights, so on normalised weights they amplified instead of correcting.
* **Fixes.**
  - `mb-regime-probe.mjs` builds the graph as `fly-brain-v1.js` does and takes `--lif` overrides.
  - L11 `pathwayGain` routes may select by `fromType`/`toType`, which reaches APL; the first declared match wins.
  - The world validator accepts a `pathwayGain` object.
  - The learning world runs at `synapticScale` 5, `tauSyn` 3, `baselineCurrent` 0, with KC→KC 0, ALPN→KC 2.1 and
    other excitation into ALPN/KC at 0.3.
* **Finding.** A working (spiking) APL lowered reliability at every gain tried.
* **Target relaxed by user decision (D41).** FR-006's same-odour reliability target went from 0.9 to 0.85, after the
  retry missed 0.9 by 0.005.
* **Result** (calibration seeds 6-10): 13.8%/12.0% active, reliability 0.896/0.894, A-B overlap 0.144. **PASS.**
* **Next.** Calibrate the learning world's sensorimotor regime at the new settings (T016), then the teaching-signal
  probe (T026).

# 2026-10-19

/speckit-specify Learning (mushroom-body valence learning). ADR 010-demo-forager.md defines the learning criterias at **D34**: KC→MBON rule, PAM (reward) while eating, PPL1 (punishment) on escape or heat contact, and learned valence scaling `v_p` within [0.5, 1.5]. The whole MB is already in the 14.5K brain (ADR 006: 4,064 KCs, 316 PAM, 97 MBONs). 
* Relax Principle V of constitution to enable plasticity in the LIF core.
* Give the world more than one odour, these two glomerulus do not overlap.
* Gate on the regime before writing any learning code as a calibration gate.
* Plasticity in the LIF core 
* Experiments and acceptance
* Existing Klinotaxis-only steering limits how much a learned gain can change paths. Learning will show up more in stay/leave and eat/not-eat decisions than in turning. Enforce stay/leave and eat/not-eat decisions. 

/speckit-plan Implement precondition for learning, learning process and evidence of it effectivness.
* Add a second food odour whose glomeruli do not overlap the first: a "fruit/ferment" set DM1, DM2, DM4 vs a "floral/sweet" set VA2, DP1m, VM5d.
* Give each its own flower kind and its own input pair (`odour-food-a`, `odour-food-b`). 
* The calibration gate. On the 14.5K brain, measure:
  - the fraction of KCs active per odour (target 5–15%)
  - the correlation of KC codes for the same odour across trials (target > 0.9)
  - the correlation of KC codes between odour A and odour B (target < 0.7)
  - If the brain sits in an up-state (at 0.99), add a **declared feedforward pathway gain**: a named LIF parameter scaling excitatory edges onto `ALPN` and `Kenyon_Cell` from their canonical sources (ORN→PN, PN→KC) up and other excitatory inputs down. It is configured like `outputScale`, so weights still come from the dataset. Record the result in an ADR. Without a sparse, distinct KC code, learning will generalise to everything.
* Classify the neurons in config, not code.
  - KC `class = Kenyon_Cell`
  - DAN reward `class = DAN`, PAM types
  - DAN punishment `class = DAN`, PPL1 types 
  - MBON approach / avoid | Declared per MBON **type** with a literature citation (e.g. Aso et al. 2014: glutamatergic MBONs mostly promote avoidance, cholinergic/GABAergic ones approach). Do not infer this from transmitter alone
* Plasticity in the LIF core** (Principle V, off by default).
  - Per-edge multiplier `wmod ∈ [wMin, 1]` on KC→MBON edges only. Weights in the snapshot never change.
  - KC eligibility trace (τ ≈ 400 steps).
  - Dopamine drive = DAN pool rate **above a running baseline, minus a threshold**. smallfly found that tonic DAN activity, and the PPL1 activity that odour and taste evoke on their own, otherwise teach the fly to avoid
  everything.
  - Reward depresses KC→avoid-MBON edges; punishment depresses KC→approach-MBON edges; slow recovery toward 1.
  - Use only the seeded PRNG and integer step counters, so runs stay deterministic. Add a golden test showing that plasticity off gives bit-identical results to `lif-v1`.
  - Telemetry: mean `wmod` per MBON group, dopamine drive, per-odour learned valence.
* Teaching signals, measured first and injected only if needed.
  - First run a brain-only probe: does mouth taste plus hunger drive PAM through the connectome, and do heat or touch drive PPL1? If they do, use them as they are.
  - Only where the cut does not carry the signal, add a declared input channel `reinforcement-reward` / `reinforcement-punish` that targets the DAN pools. Label it in the panel as injected, the same way hunger is.
* Readout: prefer the network path over a decoder multiplier.
  - MBON output reaches DNs and drive pools through the connectome, so learning changes behaviour through the brain. Measure the effect with a probe. Accept 
  - **This is the one constitution amendment (Acceptable):** Principle VI says valence is "declared, not learned". A learned multiplier needs that bullet amended. The declared sign stays; learning only modulates gain.
* Experiments and acceptance (Node harness, calibration and held-out seeds).
- **Conditioning probe** (port `learn_test.mjs`): pair odour A with PAM or PPL1, then read MBON valence for A and B.
  Accept if the shift for A is larger than for B, in both directions.
- **Behaviour test:** a world with both flower kinds where kind B is "bitter" (eating it triggers punishment).
  Compare choice ratios before and after one simulated day.
- **Arms:** plastic, frozen, DAN-shuffled (randomised teaching signal) and random-graph null. Report all four.
- **Check that it decays:** the effect should fade over the configured forgetting time.

/speckit-implement Built the precondition (constitution v2.2.0, ADR 011, the two-odour `forager-brain-mb` brain,
its learning sidecar, scent support, both demo worlds) and the regime gate itself, through `scripts/mb-regime-
probe.mjs`. **The gate failed and stops the feature here (FR-008):** the KC population is in an up-state
(98.9%/99.7% active against a 5-15% target) and the one allowed remedy (`pathwayGain`, a 7-point grid from the
user-specified starting routes) only gets it to 55.6%/63.7% — a real effect, but nowhere near the target.
Plasticity, the readout, the behaviour experiments and the panel (everything from the teaching-signal probe
onward) were not built, per the project's own rule that a failed gate stops the feature rather than shipping a
partial version. ADR 011 is "Rejected — gate failed"; `specs/019-mb-valence-learning/regime-gate.md` has the
full numbers and what the next attempt would need to try that this one grid's budget did not cover.


# 2026-10-17

/speckit-specify ADR 010-demo-forager.md defines a new process to extract and calibrate forager-brain-wide.brain . Expected outcome is demoable application fulfilling the requirements:

| R1  | MUST   | A fly whose hunger is above a threshold moves towards food and reaches it | Find rate and approach, hungry vs sated           |
| R2  | MUST   | A fly reacts to danger and escapes it                                     | Escape trigger and exit time per danger encounter |
| R3  | SHOULD | A fly avoids heat                                                         | Time in heat rings against the random walk        |
| R4  | SHOULD | Calibration takes 30 minutes or less, in one command                      | Wall clock of `calibrate.mjs --stage=all`         |
| R5  | SHOULD | The world map can change without recalibration                            | R1–R3 hold on two maps with one calibration       |
| R6  | MAY    | Real-time learning from world feedback is used where it removes a problem | Part G                                            |

/speckit-plan Follow ADR 010-demo-forager.md to implement changes process to extract and calibrate forager-brain-wide.brain . See the ADR 010-demo-forager.md for details but it requires: 
   1. L10;
   2. decoder-v1 reader and the C2 writer;
   3. decoder and body layer (W12–W14);
   4. hunger threshold (D32);
   5. homeostasis (D33);
   6. world-config v3 and the demo world;
   7. `profiles/demo-v3.mjs`;
   8. panel (D31);
   9. Part K run.

Bugfix (specs/017-demo-forager/bugs/BUG-001.md): ADR 010 does not implement all requirements and calibration fails again. There are a few issues (1) fly does not recognize food odor; (2) fly does not consume food and recover enegry; (3) fly has sudden jumpt to random direction; (4) no visible action on danger. The simulation does not account a direction vector of fly, it always pointer from bottom to top, which might be one of the sever root cause. Fixes are required. Decision: widen ADR 010 D27's readout candidates to every non-input neuron (Amendment A1) and re-run C2.

Bugfix (specs/017-demo-forager/bugs/BUG-002.md): Eating is almost resolve, there is only one hunger fly that eats when it fly over a flower again over again but it seems it eats during one tick only. Other fly does not eat even it it stall and touch the flower.  Let's make sure that fly eats when it stays in the area of 100% odor. Should the speed of fly become slower (below eating threshold after some energy level).

Bugfix (specs/017-demo-forager/bugs/BUG-003.md): One more observation, there are no big difference on odor level regardless of the head vector due to the fly size. It makes wrong effect that target ahead. The artifical filtering is required to reduce the odor signals. Fly also prefer to seat at the water (heat edge). Fly should be able fly over water but heat has to make same effect as danger. Decision: keep D27's minimum of 5 side neurons (food side pools not adopted).

Bugfix (specs/017-demo-forager/bugs/BUG-004.md): Fly make a "jump" immediate turns and jump to new position. Highly likely, it is not possible to fix within the brain but in the world streering should be smooth as real motors does. Decision: implement the motor stage (ADR 010 Amendment A4).

Bugfix (specs/017-demo-forager/bugs/BUG-005.md): What make fly to turn 180 degree, is this escape signal? Implement both 1 (fewer false escapes: raise escape threshold) and 2 (a smaller, randomly signed escape turn when the side is unknown).

--

/speckit-specify Hunger below a thresholds increases sensivity of food odor then eating state either suspend a fly until energy is recovered or slow it down. Eating shall decrease the availability of the resource on the map as a consequence level of odor from that drops. Small food resource is consumed by one food consumption, medium by two and large by three. The food resources are recovered in 30 seconds (to be configurable)  

/speckit-plan Implement the feature as parameters of the world simulation, sensor filters and motor control. Do not change the brain of LIF parameters. 

# 2026-10-14

/speckit-specify Create a new world map using my sketch world_map.jpg and existing assets library atlas (`public/assets/atlas`). Keep the shape of terrain and water exactly as my sketch draws. The atlas does not have any building use the tent and bones from atlas. The atlas does not have any bridge, just put the terrain there. Avoid setting any title, ledgend and animals. 

One of the main change is the calibartion of meaning in the world:
1. The edge of the world is a deep forest is must cast the danger odour. The forest itself is max danger odour, neighbor tile is 50% danger odour, and second neighbor tile is 25% of danger odour. Only the edge forest casts danger odour. 
2. Water is heat odour, neighbor tile is 50% heat odour, and second neighbor tile is 25% of heat odour. In the sketch the water divides area into two parts, there should be a thin path between terrains with no heat odour so that both sides are connected and reachable by fly. 
3. Food odour is 100% at the food flower tile, 100% in the next neighbor tile so that 9 title square is an area where fly can eat. The food odour reduces by 10% but do not draw a perfect circles of food odour it has to be an random shape areas. The food MUST be distributed on the map so that one food odour area gently touches another area. The fly has to be able to travel across the map simply following the food odour.   
4. Any decorations, object or trees on the map causes touch left and right when fly is "touching" them.

Make an optimization of the map and tile sizes so that map is "large" enough to fit the world I've sketched but also proportional to the size of fly. 

Enhance the visualization of food, danger, heat odour and tile grid so that user can switch it on/off for the visualization.

One the new world is complete, apply it to all implemented worlds in this simulator.

/speckit-plan Create a new world map using world_map.jpg and existing assets library atlas (`public/assets/atlas`). Change the dynamic in the food odour and implement a new danger and heat odour following the specification. Optimize the world size so that it fits the map but proportional to fly size. Allow user to switch on/off visualization of food, danger, heat odour and tile grid. Apply the the map to all worlds.

# 2026-10-13

/speckit-specify Build new brain version 2 that uses the 11K brain (ADR 006) fixed the topology but request interface is 12 inputs (food odour, danger odour, heat, mouth taste, leg taste and touch, each L/R) and 6
outputs (turn L/R, forward, backward, feed, escape). Three of the six senses are not in the 11K brain. Danger ORNs, heat receptors and front-leg touch neurons are sensory classes. ADR 006 excludes them from fill, and they are not pools, so the shipped snapshot has none of them (Annex A1, A3). This feature needs a re-extraction. The topology rule does not change, and 10,410 of 11,000 neurons stay the same. The ADR 007-wide-io-forager-brain.md defines the required brain version 2architecture. Preserve the application compatibility with existing brains and configurations. Integrate the visualization of new input / output and state channels into the side panel on UI.


/speckit-plan Implement the new brain version 2 as defined by the ADR 007-wide-io-forager-brain.md . Preserve compatibility of the simulator with previous versions allowing user to choose between previous versions. Integrate new sensors with UI.


# 2026-10-12

/speckit-specify Extract the brain as defined by ADR 006-class-seeded-forager-brain.md This ADR defines a brain made of whole functional classes (all ORN, PN, LN, LHN, all KC, MBON, DAN, all DNs, motor neurons, GRN, JO). It is compatible with LIF v1 protocol and does not increase input / output sensorts. Keep existing LIF, brains available under the versions mock, v0 and v1, keep same mechanism to choose the configuration. Make sure the extractor is able to produce multiple brain formats and application is able to operate them. Integrate the visualization of new input / output and state channels into the side panel on UI.

/speckit-plan Write an utility to parse malecns dataset, extract the brain as defined by ADR 006-class-seeded-forager-brain.md The brain development requires brain calibration skills `microfly-calibrate`. Extract only the skills from the branch `013-forager-brain-15k-lif-v2` and adopt it for the purpose of calibrating for newly extract brain.Preserve compatibility of the simulator with previous versions allowing user to choose between previous versions.


# 2026-10-09

Apply the dynamical-regime improvements: per-role noise (L7′ `noiseBulkScale`), inhibitory gain (L8 `inhibitoryScale`), regime gates as a calibration stage before world runs, `tauSyn` and `motorSmoothing` on the calibration grid. Keep the best candidate even if it never brakes; the next brain iteration adds brake neurons and changes the path selection.

# 2026-10-08

/speckit-specify the brain requires dynamical regime. All four MUST be implemented in one step.  Changing only one of these will look like a regression.

1. Weights are scaled far above threshold. With postFraction weights × 50, each edge behaves like an OR gate: activity spreads down every excitatory path until refractoriness caps it. That is the documented saturation, with forward/feed at about 0.985 of the rate ceiling. The calibration finding that only synapticScale=50 finds food fits this: below 50, signals die out within the 3–5 synapses from odour to the descending neurons; at 50, everything saturates. Without noise and a baseline, there is no in-between setting.

2. Normalising over the selected subgraph inflates truncated neurons. A neuron with 1,000 real input synapses, 20 of them from selected neurons, gets those 20 rescaled to the full input weight of 1. Leaving neurons out of the selection makes the remaining edges stronger instead of weaker. With absolute weights, missing inputs just mean less drive.

3. There is no noise and no heterogeneity, so pools fire in lockstep. Every neuron in a pool gets identical drive from an identical start state, so the 131 ORNs on one side fire on the same step, and each pool acts like one huge neuron. Combined with issue 1, the network is effectively a deterministic binary cascade, which also helps explain why calibration-seed wins don't hold on held-out seeds.

4. Sensory coding saturates. The input pools get resting 0.2 × hunger gain [0.5, 1.5] = 0.1–0.3 per step. With V∞ = τ·I = 2–6, ORNs fire tonically even with no fruit around. The firing rate reaches the 1/3 ceiling at I ≈ 1, so the whole odour gradient is squeezed into roughly three rate levels: about 0.19 at I=0.1, 0.5 at 0.3, and 1.0 at 1. In reallity, no odour means a noise-driven state below threshold, and odour raises it in a graded way.

/speckit-plan Implement the dynamical regime across all system components so that defined issues are solved:
1. Weights are scaled far above threshold.
2. Normalising over the selected subgraph inflates truncated neurons.
3. There is no noise and no heterogeneity, so pools fire in lockstep.
4. Sensory coding saturates.

# 2026-10-06

/speckit-specify ADR 004-output-pool-synaptic-scale.md defines the solution to define own control knobs at LIF for un-pin `forward` and `feed` from the firing ceiling. Study it and create a specification.

/speckit-plan Define own control knobs at LIF for un-pin `forward` and `feed` from the firing ceiling as designed by ADR 004-output-pool-synaptic-scale.md

# 2026-10-06

/speckit-specify World map requires recalibration:
1. Only three edible (food) object, each cast odor on the distance proportional to its size. Odor is max at the edible (food) object position. Small food unit is `red_flower_plant`; Medium food unit is `jungle-plant-010`; Large food unit is `jungle-plant-015`. Food is distributed on the map so that there are still areas without odor but fly has a chance to move through the world following the odor.
2. Odor is connected to food units and its size.
3. Remove following object from the map permanently: `jungle-plant-016`, `jungle-plant-017`, `jungle-bush-018`.
4. Declassify following object, which are marked as edible toward decor:  `yellow_flower_single`, `yellow_flowers_trio`, `yellow_flowers_cluster`.
5. Make the fly sprite 32x32 and make it look like a fruit fly.

/speckit-plan Recalibrate all variants of the world map implemented by the app.


# 2026-10-05

/speckit-specify Split the view port into the world and right side panel that shows a status of fly. The fly status consits of
* Action the fly is taken
* Visualization of the brain neurons and aggregated spike activation over past ticks. The user should be able what part of brain has been active recently
* Input signals on Left (L) and Right (R) channels (visualized as bars, one row per channel). Visualization per channel (e.g. food odor, danger, etc). The channes as supported by the LIF and Brain.
* Output signals on Left (L) and Right (R) channels (visualized as bars, one row per channel). Visualization per channel (e.g. leg motor, wing motor etc). The channes as supported by the LIF and Brain. 

The panel and channels visualization has to be extendible to the capabilities enabled in the brain and LIF.

/speckit-plan Make the feature adaptable to brain capabilities. If the declaration of brain capabilities is needed it is a time to adjust the export and brain snapshot again. Use three.js to visualize the brain point cloud and fade-in / fade-out animation to visualize neuron activities. The panel and channels visualization has to be extendible to the capabilities enabled in the brain and LIF so that development of new channel would not break everything out.

/speckit-bugfix-report A single panel shows both list of fly and status for each. Convert it into the tabs based expereince. The "world" tab shows list of fly, the "fly" tab shows the status. The fly status panel consumes alot of space when Left / Right channel indicates takes a row. Make a one row of Left and Right indicator, zero in the middle. The left signals are shown as bar from middle to left side of panel and right channel from middle to right side of panel. Use colors to distinguish values.   

--

/speckit-specify Add the odor layer to the world as  toggable layer (off by default). The layer uses transparent gradients to show odor intensity at the point in the world. 

/speckit-plan Implement the odor lavel toggle in the world tab. Use the arcade style visibility toggle. Draw the odol intesity as heatmap style over the world map. 

--

/speckit-specify Write an utility to parse malecns dataset, extract the brain as defined by ADR 003-hungry-forager-brain.md. This brain should enable the fly behave like a hungry animal. It should smell food from a distance, walk toward it, stop on it, eat for a while, and leave when it is full. Integrate the brain into LIF and simulator. Keep existing LIF, brains available under the version v0 (lif-v0.js, etc). Allow user to choose between mock, small brain v0 and the new brain v1 via config. Make sure the extractor is able to produce multiple brain formats.

/speckit-plan Write an utility to parse malecns dataset, extract the brain as defined by ADR 003-hungry-forager-brain.md Preserve compatibility of the simulator with previous versions allowing user to choose between mock, small brain v0 and the new brain v1 via config. The goal is comparision of various brain behaviours. 

/speckit-bugfix-report The side panel does not show the hunger level for the fly (report it on side panel using the bars from 0 to 100%). Fly is never pauses at the food place, fly are only moving. Taste neurons does not show any activity. The poincloud of neuron's activity does not show too much activities to compare with simple brain. It is not clear if brain functioning correctly.   

# 2026-10-04

/speckit-specify Setup the infrastructure for the app development. Create a world in the style of 90x arcade games. The world is scrollable and zoomable with mouse. The world has grass, trees, water, rocks, etc. It has a eadable elements fruits, honey and danger fires, spiders. The world is renderable in the browser and configurable via json so that in the future it can be changed. 

/speckit-plan Either discover an open assets in the internet to create a world or try to reuse them from `assets` folder (unformtunately, I do not know it format). The world is inspired by https://github.com/a16z-infra/ai-town (do not re-use any ReactJS assets). Create the world assets, its json config and all required html/css/js file in `public` folder. 

--

/speckit-specify A LIF core, a seeded random graph, and a two-channel fly network to validate integrations and engine before a real network to be integrated. ADR 001-lif-toy-network-and-fly-integration.md the "toy" network and its integration to the world. As an outcome, the world runs six fly each powered by own worker running toy LIF network.

/speckit-plan Follow ADR 001-lif-toy-network-and-fly-integration.md to implement "toy" LIF network as web worker, integrated them into the world.

--

/speckit-specify Write an utility to parse malecns dataset, extract smallest feasible brain topology as defined by 002-smallest-functional-brain into the data format and integrated it with simulator. Existing toy fly mock has to still be fully functional and be exchangable via config. 

/speckit-plan Write the extraction utility in python. Make a decision about the serialization format for the graph, keep in-mind that full brain might be injected. Use the domain langauge established at malecns.md to configure the utility but make configurability minimal covering only ADR needs 002-smallest-functional-brain. Validate the utility with real brain extraction and integrating into lif.js. Keep existing mock implementation alive and configurable. The goal is comparision of both methods of brain modelling (random vs nature). 

--

/speckit-specify Create a visual inspection of brain snapshot as point cloud with edges, similar to inspector of the dataset malecns-3d.html (keep malecns-3d.html unchange, implement a parallel version at `public/brains` so that it is loadable through webserver as simulation). If the brain snapshot does not conatin 3d dimensional data as available at main dataset extend it, it would be required for further visualization inside the world.

/speckit-plan Update the data extractor to carry 3d data point. It is nessesary for the brain inspectof and further visualization features. Implement a brain inspector similar to `inspector/malecns-3d.html` inside `public/brains` so that user can switch throught different brains available in the simulator. Keep similar level filering and annotations as `inspector/malecns-3d.html` has.

--

/speckit-specify The world is large for six inhabitants and lack pixel perfect details to be expected for moder RPG style games. The new details assets for the world constructions has been released into `public/assets/atlas`. This change is also driving an ability to represent a real maps in the future. Adopt the new tileset and create a diverse map environment: with water and rocks on the shore; grass with plantsm flowers and bushes; standalone trees and mid size group of trees. 

/speckit-plan Adopt high resolution assets for the world creation `public/assets/atlas`. Use `OBJECTS.md` to understand the assets and its usage. The assets does not give you equal size tiles, therefore the world architecture and notation has to be redefined where drawn scene is one layer but "tile" to control the fly is another layer. Adopt the new tileset and create a diverse map environment: with water and rocks on the shore; grass with plantsm flowers and bushes; standalone trees and mid size group of trees. Do not make any animated water, keep drawing a static map (only fly are animated). 

About your decision:
* "The new tileset has no grass-to-water edge tiles, so shorelines are built from rock and pebble art." There should be water to sand and sand to grass, use it. If you cannot find suitable combination keep you decision.
* "Fruits, honey, fires, spiders and the flies keep their current behaviour and art. Only their placement and scale change." The new dataset provides enough object to represet eadable objects (e.g. fruits, flowers, honey) use it. It has also a few representing danger (skull_spear_banner, campfire_logs, oil_lantern_post) use it.   

/speckit-bugfix-report Choosen tiles to express the world partually correct, it makes a world drawing corrupled. 
* `beach-terrain-001` do not use it. there are no reliable sand to grass transition. Remove sand completly.
* Usage of  `beach-rock-001`, `beach-rock-002`,  `beach-rock-003` for shore visualization is wrong this sprites are object to be overlay over terrain and water. Use `beach-plant-001`, `beach-plant-003` as transition from water to grass, it might require rotations. Use from `beach-plant-013` to `beach-plant-017` as decoration objects on terrain object nearby water.
* Do not use `rocks2-terrain-004`, `rocks2-terrain-005`, `rocks2-terrain-006`, `rocks2-terrain-007`, they are one color solid tiles. Instead use `rocks2-terrain-009`, `outcrop_medium_grass`, `beach-terrain-011`. Its usage might require multi layering
* Add more explicit flowers `jungle-bush-018`, `jungle-plant-016`, `trees-plant-005`, `jungle-plant-010`, `jungle-plant-015`. Remove `jungle-prop-001` honey
* Make the fly sligtly bigger to be aligned with 22 x 22 pixes.  

/speckit-bugfix-report The world still fails to render the water ponds and lakes. Use the patterns as defined by /Users/kolesnik/devel/go/src/github.com/fogfish/zrpg-art/examples (check WATER-SPEC.md) to render one medium size lake and few small ponds in the world. Do not use a water animation.

/speckit-bugfix-report Spread the flowers and danger objects around the world. Remove `jungle-prop-002` as danger object. 
