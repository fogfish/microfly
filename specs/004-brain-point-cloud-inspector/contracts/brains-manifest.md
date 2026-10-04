# Contract: Brain Manifest (`public/brains/brains.json`)

**Readers**: the brain inspector page (`public/brains/index.html`). **Writers**: a person, by hand, when a brain is added to `public/brains/`.

## Format

```json
{
  "format": "brain-manifest",
  "version": 1,
  "default": "smallest-functional-brain.brain",
  "brains": [
    { "file": "smallest-functional-brain.brain", "label": "Smallest functional brain" }
  ]
}
```

| Field | Rule |
|---|---|
| `format`, `version` | Must be `"brain-manifest"` and `1`. Otherwise the inspector shows "unsupported brain manifest". |
| `default` | Must be the `file` of one entry. Used when the page has no `?brain=`. |
| `brains[].file` | A file name in `public/brains/`, with no path separators. The file must be a valid snapshot (the reader's rules). |
| `brains[].label` | Non-empty string shown in the switcher. |

## Rules

- `brains` is non-empty and every `file` is unique.
- An entry whose file fails the reader is still listed. Selecting it shows the reader's error and draws nothing (contract in [brain-inspector-page.md](brain-inspector-page.md)).
- A missing `brains.json` or a manifest that fails these rules shows the error panel and no brain.

## Test

`tests/brain-inspector-model.test.mjs` reads the manifest and checks every entry with the reader. A committed entry that does not parse fails the test.
