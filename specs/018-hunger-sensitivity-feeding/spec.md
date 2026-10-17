# Feature Specification: Hunger-Sensitive Feeding and Food Depletion

**Feature Branch**: `018-hunger-sensitivity-feeding`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Hunger below a thresholds increases sensivity of food odor then eating state either suspend a fly until energy is recovered or slow it down. Eating shall decrease the availability of the resource on the map as a consequence level of odor from that drops. Small food resource is consumed by one food consumption, medium by two and large by three. The food resources are recovered in 30 seconds (to be configurable)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A hungry fly finds food faster (Priority: P1)

As a fly's energy reserves run low and it becomes hungry, it should pick up the scent of nearby food from farther away than it could when well fed, so that hunger reliably drives it toward a food resource instead of continuing to wander at random.

**Why this priority**: This is the core causal link between hunger and foraging success. Without it, a starving fly behaves no differently from a sated one, which defeats the purpose of a hunger-driven forager.

**Independent Test**: Place a fly at a fixed distance from a food resource with its energy set above the hunger threshold, then repeat with energy set below the threshold. Confirm the hungry fly detects and orients toward the resource from a greater distance, measured by the same odor-sensing outcome used for food odor already in the system.

**Acceptance Scenarios**:

1. **Given** a fly's energy is above the configured hunger threshold, **When** it is placed within smelling range of a food resource, **Then** its sensitivity to that resource's odor matches the current baseline (no boost).
2. **Given** a fly's energy drops below the configured hunger threshold, **When** it is placed within smelling range of a food resource, **Then** its sensitivity to that resource's odor is higher than the baseline, increasing the distance from which the resource can be detected.
3. **Given** the hunger threshold is crossed while a fly is already moving, **When** the fly's energy falls below the threshold mid-approach, **Then** the sensitivity increase applies smoothly, without causing the fly to lose track of a resource it was already heading toward.

---

### User Story 2 - Feeding wears down a food resource until it recovers (Priority: P1)

As flies feed on a food resource, the resource's remaining availability should go down, and the strength of the odor it gives off should drop along with it, until the resource is used up and briefly stops attracting flies before it replenishes.

**Why this priority**: Resource depletion and recovery is what keeps foraging dynamic — without it, food is an infinite, unchanging attractor and the world never asks flies to search for a new spot.

**Independent Test**: Seed a food resource of each size (small, medium, large), have flies feed on it to completion the declared number of times for that size, and confirm the resource reaches zero availability, stops emitting odor, and becomes available again only after the configured recovery duration has passed.

**Acceptance Scenarios**:

1. **Given** a small food resource at full availability, **When** one fly feeds on it to satiation, **Then** the resource's availability reaches zero and it stops giving off odor.
2. **Given** a medium food resource at full availability, **When** flies feed on it to satiation two separate times, **Then** the resource's availability reaches zero only after the second completed feeding, having dropped partway after the first.
3. **Given** a large food resource at full availability, **When** flies feed on it to satiation three separate times, **Then** the resource's availability reaches zero only after the third completed feeding.
4. **Given** a food resource at partial availability, **When** another fly senses it, **Then** the strength of the odor it detects is proportional to the resource's remaining availability, not its original full strength.
5. **Given** a food resource that has just reached zero availability, **When** the configured recovery duration (default 30 seconds) elapses, **Then** the resource returns to full availability and resumes giving off odor at full strength.
6. **Given** a food resource at zero availability, **When** a fly reaches it before the recovery duration has elapsed, **Then** the fly cannot feed there and gets no energy from it.

---

### User Story 3 - Feeding affects how a fly moves (Priority: P2)

As a fly feeds on a food resource, it should visibly behave differently than when it is walking around — either standing still or moving more slowly — until it has eaten enough to no longer be hungry, so the act of feeding reads as a distinct, observable behavior rather than something invisible happening in the background.

**Why this priority**: This is an observability and world-believability improvement built on top of User Stories 1 and 2; feeding already changes energy today, but how clearly that is expressed through movement is being made an explicit, tunable choice.

**Independent Test**: Configure a world with the "pause while feeding" behavior and confirm a feeding fly stays in place until its energy reaches the satiation target; configure another world with the "slow while feeding" behavior and confirm the same fly keeps moving, at reduced speed, for the same feeding period.

**Acceptance Scenarios**:

1. **Given** a world configured so eating pauses the fly, **When** a fly begins feeding, **Then** it stays in place until its energy reaches the satiation target, then resumes normal movement.
2. **Given** a world configured so eating slows the fly, **When** a fly begins feeding, **Then** it continues moving but at a reduced, configured speed until its energy reaches the satiation target, then resumes normal movement.
3. **Given** a fly is feeding under either configuration, **When** the food resource it is feeding on runs out before the fly is satiated, **Then** the fly stops feeding immediately and resumes normal movement.

---

### Edge Cases

- A fly reaches a food resource exactly as its last unit of availability is consumed by another fly feeding there at the same time — only one of them completes a feeding; the other finds it empty.
- A fly starts feeding but leaves before reaching satiation (e.g., it is scared off) — the resource's availability is unaffected, since the feeding was not completed.
- The configured recovery duration is set to zero — the resource becomes available again on the very next check after being depleted.
- A fly's energy sits exactly at the hunger threshold — treated as not-yet-hungry (no sensitivity boost), consistent with the resource being "empty" using a closed lower bound.
- A world defines a food resource size that isn't small, medium, or large — treated as a configuration error, surfaced by name rather than silently defaulting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a world declare a hunger threshold below which a fly's energy is considered low enough to be "hungry."
- **FR-002**: While a fly is hungry, the system MUST increase that fly's sensitivity to food odor relative to its baseline sensitivity when not hungry.
- **FR-003**: The sensitivity increase MUST depend only on the fly's own energy level crossing the declared threshold, never on information the fly could not otherwise sense (no reading hidden world state to "cheat" toward food).
- **FR-004**: The system MUST let a world declare, per food resource, a size category of small, medium, or large.
- **FR-005**: A small food resource MUST be fully depleted by exactly one completed feeding; a medium resource by exactly two; a large resource by exactly three.
- **FR-006**: A completed feeding (a fly feeding until its energy reaches the satiation target, or until the resource runs out, whichever comes first) MUST reduce the resource's remaining availability by exactly one feeding's worth, down to a floor of zero.
- **FR-007**: A feeding that is interrupted before the fly reaches satiation and before the resource is exhausted MUST NOT reduce the resource's remaining availability.
- **FR-008**: The strength of the odor a food resource gives off MUST scale with its remaining availability (fraction of its full capacity for its size), reaching zero when the resource is fully depleted.
- **FR-009**: A fully depleted food resource MUST NOT be feedable by any fly until it has recovered.
- **FR-010**: The system MUST let a world declare a recovery duration after which a fully depleted food resource returns to full availability; the default recovery duration is 30 seconds.
- **FR-011**: The recovery duration MUST be configurable per world (and MAY be configurable per food resource size) rather than fixed in code.
- **FR-012**: The system MUST let a world declare whether a feeding fly pauses in place or continues moving at a reduced speed while it feeds.
- **FR-013**: A feeding fly, under either declared behavior, MUST return to its normal movement once its energy reaches the satiation target or the resource it is feeding on is exhausted.
- **FR-014**: All thresholds, sizes, capacities, and durations introduced by this feature MUST be declared in world configuration data, not hard-coded in behavior code.

### Key Entities

- **Fly**: The foraging agent. Relevant attributes for this feature: current energy level, derived hunger state (hungry/not hungry relative to the declared threshold), current feeding state (feeding or not), and movement behavior while feeding.
- **Food Resource**: A place on the map that flies can feed on. Relevant attributes: size category (small, medium, or large), full feeding capacity implied by its size (1, 2, or 3 completed feedings), remaining availability, current odor strength (derived from remaining availability), and recovery state (depleted-and-waiting vs. available).
- **Feeding Event**: One fly's attempt to feed at one food resource, from the moment it starts until it stops, either by reaching satiation, by the resource running out, or by being interrupted. Only a feeding event that ends in satiation or in exhausting the resource reduces the resource's remaining availability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In repeated simulation runs with a fixed seed, a hungry fly detects and turns toward a food resource from a measurably greater distance than a well-fed fly placed in the same position, 100% of the time under identical conditions.
- **SC-002**: Across 100 simulated small, medium, and large food resources fed to exhaustion, each is depleted after exactly 1, 2, and 3 completed feedings respectively, with no exceptions.
- **SC-003**: A depleted food resource's odor strength, sampled at any point before full depletion, tracks its remaining availability (half-depleted gives roughly half-strength odor, and so on) rather than jumping straight from full strength to none.
- **SC-004**: A depleted food resource becomes feedable again within the configured recovery duration, verified across repeated runs with recovery durations of 0, 30 (default), and a custom longer value.
- **SC-005**: Changing only the world's feeding-movement setting (pause vs. slow) changes a feeding fly's observed movement without changing how much energy it gains or how much availability the resource loses, confirming the two concerns are independent.

## Assumptions

- "Hunger" is read as the existing low-energy state already tracked for each fly (energy below a declared threshold), not a new quantity; this feature governs how that existing state affects food-odor sensitivity, not how hunger itself is computed.
- "One food consumption" for a resource's size (small = 1, medium = 2, large = 3) means one *completed* feeding — a fly feeding until it reaches its satiation target, or until the resource itself runs out — not a continuous drain proportional to feeding time. A feeding that is abandoned early (the fly leaves before satiation and before the resource is empty) does not consume any of the resource's capacity.
- The "suspend" vs. "slow down" feeding behavior is a world-level configuration choice rather than something the system picks automatically, consistent with this project's existing pattern of declaring stimulus- and motor-affecting behavior in world configuration data rather than in code.
- The recovery duration is measured from the moment a resource reaches zero remaining availability, and applies uniformly to that resource until it is full again (no partial, gradual regrowth during the recovery window, as distinguished from any prior continuous-regrowth behavior).
- A resource that regains availability through recovery returns to full availability for its size, not to some intermediate amount.
- This feature applies to food resources and foraging flies generally; it does not introduce new behavior for flies that are not hungry-driven foragers (e.g., any fly types without an energy/hunger model are out of scope).
