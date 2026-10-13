"""Stable error codes for the extractor (contracts/extract-config.md).

Forager codes (ADR 003 D7, contracts/extract-config-forager.md): E-POOL-EMPTY, E-SIDE-IMBALANCE,
E-OUTPUT-UNREACHED, E-NODE-RANGE, E-MODULATOR. ADR 002 codes are unchanged.

Class-seed codes (ADR 006 D14, contracts/extract-config-classseed.md): E-SEED-EMPTY (a seed filter matches no
traced body), E-SEED-OVERFLOW (seeds, pools included, exceed fill.neuronCount), E-TRANSMITTER-COLUMN
(transmitterColumn is not a column of the neurotransmitter table), E-FIDELITY (fidelity.require is true and the
steering or feeding check fails; names the check and both compared values).
"""


class ExtractError(Exception):
    """A rule of ADR 002 D6 was violated. Printed as ``E-CODE: message``."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message

    def __str__(self):
        return f"{self.code}: {self.message}"
