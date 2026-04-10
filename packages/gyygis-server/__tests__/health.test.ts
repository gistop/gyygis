import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

test("GET /api/health", async () => {
  const app = createApp();
  const res = await request(app).get("/api/health").expect(200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.service, "gyygis-server");
});
