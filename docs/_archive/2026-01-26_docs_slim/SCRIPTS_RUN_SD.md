# Siddes overlay runner: `./scripts/run_sd.sh` (sd_387)

## Why this exists
You were hitting errors like:

- `No such file or directory: ./scripts/sd_386_...`

That happens when the apply-helper script is still in `~/Downloads` (or saved as `(...)(1).sh`) instead of inside your repo’s `scripts/` folder.

## What `run_sd.sh` does
- Searches **repo scripts first** (`./scripts/`)
- Then searches **Downloads** (`~/Downloads` and `~/Downloads/sidesroot/scripts`)
- Picks the **newest** matching file when duplicates exist
- If it finds the script in Downloads, it **copies it into ./scripts** automatically
- Then `chmod +x` and runs it

## Usage
Run from repo root:

```bash
./scripts/run_sd.sh 386
```

Or by filename:

```bash
./scripts/run_sd.sh sd_386_broadcast_compose_web_shell_apply_helper.sh
```

## Common cases
If a file was downloaded as `(1)` you don’t need to rename it — the runner chooses the newest match.
