importScripts("/lib/math-utils.js", "/lib/privacy-lib.js");

self.addEventListener("message", function (e) {
  var msg = e.data;
  var id = msg.id;

  if (msg.action === "convert") {
    var p = msg.params;
    var userOpts = p.opts || {};
    var alphaRes = userOpts.alphaResolution || PrivacyLib.DEFAULT_ALPHA_RESOLUTION;
    try {
      var convertOpts = {
        onProgress: function (v) {
          // Convert phase: 0–50%
          self.postMessage({ id: id, type: "progress", value: v * 0.5 });
        },
        alphaResolution: alphaRes,
        tol: userOpts.tol
      };
      var result = PrivacyLib.convert(p.source, p.sourceParams, p.target, p.targetParams, convertOpts);

      // Generate source curve: 50–75%
      var srcNumPts = p.source === "zcdp" ? alphaRes : 200;
      var srcCurveOpts = {
        onProgress: function (v) {
          self.postMessage({ id: id, type: "progress", value: 0.5 + v * 0.25 });
        },
        tol: userOpts.tol
      };
      result.sourceCurve = PrivacyLib.generateTradeoffCurve(p.source, p.sourceParams, srcNumPts, srcCurveOpts);

      // Generate target curve: 75–100%
      var v = result.value;
      if (v != null && isFinite(v)) {
        if (p.target === "gdp") {
          result.targetCurve = PrivacyLib.generateTradeoffCurve("gdp", { mu: v }, 200);
        } else if (p.target === "zcdp") {
          result.targetCurve = PrivacyLib.generateTradeoffCurve("zcdp", { rho: v }, alphaRes, {
            onProgress: function (frac) {
              self.postMessage({ id: id, type: "progress", value: 0.75 + frac * 0.25 });
            },
            tol: userOpts.tol
          });
        } else if (p.target === "tvp") {
          result.targetCurve = PrivacyLib.generateTradeoffCurve("tvp", { eta: v }, 200);
        } else if (p.target === "adp") {
          result.targetCurve = PrivacyLib.generateTradeoffCurve("adp", {
            epsilon: v, delta: p.targetParams.delta || 0
          }, 1000);
        }
      }

      self.postMessage({ id: id, type: "result", value: result });
    } catch (err) {
      self.postMessage({ id: id, type: "error", message: err.message });
    }
  }

  if (msg.action === "generateCurve") {
    var p = msg.params;
    try {
      var curve = PrivacyLib.generateTradeoffCurve(p.notion, p.params, p.numPoints, {
        onProgress: function (v) {
          self.postMessage({ id: id, type: "progress", value: v });
        }
      });
      self.postMessage({ id: id, type: "result", value: curve });
    } catch (err) {
      self.postMessage({ id: id, type: "error", message: err.message });
    }
  }
});
