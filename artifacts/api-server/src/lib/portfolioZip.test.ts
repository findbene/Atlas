/**
 * Phase 60H — deterministic dependency-free ZIP packaging.
 *
 * Pins: a valid ZIP container (round-trips via an independent reader), files
 * nested under a safe root folder, byte-for-byte determinism, slug
 * sanitisation, safe entry names (no traversal/OS separators), and that the
 * archive carries exactly the input contents (no added/leaked data).
 */
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { generatePortfolioZip, safeRootFolder } from "./portfolioZip";

/** Minimal, independent ZIP reader: walks the central directory, inflates each
 *  entry, returns name → utf8 content. Proves the writer emits a real archive. */
function readZip(buf: Buffer): Record<string, string> {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocd).toBeGreaterThanOrEqual(0);
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(off)).toBe(0x02014b50); // central dir signature
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    // Local header → data.
    expect(buf.readUInt32LE(localOff)).toBe(0x04034b50);
    const method = buf.readUInt16LE(localOff + 8);
    const compSize = buf.readUInt32LE(localOff + 18);
    const lhNameLen = buf.readUInt16LE(localOff + 26);
    const lhExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 8 ? zlib.inflateRawSync(comp) : comp;
    out[name] = data.toString("utf8");
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const FILES = {
  "README.md": "# Project\n\nHello.",
  "atlas-portfolio.json": '{\n  "schema": "atlas-portfolio/v1"\n}\n',
  "evidence/submission-summary.md": "# Submission evidence\n\nLearner-submitted evidence.",
};

describe("Phase 60H — generatePortfolioZip", () => {
  it("emits a valid ZIP whose entries round-trip under a safe root folder", () => {
    const buf = generatePortfolioZip("my-project-slug", FILES);
    // Local file header magic at the start.
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const read = readZip(buf);
    expect(Object.keys(read).sort()).toEqual([
      "my-project-slug/README.md",
      "my-project-slug/atlas-portfolio.json",
      "my-project-slug/evidence/submission-summary.md",
    ]);
    expect(read["my-project-slug/README.md"]).toBe(FILES["README.md"]);
    expect(read["my-project-slug/atlas-portfolio.json"]).toBe(
      FILES["atlas-portfolio.json"],
    );
    // atlas-portfolio.json remains valid JSON after the round-trip.
    expect(() => JSON.parse(read["my-project-slug/atlas-portfolio.json"]!)).not.toThrow();
  });

  it("is byte-for-byte deterministic for the same input", () => {
    const a = generatePortfolioZip("slug", FILES);
    const b = generatePortfolioZip("slug", FILES);
    expect(a.equals(b)).toBe(true);
  });

  it("nests every entry under the root and uses only safe forward-slash names", () => {
    const read = readZip(generatePortfolioZip("slug", FILES));
    for (const name of Object.keys(read)) {
      expect(name.startsWith("slug/")).toBe(true);
      expect(name.includes("\\")).toBe(false);
      expect(name.includes("..")).toBe(false);
      expect(name.startsWith("/")).toBe(false);
      expect(name).toMatch(/^[A-Za-z0-9._/-]+$/);
    }
  });

  it("sanitises an unsafe slug into a safe single-segment root folder", () => {
    expect(safeRootFolder("../../etc/passwd")).not.toContain("..");
    expect(safeRootFolder("../../etc/passwd")).not.toContain("/");
    expect(safeRootFolder("a b/c\\d")).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(safeRootFolder("")).toBe("portfolio");
    expect(safeRootFolder("...")).toBe("portfolio");
    // A traversal slug cannot produce a traversal entry name.
    const read = readZip(generatePortfolioZip("../../evil", { "x.md": "y" }));
    for (const name of Object.keys(read)) {
      expect(name.includes("..")).toBe(false);
      expect(name.startsWith("/")).toBe(false);
    }
  });

  it("carries exactly the input contents — no added or leaked data", () => {
    const read = readZip(generatePortfolioZip("slug", FILES));
    expect(Object.keys(read)).toHaveLength(Object.keys(FILES).length);
    const concat = Object.values(read).join("\n");
    for (const token of [
      "validationConfig",
      "expectedRows",
      "expectedRowsHash",
      "serverGradeFlag",
      '"spec"',
    ]) {
      expect(concat).not.toContain(token);
    }
  });
});
