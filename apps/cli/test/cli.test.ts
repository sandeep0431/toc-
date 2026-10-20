import { describe, it, expect } from "vitest";
import { runCli } from "../src/index";

describe("Tripwire CLI End-to-End", () => {
  it("scan returns code 1 when alerts are detected and prints state path with --explain", async () => {
    const exitCode = await runCli(["scan", "data/auth.sample.log", "--explain"]);
    expect(exitCode).toBe(1);
  });

  it("scan returns code 1 for access log attacks", async () => {
    const exitCode = await runCli(["scan", "data/access.sample.log"]);
    expect(exitCode).toBe(1);
  });

  it("compile --stats returns code 0 and calculates state counts", async () => {
    const exitCode = await runCli(["compile", "(a|b)*abb", "--stats"]);
    expect(exitCode).toBe(0);
  });

  it("rules lint returns code 0 for valid rules file", async () => {
    const exitCode = await runCli(["rules", "lint", "data/rules.json"]);
    expect(exitCode).toBe(0);
  });

  it("returns exit code 2 for nonexistent file", async () => {
    const exitCode = await runCli(["scan", "data/nonexistent.log"]);
    expect(exitCode).toBe(2);
  });
});
