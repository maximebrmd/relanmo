/**
 * Node.js worker entrypoint. Temporal registration belongs to the workflow
 * integration task; this P001 shell intentionally performs no work.
 */
export const workerRuntime = "node" as const;

if (import.meta.main) {
  console.info("Relanmo worker shell: no workflows configured");
}
