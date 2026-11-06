# Reference data

Every file here is bundled into the app and works offline. Edit freely.

Each file has the same envelope:

```json
{
  "dataset": "sources",          // must match the file name
  "version": "1.0.0",            // bump when you edit (major.minor.patch)
  "updated": "2026-11-06",       // date of your edit
  "description": "...",
  "records": [ ... ]             // the data; every record needs a unique "id"
}
```

`npm test` checks every file against this envelope, so a typo shows up before it ships.
Legal labels, climate values and similar facts change over time: keep `lastVerified`
dates current and cite a `sources.json` id.
