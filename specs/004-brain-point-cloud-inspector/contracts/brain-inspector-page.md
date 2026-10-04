# Contract: Brain Inspector Page (`public/brains/index.html`)

**Served by**: `python3 -m http.server 8000 -d public`, at `/brains/`.

## Address

- `?brain=<file>`: the snapshot to show, a file name from the manifest. Missing or unknown: the manifest's `default`. The address is updated when the user switches brains, so a view can be shared.

## Layout (mirrors `inspector/malecns-3d.html`)

Side panel, then the 3D view.

| Section | Controls | Reference equivalent |
|---|---|---|
| Brain | Switcher (labels from the manifest) and the counts: neurons in file, edges in file, neurons drawn, edges drawn | Header and sources |
| Level | Region, Superclass, Class, Type (default Class) | Level |
| Connections | Group graph (default) or Top body-to-body; minimum synapses (group mode); top edges (body mode, 20 to 3,000, default 300) | Connections |
| Display | Soma points, Unannotated, Auto-rotate, Point density, Reset view | Display |
| Groups | Show all, Hide all, a checkbox per group with colour, name and count | Groups |
| Selected / hovered | Hover shows the name and count, click pins the description | Selected / hovered |
| Sources | Role descriptions and sources list (copied, research R8) | Sources for role descriptions |

**Note in the side panel**: "Snapshots hold only Traced bodies, so the reference status filter is not shown."

## Neuron information (hover and click)

- Neuron: `bodyId`, class, type, soma side, role, transmitter and sign where present, superclass.
- Group: name, level, count, and the role description (research R8).

## Errors

| Situation | Shown | Drawn |
|---|---|---|
| Manifest missing or invalid | Error panel, names the manifest | Nothing |
| Brain file missing | Error panel with the file name | Nothing |
| Reader rejects the file (magic, version, header, sections, CSR, `soma`, `superclass`) | Error panel with the reader's message | Nothing |
| File valid but no neuron has `soma` (for example a file written before positions) | "No neuron has a 3D position" | Nothing |
| Browser cannot create a WebGL context | Message naming WebGL | Nothing |

Switching to a brain that fails replaces the previous view with the error panel. A failed switch never leaves a mixed view.

## Behaviour

- Points: neurons with a `soma`, coloured by level group (role colours at the Region level are the reference palette). Density and Unannotated apply as in the reference.
- Edges in group mode: one curve per group pair, opacity by log synapse sum, filtered by minimum synapses and by hidden groups.
- Edges in body mode: the top N body edges by raw synapse count (research R7), between neurons that are visible at the chosen level.
- Scene centring and scaling are the reference rules: centre of the bounding box, scale to fit 220 units.
- Hidden groups remove their points and edges. Counts in the panel reflect the current filters.
