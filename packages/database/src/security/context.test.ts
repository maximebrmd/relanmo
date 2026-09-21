import { parseTenantId, parseUserId } from "@relanmo/domain/contracts";
import type {
  PersistenceWorkerId,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import { describe, expect, it } from "vitest";

import {
  applyTrustedSqlContext,
  mintAuthPreSessionAccess,
  mintTrustedTenantAccess,
  UntrustedSqlAccessError,
} from "./index";
import type { TrustedSqlAccess, TrustedSqlSession } from "./index";

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

describe("trusted SQL access minting", () => {
  it("rejects an enumerable tenant payload a browser could round-trip", async () => {
    const minted = mintTrustedTenantAccess(memberScope("tenant-a"));
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

  it("mints tenant access for a member and a worker principal", () => {
    expect(mintTrustedTenantAccess(memberScope("tenant-a")).kind).toBe(
      "tenant"
    );
    expect(mintTrustedTenantAccess(workerScope("tenant-b")).kind).toBe(
      "tenant"
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
