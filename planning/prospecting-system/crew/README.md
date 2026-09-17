# Firstmate operating guide

This handoff contains **95 planned review units: 93 ship tasks and two scout reports**. Start with [the execution overview](../execution-plan.md), then [the task index](task-index.md) or [searchable task board](board.html). The repository is seeded with planning and brand assets; the application has not been scaffolded, agents have not been dispatched, and cloud resources have not been provisioned.

## Suggested operating setup

Use Firstmate as coordinator, Codex CLI as the crewmate harness, and its reference tmux backend for isolated task worktrees. Start with **three implementation crewmates and one independent reviewer**, and one merge at a time. Keep the captain's merge authority initially. This is our recommended operating policy; there is no invented `max_agents` setting in the supplied Firstmate JSON.

Firstmate separates ship work from scout reports and supports explicit delivery modes. We propose `direct-PR` with the project's CI and independent review, plus `yolo=off`. If the existing Firstmate project is configured to require `no-mistakes`, retain that requirement and use its generated brief/gates; do not silently weaken an existing setup. [Firstmate README](https://github.com/kunchenguid/firstmate/blob/fa93097162d16f70a070044b8ccece037a38e3e6/README.md), [delivery definitions](https://github.com/kunchenguid/firstmate/blob/fa93097162d16f70a070044b8ccece037a38e3e6/bin/fm-dod-lib.sh).

The plan favors independent code slices, not independence from all shared decisions. Bootstrap and contract PRs are deliberate prerequisites. Schema fragments can run together; generated migration SQL/journals are integrated serially. UI screens can start on frozen fixtures while the backend is implemented, then a narrow wiring PR connects both.

## Verified model profile

Requested crewmates: **GPT-5.6-Luna, reasoning `max`, Fast mode**. Firstmate's current Codex adapter explicitly supports the `max` mapping for `gpt-5.6-luna`. The local Codex CLI inspected for this pack was **0.154.0**; its cached catalog listed Luna/max and a `priority` tier named Fast. This verifies local advertised options, not that a live child session has already run with them. [Firstmate launch adapter](https://github.com/kunchenguid/firstmate/blob/fa93097162d16f70a070044b8ccece037a38e3e6/bin/fm-spawn.sh).

Merge [crew-dispatch.example.json](crew-dispatch.example.json) into the Firstmate home's **local** `config/crew-dispatch.json`. Preserve unrelated project rules: the default-only file is appropriate for a dedicated home, while an existing multi-project home should receive a project-specific rule with the same profile. Its native fields are `harness`, `model`, and `effort`; Fast mode is configured separately in Codex. [Dispatch schema](https://github.com/kunchenguid/firstmate/blob/fa93097162d16f70a070044b8ccece037a38e3e6/docs/configuration.md#crew-dispatch-profiles-configcrew-dispatchjson).

Merge [codex-project.example.toml](codex-project.example.toml) into the application repository's `.codex/config.toml`, preserving existing tables and settings. It uses `service_tier = "fast"` with `features.fast_mode = true`. Do not overwrite a user's global Codex configuration or change credentials. Project trust/policy can affect whether these settings load. Inspect `/model` and `/fast status` in an actual initial crewmate, and record the resolved profile before increasing concurrency. Fast changes the service tier; it does not mean lowering reasoning from max. It consumes additional usage and is separate from the SaaS operating-cost model. [Codex configuration](https://developers.openai.com/codex/config-reference/), [Fast mode](https://developers.openai.com/codex/speed/).

Firstmate currently **does not support `codex-app` as a runtime backend**. Use its Codex CLI adapter through a supported terminal backend; a desktop sidebar task is not a substitute for that lifecycle. [Backend boundary](https://github.com/kunchenguid/firstmate/blob/fa93097162d16f70a070044b8ccece037a38e3e6/docs/codex-app-backend.md).

## Before the first dispatch

1. Use the public application repository `maximebrmd/relanmo`, created at the user's request. The full technical pack is already at `planning/prospecting-system/`, with root AGENTS.md and an initial commit. Clone/register that repository in Firstmate; preserve its Git history, planning pack and brand assets when P001 scaffolds next-forge.
2. Inspect the installed Firstmate revision and run its normal bootstrap/project-registration procedure. The researched revision is `fa93097162d16f70a070044b8ccece037a38e3e6` (17 September 2026). Re-check relevant command help after updates. Firstmate's own tools include more than git/tmux/Codex; follow its current prerequisite audit instead of treating this as a standalone npm package. [Configuration and toolchain](https://github.com/kunchenguid/firstmate/blob/fa93097162d16f70a070044b8ccece037a38e3e6/docs/configuration.md#toolchain).
3. Set the requested profile, confirm independent worktrees, and preserve the existing security/trust policy. The upstream launcher has its own autonomous execution posture; review it during setup. No permission or sandbox settings are changed by the example Codex configuration in this pack.
4. Use the supplied [captain prompt](captain-prompt.md) as task intake. Do not copy a guessed registry/state schema into Firstmate's private operational home.
5. Dispatch P001, accept its result, then P002 and P003. P004/P005/P006 may then run together. P007 integrates dependencies/exports once; many lanes become ready after it merges.

## Turn a task card into a native Firstmate brief

`tasks.json` is **our planning manifest, not a native Firstmate import format**. Task IDs `P001`…`P095` map to Firstmate IDs `pros-001`…`pros-095`. Firstmate should add the items using its configured backlog backend and current `fm-tasks-axi.sh` help. Preserve dependencies in this manifest even if the selected backlog adapter cannot encode all of them. Never claim importing JSON alone creates worktrees or enforces ownership.

For each ready ship, generate Firstmate's current brief scaffold, preserve its setup/status/completion sections, and fill its Task subsections with the actual user intent and this card's implementation spec. The card is **not** a replacement for the entire native brief. Do not falsely label our proposed architecture details as verbatim captain statements. Resolve the relevant specification into a self-contained brief. [Brief generation](https://github.com/kunchenguid/firstmate/blob/fa93097162d16f70a070044b8ccece037a38e3e6/bin/fm-brief.sh).

The researched command shapes are:

```sh
# Run in the configured Firstmate home; supply the real registered project.
bin/fm-brief.sh pros-009 PROJECT_NAME --mode direct-PR
# Firstmate fills the scaffold and verifies that P009 is ready, then:
bin/fm-spawn.sh pros-009 /absolute/path/to/project \
  --mode direct-PR --yolo off \
  --harness codex --model gpt-5.6-luna --effort max
```

These are examples, not commands to run with literal placeholder paths. There is no verified `--fast` flag on `fm-spawn.sh`; use Codex configuration. Scout P089/P094 use the tool's `--scout` path, not ship `--mode`/`--yolo` flags. The delivery mode in the native brief must match the spawn flag. [Spawn contract](https://github.com/kunchenguid/firstmate/blob/fa93097162d16f70a070044b8ccece037a38e3e6/bin/fm-spawn.sh).

Firstmate remains responsible for lifecycle supervision, status routing and native completion. A ship is not an available dependency until its reviewed commit is merged to the integration base. A scout needs an accepted evidence report. Do not write fabricated status files to unblock the graph.

## Readiness and ownership checker

[check-plan.py](check-plan.py) uses only Python's standard library. It checks IDs, dependency cycles, missing briefs and unordered overlapping write scopes. It can report ready work and select a conflict-free suggested batch. It never launches agents, edits Firstmate state, checks out code, contacts GitHub or marks work done.

```sh
python3 planning/prospecting-system/crew/check-plan.py
python3 planning/prospecting-system/crew/check-plan.py --ready
python3 planning/prospecting-system/crew/check-plan.py --state /path/to/crew-state.json --ready --batch 3
```

Copy [state.example.json](state.example.json) to an operator-owned path before recording progress. Keep exactly one coordinator as its writer. A ship completion receipt contains `commit` (merged SHA), `review` and `checks`; a scout receipt contains `report` and `review`. `passed_gates` maps a named gate to its evidence/authorization reference; `active` lists task IDs with claimed paths. The checker validates receipt shape but cannot prove that a commit was merged, checks ran or authorization exists. Firstmate/the integrator must verify those facts against the repository and real evidence.

```json
{
  "completed": {
    "P001": {
      "commit": "replace with the actual 40- or 64-character merged Git SHA",
      "review": "link or path to accepted review",
      "checks": "link or path to current-commit check results"
    }
  },
  "active": [],
  "passed_gates": {}
}
```

## Review capacity and external gates

Prioritize the database/reply-stop/delivery path, and start P089 as soon as its adapters and controlled credentials are ready. Do not wait for marketing to discover that an essential provider operation is unavailable. P092 needs bounded evaluation access; P094 needs an explicitly enrolled staging cohort. Ordinary code tasks continue with fixtures while these gates are pending.

One integration owner handles root configuration, dependency manifests, lockfile, shared exports and migration lineage. This is a **crewmate role with its own small tasks**, not permission for Firstmate's supervisor to edit the application directly. Review happens in a separate context; fixes return to the implementer. The [review checklist](review-checklist.md) defines the merge boundary.

Labor remains €0 in the product budget. Codex credits/API usage and the machine hosting the development fleet are separate development costs. No new estimate is invented from a task count: record actual usage during the first few tasks before predicting the whole build.
