import { describe, expect, it } from "vitest";
import { parseStripeEvent } from "@/lib/stripe.server";

const valid = {
  id: "evt_1",
  type: "checkout.session.completed",
  livemode: false,
  data: { object: { id: "cs_1" } },
};

describe("parseStripeEvent", () => {
  it("accepts a well-formed event", () => {
    expect(parseStripeEvent(JSON.stringify(valid)).id).toBe("evt_1");
  });

  it("rejects malformed JSON", () => {
    expect(() => parseStripeEvent("{not json")).toThrow("Invalid webhook payload");
  });

  it("rejects events missing required fields", () => {
    for (const bad of [
      { ...valid, id: "" },
      { ...valid, type: undefined },
      { ...valid, livemode: "false" },
      { ...valid, data: {} },
      { ...valid, data: { object: null } },
      null,
      [],
    ]) {
      expect(() => parseStripeEvent(JSON.stringify(bad))).toThrow("Invalid webhook payload");
    }
  });
});
