# Research: Brain Point-Cloud Inspector

**Feature**: `004-brain-point-cloud-inspector` | Decisions for [plan.md](plan.md). Every NEEDS CLARIFICATION from the plan is resolved here.

## R1. Where the 3D positions and superclass live in the container

**Decision**: Add two optional fields to each neuron record in the header, and one provenance field. Neuron: `soma` (an array of three integers, or `null`) and `superclass` (a string, or `null`). Provenance: `positionSource` (for example `"body-annotations-male-cns-v1.0-minconf-0.5.feather:somaLocation"`). `formatVersion` stays 2.

**Rationale**: The contract (`snapshot-format.md`, Header section) already allows adding optional header fields within version 2. Readers that ignore unknown fields keep working, so the simulator is unaffected. The header is JSON, so the new fields are easy to inspect. For the full admitted subgraph (143,219 neurons) the header grows by about 7 MB, against a 221 MB body, which is acceptable.

**Alternatives considered**:
- A new `positions` section (three `int32` per neuron) in the binary body. Compact, but it changes the layout and forces `formatVersion` 3. Every reader and the simulator would have to change, for no gain at this scale. Revisit only if the header becomes a bottleneck.
- A sidecar file with positions. Two files to keep in sync, and the provenance would be split.

## R2. Behaviour when a position is unavailable

**Decision**: The extractor writes `soma: null` for a neuron whose `somaLocation` is missing, empty, or not three integers. The extraction report gains a line `positions  N with soma, M without`. The viewer does not draw neurons with `soma: null` and does not draw edges touching them. It says how many were left out.

**Rationale**: The user asked for 3D data "unless unavailable", and the spec requires that no neuron is dropped without being counted. Recording `null` keeps the neuron in the brain (so the simulator's topology is unchanged) and makes the gap visible.

**Alternatives considered**: Excluding such neurons from the brain. That would change the simulated network because of a display property, which is wrong. Falling back to `tosomaLocation`, which exists for only 995 bodies, would mix two different locations.

**Measurement**: For the reference brain all 11 neurons have `somaLocation` (checked). The admitted subgraph's coverage is measured when the full extraction runs; the report prints it.

## R3. Which dataset column is the position

**Decision**: `somaLocation` from `body-annotations-male-cns-v1.0-minconf-0.5.feather`, the same column the reference inspector uses for its somas. Units: voxels, as recorded in the dataset. The voxel size is not stated in the dataset (`malecns.md` §10), so the viewer scales the cloud to fit and states no physical distance.

**Rationale**: It is the soma location for every body, read from the same annotation table the extractor already loads. `tosomaLocation` covers too few bodies.

## R4. Superclass and region for the level filter

**Decision**: Store `superclass` in the header. Derive `region` in the viewer from the superclass prefix, following `malecns.md` §5:
- `ol_*` → Optic lobe
- `cb_*` → Central brain
- `visual_*` → Optic lobe (links between the optic lobe and the central brain; listed under Optic lobe in the reference inspector, to be confirmed)
- `vnc_*` → Ventral nerve cord
- `ascending_neuron`, `descending_neuron`, `*_ascending`, `*_descending` → Brain-VNC pathways
- `ENS` → ENS
- `null` superclass → Unannotated

**Rationale**: `malecns.md` §5 defines the region by prefix. Storing region too would duplicate a derived value. The reference inspector also has region groups "Brain-VNC pathways", "ENS" and "Unannotated", which this rule produces.

**Verification step (tasks phase)**: Compare the region rule's group sizes over the full annotation table against the `n` counts in the reference inspector's embedded data (`levels.region.groups`). Any difference is resolved by the reference counts. This is the one place where the rule is inferred and not stated.

**Alternatives considered**: Storing `region` in the header. Rejected because it is derivable and would grow the header.

## R5. Three.js: vendor or write raw WebGL

**Decision**: Vendor three.js r160 (`three.module.min.js`, `OrbitControls.js`) into `public/brains/vendor/three/`, with its MIT licence. Load it through an import map that points at the vendored files.

**Rationale**: Matches the reference inspector's version and controls. Constitution I allows vendored libraries when the plan justifies them, and this is that justification (Complexity Tracking). Vendoring removes the CDN dependency that FR-016 requires removed.

**Alternatives considered**: Raw WebGL with a hand-written orbit camera. It would be the only option without a library, but the code is large and untested for a feature that is mostly visual. Canvas 2D cannot give an orbit 3D view.

## R6. Group graph and group centroids in the viewer

**Decision**: Compute groups in the browser from the loaded snapshot, not from precomputed data as the reference does. For each level, a group's members are the neurons with that level's value. Its centroid is the mean of its members' positions. A group with no placed member is placed at the weighted mean of its placed neighbours, as the reference does. Group-to-group edges are sums of body synapses. Groups that are hidden by the legend are removed with their edges.

**Rationale**: A snapshot holds at most 143k neurons, so an O(E) pass in the browser is cheap, and it avoids a second precomputed file per brain. The reference's placement rule is kept so the two views agree.

## R7. Top edges for large snapshots

**Decision**: Choose the top N body edges (default 300, slider up to 3,000, as the reference) in one pass. Build a histogram of raw synapse counts (65,536 buckets, since counts are `uint16`), find the largest threshold that leaves at least N edges, then take the edges above that threshold plus enough edges equal to it, in index order, to make N. No sort of the 22 million edges.

**Rationale**: Sorting 22 million values in the browser is too slow for the performance goal. The histogram is one pass over the synapse array and gives the same set as a sort with a stable tie-break.

**Alternatives considered**: Sorting an index array (slow, memory-heavy). Sampling (non-deterministic to the user, and the on-screen count would be unclear).

## R8. Annotations and level filters copied from the reference inspector

**Decision**: Copy the role descriptions (regions, superclasses, classes, types) and the sources list from `inspector/malecns-3d.html` into `public/brains/js/annotations.js`. The original file is only read, never edited. The level names, default hidden groups (`type`: "Other typed", "Untyped") and the "(no class) <superclass>" naming follow the reference.

**Rationale**: "Keep similar annotations" means the same text. Copying keeps the viewer self-contained, and the original stays byte-identical as required.

**Alternatives considered**: Loading the reference HTML and parsing its embedded data. Fragile and would couple the viewer to a file that must not change.

## R9. Status filter

**Decision**: Do not include the reference's body-status filter. Snapshots hold only `Traced` bodies (the admission rule of ADR 002 D1), so every neuron would have the same status and the filter would do nothing. The viewer states this in the sidebar note.

**Rationale**: A control that cannot change the view is noise. This is a deliberate difference from the reference and is recorded in the page's note.

## R10. Brain list and switching

**Decision**: A static manifest `public/brains/brains.json` lists the brains the simulator can use. The viewer reads it, fills a switcher, and loads the chosen file with the existing reader. The active brain is in the URL (`?brain=<file>`), so a view can be shared. The manifest is hand-written; each entry must parse with the reader (checked by a test).

**Rationale**: A static host cannot list a folder. The manifest is the one list both the simulator and the inspector can share. The contract is in [contracts/brains-manifest.md](contracts/brains-manifest.md).

**Open point for tasks**: Only the reference brain is committed. A second committed brain is a configuration and an extraction run (the config format allows it), to be done in tasks if a valid second configuration exists. The switcher works with any number of entries.

## R11. Snapshot reader changes

**Decision**: `public/js/brain/snapshot.js` accepts the optional `soma` and `superclass` fields. It rejects a malformed `soma` (not `null` and not three integers) with `snapshot neuron N has a malformed soma position`. Missing fields are fine. The same rule is added to `container.py` read-back, with the same message.

**Rationale**: The reader must not accept data it cannot draw. The message follows the contract's style.

## R12. Determinism and self-check

**Decision**: The new fields are part of the header, so the existing self-check (`_same_header`) covers them. The body bytes must be unchanged for the reference brain, because selection is unchanged. The quickstart checks this against the current file.

**Rationale**: It proves the regeneration changed only what it should.
