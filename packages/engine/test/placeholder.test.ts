import { describe, it, expect } from "vitest";
import { VERSION } from "../src/index";

describe("Phase 0 placeholder test", () => {
  it("engine exports VERSION", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
