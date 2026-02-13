(function () {
  "use strict";

  var passed = 0, failed = 0, total = 0;
  var resultsEl = document.getElementById("results");

  function log(msg, ok) {
    var div = document.createElement("div");
    div.textContent = (ok ? "PASS" : "FAIL") + "  " + msg;
    div.style.color = ok ? "#2a2" : "#c22";
    div.style.fontFamily = "monospace";
    div.style.margin = "2px 0";
    resultsEl.appendChild(div);
  }

  function assertClose(actual, expected, tol, name) {
    total++;
    var diff = Math.abs(actual - expected);
    var ok = diff <= tol;
    if (ok) {
      passed++;
      log(name + ": " + actual.toFixed(6) + " ≈ " + expected.toFixed(6) + " (tol=" + tol + ")", true);
    } else {
      failed++;
      log(name + ": got " + actual + ", expected " + expected + ", diff=" + diff + " (tol=" + tol + ")", false);
    }
  }

  function assertEqual(actual, expected, name) {
    total++;
    var ok = actual === expected;
    if (ok) {
      passed++;
      log(name + ": " + actual + " === " + expected, true);
    } else {
      failed++;
      log(name + ": got " + actual + ", expected " + expected, false);
    }
  }

  // Wait for scripts to load
  window.addEventListener("load", function () {
    var M = window.MathUtils;
    var P = window.PrivacyLib;

    // --- MathUtils tests ---
    assertClose(M.normalCdf(0), 0.5, 1e-7, "normalCdf(0)");
    assertClose(M.normalCdf(1), 0.8413447, 1e-6, "normalCdf(1)");
    assertClose(M.normalCdf(-1), 0.1586553, 1e-6, "normalCdf(-1)");

    assertClose(M.normalPpf(0.5), 0, 1e-8, "normalPpf(0.5)");
    assertClose(M.normalPpf(0.975), 1.959964, 1e-5, "normalPpf(0.975)");
    assertClose(M.normalPpf(0.01), -2.326348, 1e-5, "normalPpf(0.01)");

    assertClose(M.logaddexp(0, 0), Math.log(2), 1e-10, "logaddexp(0,0)");
    assertClose(M.logaddexp(-100, -100), -100 + Math.log(2), 1e-10, "logaddexp(-100,-100)");

    // --- GDP tests (Python ground truth) ---
    assertClose(P.getBetaFromGdp(1.0, 0.01), 0.907637751926306, 1e-5,
      "getBetaFromGdp(1.0, 0.01)");

    assertClose(P.getAdvantageFromGdp(1.0), 0.38292492254802624, 1e-5,
      "getAdvantageFromGdp(1.0)");

    // --- ADP tests ---
    assertClose(P.getBetaFromAdp(1.0, 0.001, 0.8), 0.07320800879311701, 1e-5,
      "getBetaFromAdp(1.0, 0.001, 0.8)");

    assertClose(P.getAdvantageFromAdp(0, 0.001), 0.001, 1e-6,
      "getAdvantageFromAdp(0, 0.001)");

    assertClose(P.getEpsilonFromErrRates(0.001, 0.001, 0.8), 5.293304824724492, 1e-4,
      "getEpsilonFromErrRates(0.001, 0.001, 0.8)");

    // --- RDP tests ---
    assertClose(P.getBetaFromRdp(1.0, 0.1, 2.0), 0.507, 0.01,
      "getBetaFromRdp(1.0, 0.1, 2.0)");

    // --- zCDP tests ---
    assertClose(P.getBetaFromZcdp(0.5, 0.1), 0.517, 0.02,
      "getBetaFromZcdp(0.5, 0.1)");

    assertClose(P.getAdvantageFromZcdp(0.5), 0.470, 0.02,
      "getAdvantageFromZcdp(0.5)");

    // --- Round-trip tests ---
    // GDP(1.0) -> zCDP -> GDP round-trip (GDP→zCDP is analytical, zCDP→GDP is numerical)
    var rho = P.convert("gdp", { mu: 1.0 }, "zcdp", {}).value;
    assertClose(rho, 0.5, 1e-10, "GDP(1.0)->zCDP gives rho=0.5");
    var muFromZcdp = P.convert("zcdp", { rho: 0.5 }, "gdp", {}).value;
    assertClose(muFromZcdp, 1.0, 0.05, "zCDP(0.5)->GDP gives mu≈1.0");

    // GDP(1.0) -> TVP
    var eta = P.convert("gdp", { mu: 1.0 }, "tvp", {}).value;
    assertClose(eta, 0.383, 0.01, "GDP(1.0)->TVP gives eta≈0.383");

    // TVP(η>0) -> GDP = ∞ (GDP β(0)=1 > 1-η)
    var muBack = P.convert("tvp", { eta: eta }, "gdp", {}).value;
    assertClose(muBack, Infinity, 0, "TVP(η>0)->GDP gives ∞");

    // --- Summary ---
    var summary = document.createElement("div");
    summary.style.marginTop = "1rem";
    summary.style.fontWeight = "bold";
    summary.style.fontFamily = "monospace";
    summary.textContent = passed + "/" + total + " passed, " + failed + " failed";
    summary.style.color = failed === 0 ? "#2a2" : "#c22";
    resultsEl.appendChild(summary);
  });
})();
