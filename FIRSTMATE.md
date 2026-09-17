# Firstmate intake — Relanmo

Repository: **https://github.com/maximebrmd/relanmo** · Visibility: **private** · Default branch: **main** · Local registered project name: **relanmo**.

The user authorized creation of this repository and will run Firstmate. The initial commit is planning/brand setup, not completion of P001. Preserve the existing Git history and `planning/prospecting-system/` when scaffolding next-forge.

Use [the full handoff prompt](planning/prospecting-system/crew/captain-prompt.md). Read [root AGENTS.md](AGENTS.md) before coding. Use the 95 task briefs and dependencies already under `planning/prospecting-system/crew/`; do not combine them into large feature branches.

Requested crewmates: Codex CLI, `gpt-5.6-luna`, `max` reasoning and Fast mode. `.codex/config.toml` supplies project defaults. Merge the [dispatch example](planning/prospecting-system/crew/crew-dispatch.example.json) into the appropriate Firstmate-local configuration without overwriting unrelated projects' rules. Confirm the actual child settings before scaling up.

Begin with P001. It should scaffold next-forge into this existing repository using a temporary scaffold if the initializer requires an empty directory. Preserve `README.md`'s product identity, root `AGENTS.md`, `FIRSTMATE.md`, `.codex/config.toml`, the planning pack and brand assets. Adapt/update the README to the real commands as implementation proceeds. Do not create nested Git history or discard the seed commit.

After P001, complete P002 and P003. P004/P005/P006 may then run in parallel; P007 integrates the approved dependencies and exports. Further tasks start only after their dependencies are reviewed and merged. One integration owner handles manifests, lockfile, shared exports and migration lineage.

Recommended initial capacity: three implementation crewmates plus one independent reviewer. Proposed delivery mode: `direct-PR` with CI/review and `yolo=off`, retaining any stricter existing project policy. Crewmates do not merge their own work. Repository creation authorization does not itself enable autonomous merging or production deployment.

No GitHub issues have been created automatically. Import the task cards into Firstmate's configured native backlog using its current tools, preserving their IDs and dependency graph. The task JSON is our planning format, not a Firstmate import API. All task states remain planned.
