(function (root) {
  "use strict";

  var MathUtils = {};

  // Normal CDF — Abramowitz & Stegun 26.2.17, max error ~7.5e-8
  MathUtils.normalCdf = function (x) {
    if (x === Infinity) return 1;
    if (x === -Infinity) return 0;
    var a1 = 0.254829592,
      a2 = -0.284496736,
      a3 = 1.421413741,
      a4 = -1.453152027,
      a5 = 1.061405429,
      p = 0.3275911;
    var sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.SQRT2;
    var t = 1.0 / (1.0 + p * x);
    var y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
  };

  // Normal PPF (inverse CDF) — Acklam's rational approximation, max error ~1.15e-9
  MathUtils.normalPpf = function (p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    var a = [
      -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
      1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0
    ];
    var b = [
      -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
      6.680131188771972e1, -1.328068155288572e1
    ];
    var c = [
      -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
      -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0
    ];
    var d = [
      7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
      3.754408661907416e0
    ];

    var pLow = 0.02425, pHigh = 1 - pLow;
    var q, r;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  };

  // logaddexp(a, b) = log(exp(a) + exp(b)), numerically stable
  MathUtils.logaddexp = function (a, b) {
    if (a === -Infinity) return b;
    if (b === -Infinity) return a;
    var mx = Math.max(a, b);
    return mx + Math.log1p(Math.exp(-Math.abs(a - b)));
  };

  // Golden section search — minimize f on [a, b]
  MathUtils.goldenSectionSearch = function (f, a, b, tol, maxIter) {
    tol = tol || 1e-8;
    maxIter = maxIter || 100;
    var gr = (Math.sqrt(5) + 1) / 2;
    var c = b - (b - a) / gr;
    var d = a + (b - a) / gr;
    for (var i = 0; i < maxIter; i++) {
      if (Math.abs(b - a) < tol) break;
      if (f(c) < f(d)) {
        b = d;
      } else {
        a = c;
      }
      c = b - (b - a) / gr;
      d = a + (b - a) / gr;
    }
    var x = (a + b) / 2;
    return { x: x, fx: f(x) };
  };

  // Bisection — find root of f on [a, b]
  MathUtils.bisect = function (f, a, b, tol, maxIter) {
    tol = tol || 1e-8;
    maxIter = maxIter || 100;
    var fa = f(a), fb = f(b);
    for (var i = 0; i < maxIter; i++) {
      var mid = (a + b) / 2;
      var fm = f(mid);
      if ((b - a) / 2 < tol) return mid;
      if ((fm > 0) === (fa > 0)) {
        a = mid;
        fa = fm;
      } else {
        b = mid;
        fb = fm;
      }
    }
    return (a + b) / 2;
  };

  // Export
  if (typeof module !== "undefined" && module.exports) {
    module.exports = MathUtils;
  } else {
    root.MathUtils = MathUtils;
  }
})(typeof self !== "undefined" ? self : this);
