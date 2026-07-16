import { describe, expect, it } from "vitest";
import { getConnectAccountStatus } from "@/lib/stripe/connect";

describe("Accounts v2 connected-account status", () => {
  it("marks the coach ready only when the merchant card capability is active", () => {
    const status = getConnectAccountStatus({
      id: "acct_v2_ready",
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { status: "active" },
            stripe_balance: { payouts: { status: "active" } },
          },
        },
      },
      requirements: { entries: [], summary: { minimum_deadline: null } },
    });

    expect(status).toMatchObject({
      status: "ready",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });
  });

  it("asks the coach to continue onboarding when Stripe has outstanding requirements", () => {
    const status = getConnectAccountStatus({
      id: "acct_v2_restricted",
      configuration: {
        merchant: { capabilities: { card_payments: { status: "restricted" } } },
      },
      requirements: {
        entries: [{ description: "identity.verification", minimum_deadline: { status: "currently_due" } }],
      },
    });

    expect(status).toMatchObject({
      status: "restricted",
      chargesEnabled: false,
      detailsSubmitted: false,
      requirementsDue: ["identity.verification"],
    });
  });

  it("does not use legacy charges_enabled or payouts_enabled fields", () => {
    const status = getConnectAccountStatus({
      id: "acct_v2_pending",
      configuration: {
        merchant: { capabilities: { card_payments: { status: "pending" } } },
      },
      requirements: { entries: [], summary: { minimum_deadline: null } },
    });

    expect(status.status).toBe("pending");
    expect(status.chargesEnabled).toBe(false);
  });
});
