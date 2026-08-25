import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewLimits } from "../lib/preview-limits.js";

function makeLimits(overrides = {}) {
  let time = 1_000;
  return {
    limits: createPreviewLimits({
      now: () => time,
      rateWindowMs: 60_000,
      rateMax: 3,
      dailyCap: 5,
      maxConcurrent: 2,
      ...overrides
    }),
    advance(ms) {
      time += ms;
    }
  };
}

test("limits a client to three reviews per window", () => {
  const { limits } = makeLimits();

  assert.equal(limits.check("client-a").allowed, true);
  assert.equal(limits.check("client-a").allowed, true);
  assert.equal(limits.check("client-a").allowed, true);

  const blocked = limits.check("client-a");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);
});

test("expires a client rate window", () => {
  const { limits, advance } = makeLimits();
  limits.check("client-a");
  limits.check("client-a");
  limits.check("client-a");
  advance(60_000);

  assert.equal(limits.check("client-a").allowed, true);
});

test("enforces the daily cap and releases concurrency slots", () => {
  const { limits } = makeLimits({ dailyCap: 2 });

  assert.equal(limits.check("client-a").allowed, true);
  limits.start();
  assert.equal(limits.check("client-b").allowed, true);
  limits.start();
  assert.equal(limits.check("client-c").allowed, false);

  limits.finish();
  assert.equal(limits.snapshot().concurrentReviews, 1);
  limits.resetDaily();
  assert.equal(limits.check("client-c").allowed, true);
});

test("blocks a third concurrent review", () => {
  const { limits } = makeLimits();
  limits.start();
  limits.start();

  const blocked = limits.check("client-c");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 10);
});
