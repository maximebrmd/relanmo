import { parseTenantId, parseUserId } from "@relanmo/domain/contracts";
import type {
  PersistenceWorkerId,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import { createPersistenceTransactionRunner } from "../transactions/runner";
import {
  applyTrustedSqlContext,
  mintAuthPreSessionAccess,
  mintTrustedTenantAccess,
  mintTrustedWorkerAccess,
  UntrustedSqlAccessError,
} from "./index";
import type {
  TenantSqlAccess,
  TrustedSqlAccess,
  TrustedSqlSession,
} from "./index";

function memberScope(tenant: string): TenantTransactionScope {
  return {
    principal: { kind: "MEMBER", userId: parseUserId("user-owner") },
    requestId: null,
    tenantId: parseTenantId(tenant),
  };
}

function workerScope(tenant: string): TenantTransactionScope {
  return {
    principal: {
      kind: "WORKER",
      // SAFETY: synthetic test worker id, never used outside this fixture.
      workerId: "worker-1" as PersistenceWorkerId,
    },
    requestId: "req-1",
    tenantId: parseTenantId(tenant),
  };
}

const idleSession: TrustedSqlSession = {
  query: () => Promise.resolve({}),
};

const activeMembershipSession: TrustedSqlSession = {
  query: () => Promise.resolve({ rowCount: 1 }),
};

describe("trusted SQL access minting", () => {
  it("rejects an enumerable tenant payload a browser could round-trip", async () => {
    const minted = await mintTrustedTenantAccess(
      activeMembershipSession,
      memberScope("tenant-a")
    );
    const roundTripped = {
      kind: minted.kind,
      scope: minted.scope,
    };

    await expect(
      applyTrustedSqlContext(
        idleSession,
        // SAFETY: enumerable clone of minted access, missing the runtime brand.
        roundTripped as TrustedSqlAccess
      )
    ).rejects.toThrow(UntrustedSqlAccessError);
  });

  it("rejects a forged tenant access object that was never minted", async () => {
    const forged = {
      kind: "tenant" as const,
      scope: memberScope("tenant-a"),
    };

    await expect(
      applyTrustedSqlContext(
        idleSession,
        // SAFETY: unbranded payload used only to prove the minting gate.
        forged as TrustedSqlAccess
      )
    ).rejects.toThrow(UntrustedSqlAccessError);
  });

  it("rejects unbranded access at the production transaction entry", async () => {
    const runner = createPersistenceTransactionRunner({} as NodePgDatabase);
    const forged = {
      kind: "tenant" as const,
      scope: memberScope("tenant-a"),
    };

    await expect(
      runner.run({
        // SAFETY: unbranded input exercises the runtime production boundary.
        access: forged as TenantSqlAccess,
        work: () => Promise.resolve({ ok: true as const, value: null }),
      })
    ).rejects.toThrow(UntrustedSqlAccessError);
  });

  it("requires active membership before minting member access", async () => {
    await expect(
      mintTrustedTenantAccess(idleSession, memberScope("tenant-a"))
    ).rejects.toThrow(UntrustedSqlAccessError);
    await expect(
      mintTrustedTenantAccess(activeMembershipSession, memberScope("tenant-a"))
    ).resolves.toMatchObject({ kind: "tenant" });
  });

  it("mints worker access only for a worker principal", () => {
    expect(mintTrustedWorkerAccess(workerScope("tenant-b")).kind).toBe(
      "tenant"
    );
    expect(() => mintTrustedWorkerAccess(memberScope("tenant-a"))).toThrow(
      UntrustedSqlAccessError
    );
  });

  it("mints auth pre-session access with and without a user id", () => {
    expect(mintAuthPreSessionAccess({ userId: null }).kind).toBe(
      "auth_pre_session"
    );
    expect(
      mintAuthPreSessionAccess({ userId: parseUserId("user-owner") }).kind
    ).toBe("auth_pre_session");
  });
});
