"""Stable error codes for the extractor (contracts/extract-config.md)."""


class ExtractError(Exception):
    """A rule of ADR 002 D6 was violated. Printed as ``E-CODE: message``."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message

    def __str__(self):
        return f"{self.code}: {self.message}"
