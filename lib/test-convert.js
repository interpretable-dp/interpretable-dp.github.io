"use strict";

var MathUtils = require("./math-utils");
// privacy-lib.js expects MathUtils on `this` when loaded via require,
// but its IIFE also checks for require("./math-utils"), so it works directly.
var PrivacyLib = require("./privacy-lib");

var passed = 0;
var failed = 0;

function approxEqual(a, b, tol) {
  tol = tol || 1e-4;
  if (a === b) return true;
  if (!isFinite(a) || !isFinite(b)) return a === b;
  return Math.abs(a - b) <= tol * (1 + Math.abs(b));
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL: " + msg);
    failed++;
  } else {
    passed++;
  }
}

function assertApprox(actual, expected, msg, tol) {
  if (!approxEqual(actual, expected, tol)) {
    console.error("FAIL: " + msg + " — got " + actual + ", expected " + expected);
    failed++;
  } else {
    passed++;
  }
}

// ── GDP ──

assert(approxEqual(PrivacyLib.getBetaFromGdp(0, 0.5), 0.5),
  "gdp beta at mu=0 should be 0.5 for alpha=0.5");

assert(PrivacyLib.getBetaFromGdp(1, 0.05) > 0,
  "gdp beta at mu=1 alpha=0.05 should be positive");

assert(PrivacyLib.getBetaFromGdp(1, 0.05) < 1,
  "gdp beta at mu=1 alpha=0.05 should be less than 1");

// GDP advantage at mu=0 should be 0
assertApprox(PrivacyLib.getAdvantageFromGdp(0), 0, "gdp advantage at mu=0");

// GDP advantage at large mu should approach 1
assert(PrivacyLib.getAdvantageFromGdp(10) > 0.99,
  "gdp advantage at mu=10 should be near 1");

// ── ADP ──

assertApprox(PrivacyLib.getBetaFromAdp(0, 0, 0.3), 0.7,
  "adp beta at eps=0 delta=0 alpha=0.3 should be 0.7");

assertApprox(PrivacyLib.getBetaFromAdp(1, 0.1, 0.05), 1 - 0.1 - Math.exp(1) * 0.05,
  "adp beta form1 check", 1e-6);

assertApprox(PrivacyLib.getAdvantageFromAdp(0, 0), 0,
  "adp advantage at eps=0 delta=0");

// ── GDP <-> ADP ──

// gdp->adp: mu=1 delta=1e-3
var gdpToAdp = PrivacyLib.convert("gdp", { mu: 1 }, "adp", { delta: 1e-3 });
assert(gdpToAdp.value > 0, "gdp->adp should give positive epsilon");
assert(gdpToAdp.value < 10, "gdp->adp epsilon should be reasonable");
assert(!gdpToAdp.boundaryHit, "gdp->adp should not hit boundary for mu=1 delta=1e-3");

// gdp->adp: mu=1 delta=1e-15 is within numerical range (eps ~7.8)
var gdpToAdpSmall = PrivacyLib.convert("gdp", { mu: 1 }, "adp", { delta: 1e-15 });
assert(gdpToAdpSmall.value > 7 && gdpToAdpSmall.value < 9,
  "gdp->adp with delta=1e-15 should give eps around 7-9");
assert(!gdpToAdpSmall.boundaryHit,
  "gdp->adp with delta=1e-15 should not hit boundary");

// gdp->adp boundary: mu=1 delta=1e-100 causes underflow
var gdpToAdpBound = PrivacyLib.convert("gdp", { mu: 1 }, "adp", { delta: 1e-100 });
assert(gdpToAdpBound.boundaryHit === "upper",
  "gdp->adp with delta=1e-100 should hit upper boundary");

// gdp->adp with delta=0 should be Infinity (GDP never satisfies pure DP)
var gdpToAdpPure = PrivacyLib.convert("gdp", { mu: 1 }, "adp", { delta: 0 });
assert(gdpToAdpPure.value === Infinity,
  "gdp->adp with delta=0 should be Infinity");

// ── GDP <-> zCDP ──

assertApprox(PrivacyLib.convert("gdp", { mu: 2 }, "zcdp", {}).value, 2,
  "gdp->zcdp: mu=2 -> rho=2");

// ── GDP <-> TVP ──

assertApprox(PrivacyLib.convert("gdp", { mu: 0 }, "tvp", {}).value, 0,
  "gdp->tvp at mu=0 should be 0");

// ── GDP <-> f-DP ──

var gdpToFdp = PrivacyLib.convert("gdp", { mu: 1 }, "fdp", { alpha: 0.05 });
assertApprox(gdpToFdp.value, PrivacyLib.getBetaFromGdp(1, 0.05),
  "gdp->fdp should match direct getBetaFromGdp");

// ── f-DP -> GDP (round-trip) ──

var beta_at_05 = PrivacyLib.getBetaFromGdp(1, 0.05);
var fdpToGdp = PrivacyLib.convert("fdp", { alpha: 0.05, beta: beta_at_05 }, "gdp", {});
assertApprox(fdpToGdp.value, 1.0, "fdp->gdp round-trip should recover mu=1", 0.01);

// ── f-DP -> GDP/zCDP degenerate inputs ──

// alpha + beta >= 1 → value = 0 (trivial, no privacy needed)
assertApprox(PrivacyLib.convert("fdp", { alpha: 0.5, beta: 0.5 }, "gdp", {}).value, 0,
  "fdp->gdp: alpha+beta=1 -> mu=0");
assertApprox(PrivacyLib.convert("fdp", { alpha: 0.6, beta: 0.5 }, "gdp", {}).value, 0,
  "fdp->gdp: alpha+beta>1 -> mu=0");
assertApprox(PrivacyLib.convert("fdp", { alpha: 0.5, beta: 0.5 }, "zcdp", {}).value, 0,
  "fdp->zcdp: alpha+beta=1 -> rho=0");

// alpha=0 or beta=0 → Infinity
assert(PrivacyLib.convert("fdp", { alpha: 0, beta: 0.5 }, "gdp", {}).value === Infinity,
  "fdp->gdp: alpha=0 -> Infinity");
assert(PrivacyLib.convert("fdp", { alpha: 0.5, beta: 0 }, "gdp", {}).value === Infinity,
  "fdp->gdp: beta=0 -> Infinity");
assert(PrivacyLib.convert("fdp", { alpha: 0, beta: 0.5 }, "zcdp", {}).value === Infinity,
  "fdp->zcdp: alpha=0 -> Infinity");
assert(PrivacyLib.convert("fdp", { alpha: 0.5, beta: 0 }, "zcdp", {}).value === Infinity,
  "fdp->zcdp: beta=0 -> Infinity");

// ── f-DP -> zCDP ──

var fdpToZcdp = PrivacyLib.convert("fdp", { alpha: 0.05, beta: beta_at_05 }, "zcdp", {});
assert(fdpToZcdp.value > 0, "fdp->zcdp should give positive rho");
assert(!fdpToZcdp.boundaryHit, "fdp->zcdp should not hit boundary for reasonable inputs");

// ── f-DP -> TVP ──

assertApprox(
  PrivacyLib.convert("fdp", { alpha: 0.3, beta: 0.4 }, "tvp", {}).value,
  0.3, "fdp->tvp: 1 - 0.3 - 0.4 = 0.3");

// ── f-DP -> ADP ──

var fdpToAdp = PrivacyLib.convert("fdp", { alpha: 0.05, beta: 0.2 }, "adp", { delta: 0.01 });
assert(fdpToAdp.value >= 0, "fdp->adp should give non-negative epsilon");

// ── ADP -> GDP ──

// Pure DP (delta=0) should give finite mu
var adpToGdp = PrivacyLib.convert("adp", { epsilon: 1, delta: 0 }, "gdp", {});
assert(isFinite(adpToGdp.value), "adp->gdp with delta=0 should be finite");
assertApprox(adpToGdp.value, PrivacyLib.getMuFromEpsilon(1),
  "adp->gdp should match getMuFromEpsilon");

// Approximate DP (delta>0) can't convert to GDP
var adpToGdpApprox = PrivacyLib.convert("adp", { epsilon: 1, delta: 0.1 }, "gdp", {});
assert(adpToGdpApprox.value === Infinity,
  "adp->gdp with delta>0 should be Infinity");

// ── ADP -> zCDP ──

var adpToZcdp = PrivacyLib.convert("adp", { epsilon: 1, delta: 0 }, "zcdp", {});
assertApprox(adpToZcdp.value, 0.5, "adp->zcdp: eps=1 delta=0 -> rho=0.5");

var adpToZcdpApprox = PrivacyLib.convert("adp", { epsilon: 1, delta: 0.1 }, "zcdp", {});
assert(adpToZcdpApprox.value === Infinity,
  "adp->zcdp with delta>0 should be Infinity");

// ── ADP -> TVP ──

assertApprox(PrivacyLib.convert("adp", { epsilon: 0, delta: 0 }, "tvp", {}).value, 0,
  "adp->tvp at eps=0 delta=0");

// ── ADP -> f-DP ──

var adpToFdp = PrivacyLib.convert("adp", { epsilon: 1, delta: 0.1 }, "fdp", { alpha: 0.05 });
assertApprox(adpToFdp.value, PrivacyLib.getBetaFromAdp(1, 0.1, 0.05),
  "adp->fdp should match direct getBetaFromAdp");

// ── TVP conversions ──

assertApprox(PrivacyLib.convert("tvp", { eta: 0 }, "gdp", {}).value, 0,
  "tvp->gdp at eta=0");
assert(PrivacyLib.convert("tvp", { eta: 0.5 }, "gdp", {}).value === Infinity,
  "tvp->gdp at eta>0 should be Infinity");

assertApprox(PrivacyLib.convert("tvp", { eta: 0 }, "zcdp", {}).value, 0,
  "tvp->zcdp at eta=0");

assertApprox(PrivacyLib.convert("tvp", { eta: 0.3 }, "fdp", { alpha: 0.2 }).value, 0.5,
  "tvp->fdp: max(0, 1 - 0.2 - 0.3) = 0.5");

assert(PrivacyLib.convert("tvp", { eta: 0.5 }, "adp", { delta: 0.1 }).value === Infinity,
  "tvp->adp with delta < eta should be Infinity");
assertApprox(PrivacyLib.convert("tvp", { eta: 0.5 }, "adp", { delta: 0.5 }).value, 0,
  "tvp->adp with delta >= eta should be 0");

// ── zCDP conversions (slow — uses numerical optimization) ──

// zcdp->gdp with rho=0
assertApprox(PrivacyLib.convert("zcdp", { rho: 0 }, "gdp", {}).value, 0,
  "zcdp->gdp at rho=0");

// zcdp->gdp with rho=0.5 — zCDP is a relaxation of GDP, so round-tripping
// GDP(mu=1) -> zCDP(rho=0.5) -> GDP gives mu > 1 (looser guarantee).
var zcdpToGdp = PrivacyLib.convert("zcdp", { rho: 0.5 }, "gdp", {});
assert(zcdpToGdp.value >= 1.0, "zcdp->gdp: rho=0.5 -> mu >= 1 (relaxation)");
assert(zcdpToGdp.value < 2.0, "zcdp->gdp: rho=0.5 -> mu < 2 (reasonable)");

// zcdp->tvp with rho=0
assertApprox(PrivacyLib.convert("zcdp", { rho: 0 }, "tvp", {}).value, 0,
  "zcdp->tvp at rho=0");

// zcdp->fdp with rho=0
assertApprox(PrivacyLib.convert("zcdp", { rho: 0 }, "fdp", { alpha: 0.3 }).value, 0.7,
  "zcdp->fdp at rho=0 alpha=0.3");

// zcdp->adp with rho=0
assertApprox(PrivacyLib.convert("zcdp", { rho: 0 }, "adp", { delta: 0.1 }).value, 0,
  "zcdp->adp at rho=0");

// zcdp->adp with rho=0.5
var zcdpToAdp = PrivacyLib.convert("zcdp", { rho: 0.5 }, "adp", { delta: 1e-3 });
assert(zcdpToAdp.value > 0, "zcdp->adp should give positive epsilon");

// ── Unknown conversion ──

var threw = false;
try { PrivacyLib.convert("gdp", {}, "gdp", {}); } catch (e) { threw = true; }
assert(threw, "gdp->gdp should throw (unknown conversion)");

// ── Summary ──

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
