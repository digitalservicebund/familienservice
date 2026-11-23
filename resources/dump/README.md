# BAFzA dump

Put the BAFzA data export (XLSX from the WDB) into this folder and run:

```sh
pnpm import:local --input "resources/dump/<file>.xlsx"
```

The script (`scripts/import.ts`) cleans the data, splits `dokumenttitel` into `Leistung` and
`Lebensumstand` and writes a CSV to `out/`.

**Nothing in this folder is committed** (except this README), see `.gitignore`. This repository
is public: dump files and anything derived from them must never end up in the repository, in
logs or in GitHub Actions artifacts. Only use synthetic test data, never copy from a real dump.

In GitHub Actions, `.github/workflows/import.yml` downloads the dump from the private bucket to
this folder and runs the same script.
