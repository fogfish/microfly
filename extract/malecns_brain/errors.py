"""Stable error codes for the extractor (contracts/extract-config.md).

Forager codes (ADR 003 D7, contracts/extract-config-forager.md): E-POOL-EMPTY, E-SIDE-IMBALANCE,
E-OUTPUT-UNREACHED, E-NODE-RANGE, E-MODULATOR. ADR 002 codes are unchanged.

Forager v2 codes (ADR 006 D14, contracts/extract-config-forager-v2.md): E-POOL-OVERLAP, E-ANCHOR-EMPTY,
E-TRANSMITTER-SOURCE, E-PAIR-EMPTY, E-OUTPUT-SIGN (BUG-001, spec FR-032: an output pool's net admitted synaptic
weight per neuron is not positive), E-INHIBITION-DRIFT (BUG-004, spec FR-033: a region's selected
inhibitory/excitatory input ratio departs from its real-admitted-connectome ratio by more than
`ieDriftTolerance`).
"""


class ExtractError(Exception):
    """A rule of ADR 002 D6 was violated. Printed as ``E-CODE: message``."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message

    def __str__(self):
        return f"{self.code}: {self.message}"
