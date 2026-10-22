"""Stable error codes for the extractor (contracts/extract-config.md).

Forager codes (ADR 003 D7, contracts/extract-config-forager.md): E-POOL-EMPTY, E-SIDE-IMBALANCE,
E-OUTPUT-UNREACHED, E-NODE-RANGE, E-MODULATOR. ADR 002 codes are unchanged.

Class-seed codes (ADR 006 D14, contracts/extract-config-classseed.md): E-SEED-EMPTY (a seed filter matches no
traced body), E-SEED-OVERFLOW (seeds, pools included, exceed fill.neuronCount), E-TRANSMITTER-COLUMN
(transmitterColumn is not a column of the neurotransmitter table), E-FIDELITY (fidelity.require is true and the
steering or feeding check fails, or, for format 5, any declared fidelity.checks entry fails; names the check and
both compared values).

Wide-I/O codes (ADR 007 D19/D20, contracts/extract-config-forager-wide.md): E-PAIR (a side-matched or
probe-checked `pair` does not resolve to exactly one left and one right channel id).

ADR 011 codes (specs/019-mb-valence-learning): E-POOL-OVERLAP (two declared input pairs of the same class share a
`types`/`subclasses`/`typePrefixes` entry; names both pairs and the shared identifier). ADR 012
(specs/020-social-pheromone-senses, research R3): E-POOL-OVERLAP is also raised after pool resolution, naming
both pairs and the smallest shared `bodyId`, when a declared-set filter alone could not tell the pools apart
(e.g. a `receptorTypes`/`excludeReceptorTypes` split on the same subclass). ADR 012 also extends E-SEED-EMPTY to
a `seeds[].types`/`typePrefixes` filter (research R4): per unmatched filter, and per unmatched `types` entry.
"""


class ExtractError(Exception):
    """A rule of ADR 002 D6 was violated. Printed as ``E-CODE: message``."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message

    def __str__(self):
        return f"{self.code}: {self.message}"
