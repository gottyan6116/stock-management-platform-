import { describe, expect, it } from "vitest";
import { PRODUCT } from "@/config/product";

describe("PRODUCT", () => {
  it("uses the approved name and home route", () => {
    expect(PRODUCT.name).toBe("My portfolio DB");
    expect(PRODUCT.defaultAuthenticatedRoute).toBe("/home");
  });
});
