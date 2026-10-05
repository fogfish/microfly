"""Header-only migration, version 2 → version 3 (specs/006-fly-status-panel/contracts/snapshot-format-v3.md).

Usage: python -m malecns_brain.migrate <in.brain> <config.json> <out.brain>

The capabilities block comes from the config (validated there). The offsets, targets, weights and
synapses are copied unchanged, so the body bytes of the output equal those of the input. In-place
migration (in and out the same path) is allowed: the input is read fully before the output is written.
"""

import sys

from .config import load_config
from .container import LEGACY_VERSION, read_container, write_container
from .errors import ExtractError


def migrate(in_path, config_path, out_path):
    config = load_config(config_path)
    with open(in_path, "rb") as handle:
        data = handle.read()
    try:
        legacy = read_container(data, version=LEGACY_VERSION)
    except ValueError as error:
        raise ExtractError("E-MIGRATE", str(error)) from error

    header = {key: value for key, value in legacy["header"].items() if key != "sections"}
    header["capabilities"] = config["capabilities"]
    try:
        return write_container(out_path, header, legacy["offsets"], legacy["targets"],
                               legacy["weights"], legacy["synapses"])
    except ValueError as error:
        raise ExtractError("E-MIGRATE", str(error)) from error


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 3:
        print("usage: python -m malecns_brain.migrate <in.brain> <config.json> <out.brain>", file=sys.stderr)
        return 2
    try:
        size = migrate(*argv)
    except ExtractError as error:
        print(str(error), file=sys.stderr)
        return 1
    print(f"migrated {argv[0]} to version 3 -> {argv[2]} ({size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
