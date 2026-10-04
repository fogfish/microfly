"""Feather reads for the MaleCNS v1.0 release. Column-selected; edges are streamed in batches.

Memory is bounded by the admitted subgraph, not by the 25.5M-row edge file (Constitution IV).
"""

import os

import numpy as np
import pyarrow as pa
from pyarrow import ipc

from .errors import ExtractError

ANNOTATIONS = "body-annotations-male-cns-v1.0-minconf-0.5.feather"
NEUROTRANSMITTERS = "body-neurotransmitters-male-cns-v1.0.feather"
EDGES = "connectome-weights-male-cns-v1.0-minconf-0.5-traced-only.feather"

ANNOTATION_COLUMNS = ["bodyId", "class", "superclass", "somaSide", "somaLocation", "status", "type"]
NEUROTRANSMITTER_COLUMNS = ["body", "predicted_nt", "predicted_nt_confidence"]
EDGE_COLUMNS = ["body_pre", "body_post", "weight"]


def dataset_path(directory, name):
    return os.path.join(directory, name)


def check_files(directory):
    """E-DATASET-MISSING for the first required file that is absent."""
    for name in (ANNOTATIONS, NEUROTRANSMITTERS, EDGES):
        if not os.path.isfile(dataset_path(directory, name)):
            raise ExtractError("E-DATASET-MISSING", f"required file not found: {dataset_path(directory, name)}")


def _open(path):
    return ipc.open_file(pa.memory_map(path, "r"))


def _check_columns(reader, path, columns):
    present = set(reader.schema.names)
    for column in columns:
        if column not in present:
            raise ExtractError("E-DATASET-MISSING", f"column {column} missing in {os.path.basename(path)}")


def count_rows(path):
    """Row count from the Feather batch metadata, without reading the columns into memory."""
    reader = _open(path)
    return sum(reader.get_batch(i).num_rows for i in range(reader.num_record_batches))


def check_rows(directory, expect):
    """E-DATASET-ROWS when a row count differs from the config's `expect` values."""
    checks = (
        (ANNOTATIONS, "annotationRows"),
        (EDGES, "edgeRows"),
        (NEUROTRANSMITTERS, "neurotransmitterRows"),
    )
    for name, key in checks:
        actual = count_rows(dataset_path(directory, name))
        if actual != expect[key]:
            raise ExtractError("E-DATASET-ROWS",
                               f"{key} expected {expect[key]}, found {actual} in {name}")


def load_rows(path, columns):
    """Read the selected columns of a small table as a list of dict rows."""
    reader = _open(path)
    _check_columns(reader, path, columns)
    table = reader.read_all().select(columns)
    return table.to_pylist()


def load_annotations(directory):
    return load_rows(dataset_path(directory, ANNOTATIONS), ANNOTATION_COLUMNS)


def load_neurotransmitters(directory):
    return load_rows(dataset_path(directory, NEUROTRANSMITTERS), NEUROTRANSMITTER_COLUMNS)


def stream_edges(directory, admitted_ids):
    """Traced-only edges whose both ends are admitted, as (pre, post, synapses) int64 arrays.

    Each batch is read column by column and filtered before the next one is read.
    """
    path = dataset_path(directory, EDGES)
    reader = _open(path)
    _check_columns(reader, path, EDGE_COLUMNS)
    ids = np.asarray(admitted_ids, dtype=np.int64)
    pre_parts, post_parts, syn_parts = [], [], []
    for i in range(reader.num_record_batches):
        batch = reader.get_batch(i)
        pre = batch.column("body_pre").to_numpy(zero_copy_only=False).astype(np.int64)
        post = batch.column("body_post").to_numpy(zero_copy_only=False).astype(np.int64)
        syn = np.rint(batch.column("weight").to_numpy(zero_copy_only=False)).astype(np.int64)
        keep = np.isin(pre, ids) & np.isin(post, ids)
        pre_parts.append(pre[keep])
        post_parts.append(post[keep])
        syn_parts.append(syn[keep])
    if not pre_parts:
        empty = np.zeros(0, dtype=np.int64)
        return empty, empty.copy(), empty.copy()
    return np.concatenate(pre_parts), np.concatenate(post_parts), np.concatenate(syn_parts)
