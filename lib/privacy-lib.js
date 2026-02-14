(function (root) {
  "use strict";

  var M = root.MathUtils || (typeof require !== "undefined" ? require("./math-utils") : null);
  if (!M) throw new Error("MathUtils must be loaded before privacy-lib.js");

  var PrivacyLib = {};

  // ── Numerical constants ──
  var BISECT_TOL       = 1e-8;
  var BISECT_MAX_ITER  = 100;
  var GOLDEN_MAX_ITER  = 30;
  var BOUNDARY_FRAC    = 0.99;  // flag result if ≥ this fraction of search bound
  var MU_MAX           = 100;
  var EPS_MAX          = 200;
  var RHO_MIN          = 1e-5;
  var RHO_MAX          = 50;
  var ALPHA_SKIP_EPS   = 1e-9;
  var DEFAULT_ZCDP_TOL          = 1e-4;
  var DEFAULT_ZCDP_LINEAR_STEP  = 5e-4;
  var DEFAULT_RDP_BISECT_STEPS  = 100;
  var DEFAULT_RDP_TOL           = 1e-5;
  var DEFAULT_RDP_LINEAR_STEP   = 1e-3;

  // Copy opts without onProgress — use when calling getBetaFromZcdp inside
  // a loop that has its own progress tracking, to avoid inner/outer conflicts.
  function stripProgress(opts) {
    return { tol: opts.tol, linearSearchStep: opts.linearSearchStep,
      maxBisectionSteps: opts.maxBisectionSteps, maxOrder: opts.maxOrder,
      orderGridSize: opts.orderGridSize };
  }

  // Default number of α points for zCDP curves and multi-point conversions
  PrivacyLib.DEFAULT_ALPHA_RESOLUTION = 200;

  // The functions next are mostly ports from the riskcal package.
  // Ported with Claude Code, and adapted to browser conversions.

  // =========================================================================
  // GDP (Gaussian Differential Privacy)
  // =========================================================================

  PrivacyLib.getBetaFromGdp = function (mu, alpha) {
    return M.normalCdf(-M.normalPpf(alpha) - mu);
  };

  PrivacyLib.getAdvantageFromGdp = function (mu) {
    return M.normalCdf(mu / 2) - M.normalCdf(-mu / 2);
  };

  // =========================================================================
  // ADP (Approximate Differential Privacy)
  // =========================================================================

  PrivacyLib.getBetaFromAdp = function (epsilon, delta, alpha) {
    var form1 = 1 - delta - Math.exp(epsilon) * alpha;
    var form2 = Math.exp(-epsilon) * (1 - delta - alpha);
    return Math.max(form1, form2, 0);
  };

  PrivacyLib.getAdvantageFromAdp = function (epsilon, delta) {
    return (Math.exp(epsilon) + 2 * delta - 1) / (Math.exp(epsilon) + 1);
  };

  PrivacyLib.getEpsilonFromErrRates = function (delta, alpha, beta) {
    var eps1 = Math.log((1 - delta - alpha) / beta);
    var eps2 = Math.log((1 - delta - beta) / alpha);
    return Math.max(eps1, eps2, 0);
  };

  PrivacyLib.getMuFromEpsilon = function (epsilon) {
    return -2 * M.normalPpf(1 / (Math.exp(epsilon) + 1));
  };

  PrivacyLib.getGdpDeltaAtEpsilon = function (mu, epsilon) {
    if (mu <= 0) return 0;
    var a = epsilon / mu;
    return M.normalCdf(-a + mu / 2) - Math.exp(epsilon) * M.normalCdf(-a - mu / 2);
  };

  PrivacyLib.getMuFromAdp = function (epsilon, delta) {
    if (epsilon === 0 && delta === 0) return 0;
    if (delta === 0) return PrivacyLib.getMuFromEpsilon(epsilon);
    return M.bisect(function (mu) {
      return PrivacyLib.getGdpDeltaAtEpsilon(mu, epsilon) - delta;
    }, 0, MU_MAX, BISECT_TOL, BISECT_MAX_ITER);
  };

  // =========================================================================
  // RDP (Renyi Differential Privacy)
  // =========================================================================

  PrivacyLib.checkRenyiConstraints = function (epsilon, y, x, order) {
    var logx = Math.log(x);
    var log1mx = Math.log1p(-x);
    var logy = Math.log(y);
    var log1my = Math.log1p(-y);

    if (order !== 1) {
      var upper = (order - 1) * epsilon;
      var signOrder = order > 1 ? 1 : -1;
      var oneMinusOrder = 1 - order;

      var logF2 = M.logaddexp(
        order * logx + oneMinusOrder * log1my,
        order * log1mx + oneMinusOrder * logy
      );
      var constraint2 = signOrder * (upper - logF2) >= 0;

      var logF1 = M.logaddexp(
        order * log1my + oneMinusOrder * logx,
        order * logy + oneMinusOrder * log1mx
      );
      var constraint1 = signOrder * (upper - logF1) >= 0;
    } else {
      upper = epsilon;
      var f1 = x * (logx - log1my) + (1 - x) * (log1mx - logy);
      constraint1 = upper - f1 >= 0;
      var f2 = y * (logy - log1mx) + (1 - y) * (log1my - logx);
      constraint2 = upper - f2 >= 0;
    }

    return constraint1 && constraint2;
  };

  PrivacyLib.getBetaFromRdp = function (epsilon, alpha, order, opts) {
    opts = opts || {};
    var step = opts.linearSearchStep || DEFAULT_RDP_LINEAR_STEP;
    var maxSteps = opts.maxBisectionSteps || DEFAULT_RDP_BISECT_STEPS;
    var tol = opts.tol || DEFAULT_RDP_TOL;

    // Linear search from below
    var beta1 = tol;
    while (beta1 < 1 && !PrivacyLib.checkRenyiConstraints(epsilon, beta1, alpha, order)) {
      beta1 += step;
    }
    beta1 = Math.min(beta1, 1.0);

    // Linear search from above
    var beta2 = 1 - tol;
    while (beta2 > 0 && !PrivacyLib.checkRenyiConstraints(epsilon, beta2, alpha, order)) {
      beta2 -= step;
    }
    beta2 = Math.max(beta2, 0.0);

    var betaLow = Math.min(beta1, beta2);
    var betaHigh = Math.max(beta1, beta2);

    if (betaLow >= betaHigh) {
      if (PrivacyLib.checkRenyiConstraints(epsilon, betaLow, alpha, order)) return betaLow;
      if (PrivacyLib.checkRenyiConstraints(epsilon, betaHigh, alpha, order)) return betaHigh;
      return 0.0;
    }

    // Bisection to find minimum beta satisfying constraints
    for (var i = 0; i < maxSteps; i++) {
      if (Math.abs(betaHigh - betaLow) <= tol) break;
      var mid = (betaLow + betaHigh) / 2;
      if (PrivacyLib.checkRenyiConstraints(epsilon, mid, alpha, order)) {
        betaHigh = mid;
      } else {
        betaLow = mid;
      }
    }

    if (PrivacyLib.checkRenyiConstraints(epsilon, betaLow, alpha, order)) return betaLow;
    if (PrivacyLib.checkRenyiConstraints(epsilon, betaHigh, alpha, order)) return betaHigh;
    return 0.0;
  };

  // =========================================================================
  // zCDP (Zero-Concentrated Differential Privacy)
  // =========================================================================

  PrivacyLib.getBetaFromZcdp = function (rho, alpha, opts) {
    opts = opts || {};
    var tol = opts.tol || DEFAULT_ZCDP_TOL;
    var linearSearchStep = opts.linearSearchStep || DEFAULT_ZCDP_LINEAR_STEP;
    var maxBisectionSteps = opts.maxBisectionSteps || DEFAULT_RDP_BISECT_STEPS;
    var onProgress = opts.onProgress || null;

    if (alpha <= tol) return 1.0;
    if (alpha >= 1 - tol) return 0.0;

    var maxOrder = opts.maxOrder;
    var gridSize = opts.orderGridSize;

    if (maxOrder == null) {
      maxOrder = Math.min(1000, Math.max(50, Math.ceil(10 / rho)));
    }
    if (gridSize == null) {
      gridSize = Math.min(200, Math.max(20, Math.ceil(5 / rho)));
    }

    // Log-spaced grid of orders
    var logMin = Math.log10(0.5);
    var logMax = Math.log10(maxOrder);
    var orders = [];
    for (var i = 0; i < gridSize; i++) {
      var t = i / (gridSize - 1);
      orders.push(Math.pow(10, logMin + t * (logMax - logMin)));
    }

    var bestBeta = 0;
    var bestIdx = 0;
    for (var i = 0; i < orders.length; i++) {
      var order = orders[i];
      var beta = PrivacyLib.getBetaFromRdp(rho * order, alpha, order, {
        linearSearchStep: linearSearchStep,
        maxBisectionSteps: maxBisectionSteps,
        tol: tol
      });
      if (beta > bestBeta) {
        bestBeta = beta;
        bestIdx = i;
      }
      if (onProgress) onProgress((i + 1) / orders.length);
    }

    // Refine with golden section around best order
    if (bestIdx > 0 && bestIdx < orders.length - 1) {
      var oLow = orders[bestIdx - 1];
      var oHigh = orders[bestIdx + 1];
      var result = M.goldenSectionSearch(function (order) {
        return -PrivacyLib.getBetaFromRdp(rho * order, alpha, order, {
          linearSearchStep: linearSearchStep,
          maxBisectionSteps: maxBisectionSteps,
          tol: tol
        });
      }, oLow, oHigh, tol, GOLDEN_MAX_ITER);
      if (-result.fx > bestBeta) {
        bestBeta = -result.fx;
      }
    }

    return bestBeta;
  };

  PrivacyLib.getAdvantageFromZcdp = function (rho, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || null;
    var step = 0;
    var totalSteps = DEFAULT_RDP_BISECT_STEPS; // approx from golden section

    var result = M.goldenSectionSearch(function (alpha) {
      step++;
      if (onProgress) onProgress(Math.min(step / totalSteps, 1.0));
      return -(1 - alpha - PrivacyLib.getBetaFromZcdp(rho, alpha, {
        tol: opts.tol,
        linearSearchStep: opts.linearSearchStep,
        maxBisectionSteps: opts.maxBisectionSteps,
        maxOrder: opts.maxOrder,
        orderGridSize: opts.orderGridSize
      }));
    }, 1e-6, 1 - 1e-6, opts.tol || DEFAULT_ZCDP_TOL, DEFAULT_RDP_BISECT_STEPS);

    return -result.fx;
  };

  // =========================================================================
  // Trade-off curve generation
  // =========================================================================

  PrivacyLib.generateAlphaGrid = function (numPoints, logPoints) {
    logPoints = logPoints || Math.round(numPoints * 0.75);
    var linPoints = numPoints - logPoints;
    var alphas = [];

    // Log-spaced from 1e-6 to 0.5
    for (var i = 0; i < logPoints; i++) {
      var t = i / (logPoints - 1);
      alphas.push(Math.pow(10, -6 + t * (Math.log10(0.5) + 6)));
    }
    // Linear from 0.5 to 1.0
    for (var i = 1; i <= linPoints; i++) {
      alphas.push(0.5 + (i / linPoints) * 0.5);
    }
    return alphas;
  };

  PrivacyLib.generateTradeoffCurve = function (notion, params, numPoints, opts) {
    numPoints = numPoints || PrivacyLib.DEFAULT_ALPHA_RESOLUTION;
    opts = opts || {};

    if (notion === "gdp") {
      var alphas = PrivacyLib.generateAlphaGrid(numPoints);
      return alphas.map(function (a) {
        return { alpha: a, beta: PrivacyLib.getBetaFromGdp(params.mu, a) };
      });
    }

    if (notion === "adp") {
      var n = Math.max(numPoints, 2500); // ADP is cheap, use high resolution
      var alphas = PrivacyLib.generateAlphaGrid(n);
      return alphas.map(function (a) {
        return { alpha: a, beta: PrivacyLib.getBetaFromAdp(params.epsilon, params.delta, a) };
      });
    }

    if (notion === "zcdp") {
      if (params.rho === 0) {
        var alphas = PrivacyLib.generateAlphaGrid(numPoints || PrivacyLib.DEFAULT_ALPHA_RESOLUTION);
        return alphas.map(function (a) { return { alpha: a, beta: 1 - a }; });
      }
      var n = numPoints || PrivacyLib.DEFAULT_ALPHA_RESOLUTION;
      var alphas = PrivacyLib.generateAlphaGrid(n);
      var innerOpts = stripProgress(opts);
      return alphas.map(function (a, i) {
        if (opts.onProgress) opts.onProgress((i + 1) / n);
        return { alpha: a, beta: PrivacyLib.getBetaFromZcdp(params.rho, a, innerOpts) };
      });
    }

    if (notion === "fdp") {
      return [
        { alpha: 0, beta: 1 },
        { alpha: params.alpha, beta: params.beta },
        { alpha: 1, beta: 0 }
      ];
    }

    if (notion === "tvp") {
      // TVP defines max(0, 1 - alpha - eta)
      var alphas = PrivacyLib.generateAlphaGrid(numPoints);
      return alphas.map(function (a) {
        return { alpha: a, beta: Math.max(0, 1 - a - params.eta) };
      });
    }

    return [];
  };

  // =========================================================================
  // Conversion dispatch
  // =========================================================================

  PrivacyLib.convert = function (source, sourceParams, target, targetParams, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || null;
    var result = { value: null, sourceCurve: null, targetCurve: null };

    var key = source + "->" + target;

    switch (key) {
      // === GDP conversions ===
      case "gdp->zcdp":
        result.value = sourceParams.mu * sourceParams.mu / 2;
        break;

      case "gdp->tvp":
        result.value = PrivacyLib.getAdvantageFromGdp(sourceParams.mu);
        break;

      case "gdp->fdp":
        result.value = PrivacyLib.getBetaFromGdp(sourceParams.mu, targetParams.alpha);
        break;

      case "gdp->adp": {
        // GDP never satisfies pure DP
        if (targetParams.delta <= 0) {
          result.value = Infinity;
        } else {
          var mu = sourceParams.mu;
          var delta0 = PrivacyLib.getGdpDeltaAtEpsilon(mu, 0);
          if (targetParams.delta >= delta0) {
            result.value = 0;
          } else {
            // Line search for an upper bound.
            // var epsHi = 1;
            // while (epsHi < EPS_MAX && PrivacyLib.getGdpDeltaAtEpsilon(mu, epsHi) > 0) {
            //   epsHi *= 2;
            // }
            // // Binary search for the precise underflow boundary
            // var lo = epsHi / 2, hi = Math.min(epsHi, EPS_MAX);
            // for (var i = 0; i < PrivacyLib.BISECT_MAX_ITER; i++) {
            //   var mid = (lo + hi) / 2;
            //   if (PrivacyLib.getGdpDeltaAtEpsilon(mu, mid) > 0) lo = mid; else hi = mid;
            // }
            // epsHi = lo;
            // var minDelta = PrivacyLib.getGdpDeltaAtEpsilon(mu, epsHi);
            // if (targetParams.delta < minDelta) {
            //   // Target delta is below numerical precision.
            //   result.value = epsHi;
            //   result.boundaryHit = "upper";
            // } else {
            // result.value = M.bisect(function (eps) {
            //   return PrivacyLib.getGdpDeltaAtEpsilon(mu, eps) - targetParams.delta;
            // }, 0, epsHi, BISECT_TOL, BISECT_MAX_ITER);
            result.value = M.bisect(function (eps) {
              return PrivacyLib.getGdpDeltaAtEpsilon(mu, eps) - targetParams.delta;
            }, 0, EPS_MAX, BISECT_TOL, BISECT_MAX_ITER);
            if (result.value >= EPS_MAX * BOUNDARY_FRAC) result.boundaryHit = "upper";
          }
        }
        break;
      }

      // === zCDP conversions ===
      case "zcdp->gdp": {
        if (sourceParams.rho == 0) {
          result.value = 0;
          break;
        }
        var innerOpts = stripProgress(opts);
        var alphas = PrivacyLib.generateAlphaGrid(opts.alphaResolution || PrivacyLib.DEFAULT_ALPHA_RESOLUTION);
        var bestMu = 0;
        var tol = innerOpts.tol || DEFAULT_ZCDP_TOL;
        for (var i = 0; i < alphas.length; i++) {
          var a = alphas[i];
          if (a <= ALPHA_SKIP_EPS || a >= 1 - ALPHA_SKIP_EPS) continue;
          var zBeta = PrivacyLib.getBetaFromZcdp(sourceParams.rho, a, innerOpts);
          if (zBeta <= 0 || zBeta >= 1) continue;
          // Skip when zBeta ≈ 1−α (within tolerance) — bisect can't resolve μ reliably
          if ((1 - a) - zBeta < tol) continue;
          var mu = M.bisect(function (m) {
            return PrivacyLib.getBetaFromGdp(m, a) - zBeta;
          }, 0, MU_MAX, BISECT_TOL, BISECT_MAX_ITER);
          if (mu > bestMu) bestMu = mu;
          if (onProgress) onProgress((i + 1) / alphas.length);
        }
        result.value = bestMu;
        if (bestMu >= MU_MAX * BOUNDARY_FRAC) result.boundaryHit = "upper";
        break;
      }

      case "zcdp->tvp":
        if (sourceParams.rho == 0) {
          result.value = 0;
          break;
        }
        result.value = PrivacyLib.getAdvantageFromZcdp(sourceParams.rho, {
          onProgress: onProgress,
          tol: opts.tol
        });
        break;

      case "zcdp->fdp":
        if (sourceParams.rho == 0) {
          result.value = 1 - targetParams.alpha;
          break;
        }
        result.value = PrivacyLib.getBetaFromZcdp(sourceParams.rho, targetParams.alpha, {
          onProgress: onProgress,
          tol: opts.tol
        });
        break;

      case "zcdp->adp": {
        if (sourceParams.rho == 0) {
          result.value = 0;
          break;
        } else if (targetParams.delta == 0) {
          result.value = Infinity;
          break;
        }
        var innerOpts = stripProgress(opts);
        var alphas = PrivacyLib.generateAlphaGrid(opts.alphaResolution || PrivacyLib.DEFAULT_ALPHA_RESOLUTION);
        var bestEps = 0;
        for (var i = 0; i < alphas.length; i++) {
          var beta = PrivacyLib.getBetaFromZcdp(sourceParams.rho, alphas[i], innerOpts);
          if (alphas[i] + beta < 1 - targetParams.delta) {
            var eps = PrivacyLib.getEpsilonFromErrRates(targetParams.delta, alphas[i], beta);
            if (eps > bestEps) bestEps = eps;
          }
          if (onProgress) onProgress((i + 1) / alphas.length);
        }
        result.value = bestEps;
        break;
      }

      // === TVP conversions ===
      case "tvp->gdp":
        result.value = (sourceParams.eta <= 0) ? 0 : Infinity;
        break;

      case "tvp->zcdp":
        result.value = (sourceParams.eta <= 0) ? 0 : Infinity;
        break;

      case "tvp->fdp":
        result.value = Math.max(0, 1 - targetParams.alpha - sourceParams.eta);
        break;

      case "tvp->adp":
        if (targetParams.delta < sourceParams.eta) {
          result.value = Infinity;
        } else {
          result.value = 0;
        }
        break;

      // === f-DP conversions ===
      case "fdp->gdp": {
        if (sourceParams.alpha + sourceParams.beta >= 1) {
          result.value = 0;
          break;
        } else if (sourceParams.alpha == 0 || sourceParams.beta == 0) {
          result.value = Infinity;
          break;
        }
        result.value = M.bisect(function (mu) {
          return PrivacyLib.getBetaFromGdp(mu, sourceParams.alpha) - sourceParams.beta;
        }, 0, MU_MAX, BISECT_TOL, BISECT_MAX_ITER);
        if (result.value >= MU_MAX * BOUNDARY_FRAC) result.boundaryHit = "upper";
        break;
      }

      case "fdp->zcdp": {
        if (sourceParams.alpha + sourceParams.beta >= 1) {
          result.value = 0;
          break;
        } else if (sourceParams.alpha == 0 || sourceParams.beta == 0) {
          result.value = Infinity;
          break;
        }
        var innerOpts = stripProgress(opts);
        result.value = M.bisect(function (rho) {
          if (onProgress) onProgress(rho / 20);
          return PrivacyLib.getBetaFromZcdp(rho, sourceParams.alpha, innerOpts) - sourceParams.beta;
        }, RHO_MIN, RHO_MAX, DEFAULT_ZCDP_TOL, BISECT_MAX_ITER);
        if (result.value >= RHO_MAX * BOUNDARY_FRAC) result.boundaryHit = "upper";
        else if (result.value <= RHO_MIN * (2 - BOUNDARY_FRAC)) result.boundaryHit = "lower";
        if (onProgress) onProgress(1);
        break;
      }

      case "fdp->tvp":
        result.value = 1 - sourceParams.alpha - sourceParams.beta;
        break;

      case "fdp->adp":
        if (sourceParams.alpha + sourceParams.beta >= 1 - targetParams.delta) {
          result.value = 0;
        } else {
          result.value = PrivacyLib.getEpsilonFromErrRates(
            targetParams.delta, sourceParams.alpha, sourceParams.beta
          );
        }
        break;

      // === ADP conversions ===
      case "adp->gdp":
        if (sourceParams.delta > 0) {
          result.value = Infinity;
        } else {
          result.value = PrivacyLib.getMuFromEpsilon(sourceParams.epsilon);
        }
        break;

      case "adp->zcdp":
        if (sourceParams.delta > 0) {
          result.value = Infinity;
        } else {
          var eps = sourceParams.epsilon;
          result.value = eps * eps / 2
          // result.value = eps * Math.tanh(eps / 2);
          // result.value = eps * (Math.exp(eps) - 1) / (Math.exp(eps) + 1)
        }
        break;

      case "adp->tvp":
        result.value = PrivacyLib.getAdvantageFromAdp(sourceParams.epsilon, sourceParams.delta);
        break;

      case "adp->fdp":
        result.value = PrivacyLib.getBetaFromAdp(sourceParams.epsilon, sourceParams.delta, targetParams.alpha);
        break;

      default:
        throw new Error("Unknown conversion: " + key);
    }

    return result;
  };

  // Export
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PrivacyLib;
  } else {
    root.PrivacyLib = PrivacyLib;
  }
})(typeof self !== "undefined" ? self : this);
