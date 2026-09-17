# Firstmate — parallel development coordination

**Status: requested for coding delegation.** Firstmate coordinates the development crew; it is not a production component of the prospecting SaaS.

Use the [95-task execution plan](../execution-plan.md), [operating guide](../crew/README.md), [task index](../crew/task-index.md) and [captain prompt](../crew/captain-prompt.md). Each task has dependencies, owned paths and acceptance evidence. Shared contracts enable concurrent adapter, domain, schema, UI and documentation work; integration and review remain explicit.

## Chosen profile and operating recommendation

- Codex CLI crewmates: `gpt-5.6-luna`, reasoning `max`, Fast mode.
- Start with three implementation crewmates and one independent reviewer.
- One task/worktree/PR; one merge at a time; retain captain merge authority.
- Use a supported Firstmate backend such as tmux. Its `codex-app` backend is not available at the researched revision.
- Preserve any existing stricter Firstmate project delivery policy. The planning default is `direct-PR` with CI/review and `yolo=off`.

The operating guide contains source links, the exact researched revision, valid example configuration and model checks. Fast is a Codex service-tier setting, separate from Firstmate's model/effort profile. The supplied JSON task manifest is a project planning format, not a promised native Firstmate import API.

## Cost and setup boundary

No Firstmate software, services or agents were installed or launched by this pack. Follow its current prerequisite audit when setting up the selected repository. Development-agent credits/API usage and the machine running the crew are separate from the SaaS hosting budget; record real usage on the first few tasks before extrapolating.

[Upstream repository](https://github.com/kunchenguid/firstmate), [configuration reference](https://github.com/kunchenguid/firstmate/blob/fa93097162d16f70a070044b8ccece037a38e3e6/docs/configuration.md).
