import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  clearOfflineTileRegionCacheForTests,
  isRegionPackDirName,
  resolveOfflineTilePath,
  resolveTiandituOfflineRoot
} from "../src/services/offlineTileResolve.js";

test("isRegionPackDirName", () => {
  assert.equal(isRegionPackDirName("shanghai_v2024"), true);
  assert.equal(isRegionPackDirName("7"), false);
  assert.equal(isRegionPackDirName("bj"), true);
});

test("resolveTiandituOfflineRoot prefers nested tdt directory", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "gyygis-offline-"));
  try {
    await fs.mkdir(path.join(base, "tdt"), { recursive: true });
    const root = await resolveTiandituOfflineRoot(base);
    assert.equal(root, path.join(base, "tdt"));
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});

test("resolveOfflineTilePath finds regional pack and flat layouts", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "gyygis-offline-"));
  clearOfflineTileRegionCacheForTests();
  try {
    const tdt = path.join(base, "tdt");
    await fs.mkdir(path.join(tdt, "pack_a", "10", "843"), { recursive: true });
    await fs.writeFile(path.join(tdt, "pack_a", "10", "843", "388.png"), "a");

    await fs.mkdir(path.join(tdt, "11", "1686"), { recursive: true });
    await fs.writeFile(path.join(tdt, "11", "1686", "776.png"), "b");

    const fromRegional = await resolveOfflineTilePath(base, "tdt", "10", "843", "388", "png");
    assert.equal(fromRegional, path.join(tdt, "pack_a", "10", "843", "388.png"));

    const fromFlat = await resolveOfflineTilePath(base, "tdt", "11", "1686", "776", "png");
    assert.equal(fromFlat, path.join(tdt, "11", "1686", "776.png"));

    const missing = await resolveOfflineTilePath(base, "tdt", "99", "1", "1", "png");
    assert.equal(missing, null);
  } finally {
    clearOfflineTileRegionCacheForTests();
    await fs.rm(base, { recursive: true, force: true });
  }
});
