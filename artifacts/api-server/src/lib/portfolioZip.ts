/**
 * Phase 60H — deterministic, dependency-free ZIP packaging for the Phase-60G
 * GitHub-ready repository export.
 *
 * Produces a real ZIP archive (DEFLATE, method 8) from the repository `files`
 * map, nested under a single safe root folder named after the project slug:
 *
 *   <project-slug>/README.md
 *   <project-slug>/atlas-portfolio.json
 *   <project-slug>/evidence/submission-summary.md
 *   ...
 *
 * Built by hand with Node's `zlib` (no new dependency). Deterministic: a FIXED
 * DOS timestamp is written for every entry, entries are emitted in sorted order,
 * and `deflateRawSync` output is stable for the same input — so the same
 * repository bundle yields a byte-identical archive (verifiable by tests).
 *
 * Path safety: the root folder is sanitised to `[A-Za-z0-9._-]` (no slashes,
 * no traversal), and every inner key is re-validated (no absolute path, no
 * backslash, no `..`/`.`/empty segment) before it is written — ZIP entries use
 * forward slashes only, so no OS-specific separator can leak in.
 */
import zlib from "node:zlib";

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
// Fixed DOS date/time for determinism: 1980-01-01 00:00:00 (the ZIP epoch).
const DOS_DATE = 0x0021; // (1980-1980)<<9 | 1<<5 | 1
const DOS_TIME = 0x0000;
const VERSION_NEEDED = 20; // 2.0 — DEFLATE
const FLAG_UTF8 = 0x0800; // general-purpose bit 11: filename is UTF-8
const METHOD_DEFLATE = 8;

// CRC-32 (IEEE 802.3), table-driven — portable across Node versions.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Sanitize the slug into a safe single-segment root folder name. */
export function safeRootFolder(slug: string): string {
  const cleaned = String(slug)
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/[.-]+$/, "");
  return cleaned.length > 0 ? cleaned : "portfolio";
}

/** Reject any ZIP entry name that is absolute, escapes the root, uses a
 *  backslash, or has a `.`/`..`/empty path segment. Entry names always use
 *  forward slashes. Throws on violation (the route fails closed). */
function assertSafeEntryName(name: string): void {
  const bad =
    name.length === 0 ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    !/^[A-Za-z0-9._/-]+$/.test(name) ||
    name.split("/").some((seg) => seg === "" || seg === "." || seg === "..");
  if (bad) throw new Error(`unsafe zip entry name: ${JSON.stringify(name)}`);
}

type ZipEntry = {
  name: string;
  crc: number;
  compressed: Buffer;
  uncompressedSize: number;
  offset: number;
};

/**
 * Build a deterministic ZIP archive from the repository `files` map. Every file
 * is nested under `<safeRoot>/`. Pure given (slug, files): same input → byte-
 * identical Buffer.
 */
export function generatePortfolioZip(
  slug: string,
  files: Record<string, string>,
): Buffer {
  const root = safeRootFolder(slug);
  const chunks: Buffer[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  // Sorted for determinism.
  for (const key of Object.keys(files).sort()) {
    const name = `${root}/${key}`;
    assertSafeEntryName(name);
    const nameBuf = Buffer.from(name, "utf8");
    const content = Buffer.from(files[key]!, "utf8");
    const crc = crc32(content);
    const compressed = zlib.deflateRawSync(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    local.writeUInt16LE(VERSION_NEEDED, 4);
    local.writeUInt16LE(FLAG_UTF8, 6);
    local.writeUInt16LE(METHOD_DEFLATE, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra field length

    entries.push({ name, crc, compressed, uncompressedSize: content.length, offset });
    chunks.push(local, nameBuf, compressed);
    offset += local.length + nameBuf.length + compressed.length;
  }

  // Central directory.
  const centralStart = offset;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_DIR_SIG, 0);
    central.writeUInt16LE(VERSION_NEEDED, 4); // version made by
    central.writeUInt16LE(VERSION_NEEDED, 6); // version needed
    central.writeUInt16LE(FLAG_UTF8, 8);
    central.writeUInt16LE(METHOD_DEFLATE, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(e.crc, 16);
    central.writeUInt32LE(e.compressed.length, 20);
    central.writeUInt32LE(e.uncompressedSize, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(e.offset, 42); // local header offset
    chunks.push(central, nameBuf);
    offset += central.length + nameBuf.length;
  }
  const centralSize = offset - centralStart;

  // End of central directory record.
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4); // this disk
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(entries.length, 8); // entries this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20); // comment length
  chunks.push(eocd);

  return Buffer.concat(chunks);
}
