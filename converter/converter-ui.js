(function () {
  "use strict";

  // =========================================================================
  // Notion metadata
  // =========================================================================

  var NOTIONS = {
    gdp:  { label: "GDP (μ)", params: ["mu"], needsTarget: [] },
    zcdp: { label: "zCDP (ρ)", params: ["rho"], needsTarget: [] },
    tvp:  { label: "TVP (η)", params: ["eta"], needsTarget: [] },
    fdp:  { label: "f-DP (α, β)", params: ["alpha","beta"], needsTarget: ["alpha"] },
    adp:  { label: "ADP (ε, δ)", params: ["epsilon","delta"], needsTarget: ["delta"] }
  };

  var PARAM_META = {
    mu:      { label: "μ", min: 0, max: 50, step: 0.1, default: 1.0 },
    rho:     { label: "ρ", min: 0, max: 50, step: 0.1, default: 0.5 },
    eta:     { label: "η", min: 0, max: 1,  step: 0.01, default: 0.25 },
    alpha:   { label: "α", min: 0, max: 1, step: 0.001, default: 0.05, slider: true },
    beta:    { label: "β", min: 0, max: 1, step: 0.01, default: 0.80 },
    epsilon: { label: "ε", min: 0, max: 50, step: 0.1, default: 1.0 },
    delta:   { label: "δ", min: 0, max: 1, step: 0.001, default: 1e-5, slider: true }
  };

  // Conversions that need the Worker (anything involving zCDP curve generation)
  var EXPENSIVE = {
    "gdp->zcdp": true, "adp->zcdp": true,
    "zcdp->gdp": true, "zcdp->tvp": true, "zcdp->fdp": true, "zcdp->adp": true,
    "fdp->zcdp": true
  };

  // =========================================================================
  // State
  // =========================================================================

  var state = {
    source: "gdp",
    target: "zcdp",
    sourceParams: { mu: 1.0 },
    targetParams: {},
    worker: null,
    workerId: 0,
    debounceTimer: null,
    chart: null,
    showTPR: false  // false = β (FNR), true = β̄ = 1−β (TPR)
  };

  // Show opt box only when zCDP numeric optimization is actually used
  // (not for TVP/ADP→zCDP which are instant via GDP)
  function usesZcdpNumeric() {
    if (state.source === "zcdp") return true;
    if (state.target === "zcdp" && state.source !== "tvp" && state.source !== "adp" && state.source !== "gdp") return true;
    return false;
  }

  function getOptParams() {
    return {
      alphaResolution: parseInt($("opt-alpha-res").value) || PrivacyLib.DEFAULT_ALPHA_RESOLUTION,
      tol: parseFloat($("opt-tol").value) || 1e-4
    };
  }

  function updateOptBoxVisibility() {
    var box = $("opt-box");
    if (usesZcdpNumeric()) {
      box.classList.add("active");
    } else {
      box.classList.remove("active");
    }
  }

  // =========================================================================
  // DOM helpers
  // =========================================================================

  function $(id) { return document.getElementById(id); }

  var BETA_BAR_HTML = '<span style="text-decoration:overline">β</span>';

  function getParamLabel(name, asHTML) {
    if (name === "beta" && state.showTPR) {
      return asHTML ? BETA_BAR_HTML : "β\u0304";
    }
    return PARAM_META[name].label;
  }

  function getTargetResultLabel(asHTML) {
    var notion = NOTIONS[state.target];
    // The result param is whichever param is NOT a user-supplied target input
    var needsSet = {};
    notion.needsTarget.forEach(function (p) { needsSet[p] = true; });
    for (var i = 0; i < notion.params.length; i++) {
      if (!needsSet[notion.params[i]]) {
        return getParamLabel(notion.params[i], asHTML);
      }
    }
    return "Result";
  }

  function buildParamInputs(containerId, paramNames, values, onChange, readOnly) {
    var container = $(containerId);
    container.innerHTML = "";
    paramNames.forEach(function (name) {
      var meta = PARAM_META[name];
      var div = document.createElement("div");
      div.className = "param-row";

      var label = document.createElement("label");
      label.innerHTML = getParamLabel(name, true);
      div.appendChild(label);

      if (readOnly) {
        var span = document.createElement("span");
        span.className = "result-value";
        span.id = "result-" + name;
        span.textContent = values[name] != null ? formatValue(values[name]) : "—";
        div.appendChild(span);
      } else if (meta.slider) {
        // Numeric input + linear slider
        var val = values[name] != null ? values[name] : meta.default;
        var input = document.createElement("input");
        input.type = "text";
        input.className = "param-input";
        input.id = "input-" + containerId + "-" + name;
        input.value = formatValue(val);
        div.appendChild(input);

        var slider = document.createElement("input");
        slider.type = "range";
        slider.className = "param-slider";
        slider.id = "slider-" + containerId + "-" + name;
        slider.min = 0;
        slider.max = 1000;
        slider.value = Math.round(((val - meta.min) / (meta.max - meta.min)) * 1000);
        div.appendChild(slider);

        // Bidirectional sync (linear)
        input.addEventListener("input", function () {
          var v = parseFloat(input.value);
          if (!isNaN(v) && v >= meta.min && v <= meta.max) {
            slider.value = Math.round(((v - meta.min) / (meta.max - meta.min)) * 1000);
            onChange(name, v);
          }
        });
        slider.addEventListener("input", function () {
          var v = meta.min + (parseFloat(slider.value) / 1000) * (meta.max - meta.min);
          input.value = formatValue(v);
          onChange(name, v);
        });
      } else {
        var input = document.createElement("input");
        input.type = "number";
        input.className = "param-input";
        input.id = "input-" + containerId + "-" + name;
        input.min = meta.min;
        input.max = meta.max;
        input.step = meta.step;
        input.value = values[name] != null ? values[name] : meta.default;
        div.appendChild(input);

        input.addEventListener("input", function () {
          var v = parseFloat(input.value);
          if (!isNaN(v)) onChange(name, v);
        });
      }

      container.appendChild(div);
    });
  }

  function formatValue(v) {
    if (v == null || isNaN(v)) return "—";
    if (!isFinite(v)) return "∞";
    if (v === 0) return "0";
    if (Math.abs(v) < 0.001 || Math.abs(v) >= 1e6) return v.toExponential(4);
    if (Math.abs(v) < 0.01) return v.toFixed(6);
    return parseFloat(v.toPrecision(6)).toString();
  }

  // =========================================================================
  // UI rendering
  // =========================================================================

  function hasSourceError() {
    if (state.source === "fdp") {
      var a = state.sourceParams.alpha || 0;
      var b = state.sourceParams.beta || 0;
      if (a + b > 1) return "Requires α + β ≤ 1";
    }
    return null;
  }

  function updateSourceError() {
    var msg = hasSourceError();
    var el = $("source-param-error");
    if (msg) {
      if (!el) {
        // Insert span into the beta param-row
        var betaInput = document.getElementById("input-source-params-beta");
        if (!betaInput) return;
        el = document.createElement("span");
        el.id = "source-param-error";
        el.className = "param-error";
        betaInput.parentNode.appendChild(el);
      }
      el.textContent = msg;
    } else if (el) {
      el.remove();
    }
  }

  function renderSourceParams() {
    var notion = NOTIONS[state.source];
    var defaults = {};
    notion.params.forEach(function (p) {
      defaults[p] = state.sourceParams[p] != null ? state.sourceParams[p] : PARAM_META[p].default;
      state.sourceParams[p] = defaults[p];
    });

    // For f-DP in TPR mode, display β̄ = 1 − β
    var displayDefaults = {};
    for (var k in defaults) displayDefaults[k] = defaults[k];
    if (state.source === "fdp" && state.showTPR && displayDefaults.beta != null) {
      displayDefaults.beta = 1 - displayDefaults.beta;
    }

    updateSourceError();

    buildParamInputs("source-params", notion.params, displayDefaults, function (name, val) {
      if (name === "beta" && state.showTPR) {
        state.sourceParams.beta = 1 - val;  // convert β̄ back to β
      } else {
        state.sourceParams[name] = val;
      }
      updateSourceError();
      debouncedConvert();
    }, false);
  }

  function renderTargetParams() {
    var notion = NOTIONS[state.target];
    var targetNeedsInput = notion.needsTarget;

    // Result display for the main target value
    var container = $("target-params");
    container.innerHTML = "";

    // Show the computed result
    var resultDiv = document.createElement("div");
    resultDiv.className = "param-row";
    var resultLabel = document.createElement("label");
    resultLabel.id = "result-label";
    resultLabel.innerHTML = getTargetResultLabel(true);
    resultDiv.appendChild(resultLabel);
    var resultSpan = document.createElement("span");
    resultSpan.className = "result-value";
    resultSpan.id = "result-value";
    resultSpan.textContent = "—";
    resultDiv.appendChild(resultSpan);
    container.appendChild(resultDiv);

    // If the target needs additional parameters (alpha for f-DP, delta for ADP)
    if (targetNeedsInput.length > 0) {
      var defaults = {};
      targetNeedsInput.forEach(function (p) {
        defaults[p] = state.targetParams[p] != null ? state.targetParams[p] : PARAM_META[p].default;
        state.targetParams[p] = defaults[p];
      });
      buildParamInputs("target-extra-params", targetNeedsInput, defaults, function (name, val) {
        state.targetParams[name] = val;
        debouncedConvert();
      }, false);
    } else {
      $("target-extra-params").innerHTML = "";
    }
  }

  function renderDropdowns() {
    var sourceSelect = $("source-select");
    var targetSelect = $("target-select");
    sourceSelect.innerHTML = "";
    targetSelect.innerHTML = "";
    Object.keys(NOTIONS).forEach(function (key) {
      var opt1 = document.createElement("option");
      opt1.value = key;
      opt1.textContent = NOTIONS[key].label;
      if (key === state.source) opt1.selected = true;
      sourceSelect.appendChild(opt1);

      var opt2 = document.createElement("option");
      opt2.value = key;
      opt2.textContent = NOTIONS[key].label;
      if (key === state.target) opt2.selected = true;
      targetSelect.appendChild(opt2);
    });
  }

  // =========================================================================
  // Chart
  // =========================================================================

  function initChart() {
    var ctx = $("tradeoff-chart").getContext("2d");
    state.chart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            label: "Source",
            data: [],
            borderColor: "#0066cc",
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0.1,
            order: 2
          },
          {
            label: "Target",
            data: [],
            borderColor: "#e67300",
            borderWidth: 2,
            borderDash: [6, 3],
            pointRadius: 0,
            fill: false,
            tension: 0.1,
            order: 1
          },
          {
            label: "Point",
            data: [],
            borderColor: "#cc0000",
            backgroundColor: "#cc0000",
            pointRadius: 6,
            pointStyle: "circle",
            showLine: false,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        animation: { duration: 300 },
        scales: {
          x: {
            type: "linear",
            title: { display: true, text: "α (FPR)" },
            min: 0, max: 1
          },
          y: {
            type: "linear",
            title: { display: true, text: "β (FNR)" },
            min: 0, max: 1
          }
        },
        plugins: {
          legend: { display: true, position: "top" },
          tooltip: {
            enabled: true,
            mode: "nearest",
            intersect: false,
            callbacks: {
              title: function () { return ""; },
              label: function (ctx) {
                var n = ctx.dataset.data.length;
                var digits = n > 1 ? Math.ceil(Math.log10(n)) : 2;
                var betaLabel = state.showTPR ? "β̄" : "β";
                return ctx.dataset.label + ": α = " + ctx.parsed.x.toFixed(digits) + ", " + betaLabel + " = " + ctx.parsed.y.toFixed(digits);
              }
            }
          }
        }
      }
    });
  }

  function mapY(beta) {
    return state.showTPR ? 1 - beta : beta;
  }

  function updateChart(sourceCurve, targetCurve, highlightPoint) {
    if (!state.chart) return;

    // Update y-axis label
    state.chart.options.scales.y.title.text = state.showTPR ? "β̄ = 1 − β (TPR)" : "β (FNR)";

    // f-DP source is piecewise-linear (3 points) — use straight line segments
    state.chart.data.datasets[0].tension = (state.source === "fdp") ? 0 : 0.1;

    state.chart.data.datasets[0].data = (sourceCurve || []).map(function (p) {
      return { x: p.alpha, y: mapY(p.beta) };
    });
    state.chart.data.datasets[1].data = (targetCurve || []).map(function (p) {
      return { x: p.alpha, y: mapY(p.beta) };
    });
    state.chart.data.datasets[2].data = highlightPoint
      ? [{ x: highlightPoint.alpha, y: mapY(highlightPoint.beta) }]
      : [];

    state.chart.update();
  }

  // =========================================================================
  // Conversion logic
  // =========================================================================

  function showProgress(visible, value) {
    var bar = $("progress-bar");
    var fill = $("progress-fill");
    if (visible) {
      bar.classList.add("active");
    } else {
      bar.classList.remove("active");
    }
    fill.style.width = ((value || 0) * 100) + "%";
  }

  function runConversion() {
    if (hasSourceError()) {
      showProgress(false);
      $("result-value").textContent = "—";
      $("approx-warning").className = "";
      updateChart(null, null, null);
      return;
    }

    var key = state.source + "->" + state.target;
    if (state.source === state.target) {
      // Identity — just show the source curve
      showProgress(false);
      $("approx-warning").className = "";
      var curve = PrivacyLib.generateTradeoffCurve(state.source, state.sourceParams, 200);
      updateChart(curve, null, null);
      $("result-value").textContent = "Same notion";
      return;
    }

    var isExpensive = EXPENSIVE[key];

    if (isExpensive) {
      // Use Web Worker
      if (state.worker) {
        state.worker.terminate();
      }
      state.worker = new Worker("/converter/privacy-worker.js");
      state.workerId++;
      var myId = state.workerId;

      showProgress(true, 0);

      state.worker.postMessage({
        id: myId,
        action: "convert",
        params: {
          source: state.source,
          sourceParams: state.sourceParams,
          target: state.target,
          targetParams: state.targetParams,
          opts: getOptParams()
        }
      });

      state.worker.addEventListener("message", function (e) {
        var msg = e.data;
        if (msg.id !== myId) return;

        if (msg.type === "progress") {
          showProgress(true, msg.value);
        } else if (msg.type === "result") {
          showProgress(false);
          displayResult(msg.value);
        } else if (msg.type === "error") {
          showProgress(false);
          $("result-value").textContent = "Error: " + msg.message;
        }
      });
    } else {
      // Run on main thread
      showProgress(false);
      try {
        var result = PrivacyLib.convert(
          state.source, state.sourceParams,
          state.target, state.targetParams,
          { onProgress: function (v) { showProgress(true, v); } }
        );

        // Generate curves on main thread for fast conversions
        var sourceCurve = PrivacyLib.generateTradeoffCurve(state.source, state.sourceParams, 200);
        result.sourceCurve = sourceCurve;

        if (result.value != null && isFinite(result.value)) {
          if (state.target === "gdp") {
            result.targetCurve = PrivacyLib.generateTradeoffCurve("gdp", { mu: result.value }, 200);
          } else if (state.target === "tvp") {
            result.targetCurve = PrivacyLib.generateTradeoffCurve("tvp", { eta: result.value }, 200);
          } else if (state.target === "adp") {
            result.targetCurve = PrivacyLib.generateTradeoffCurve("adp", {
              epsilon: result.value, delta: state.targetParams.delta || 0
            }, 1000);
          }
        }

        showProgress(false);
        displayResult(result);
      } catch (err) {
        showProgress(false);
        $("result-value").textContent = "Error: " + err.message;
      }
    }
  }

  function displayResult(result) {
    var resultEl = $("result-value");
    if (result.value != null) {
      // For f-DP target in TPR mode, display β̄ = 1 − β
      var displayVal = result.value;
      if (state.target === "fdp" && state.showTPR) {
        displayVal = 1 - displayVal;
      }
      resultEl.textContent = formatValue(displayVal);
    } else {
      resultEl.textContent = "—";
    }

    // Show warnings/errors for zCDP numeric conversions
    var warnEl = $("approx-warning");
    if (warnEl) {
      if (result.boundaryHit && state.source === "gdp" && state.target === "adp") {
        warnEl.textContent = "δ is too small for numerical precision";
        warnEl.className = "conv-warning";
      } else if (result.boundaryHit) {
        warnEl.textContent = "Optimization failed";
        warnEl.className = "conv-error";
      } else if (state.source === "adp" && state.target === "zcdp" && !(state.sourceParams.delta > 0)) {
        warnEl.textContent = "Pure DP to zCDP conversion is not optimal.";
        warnEl.className = "conv-warning";
      } else if (usesZcdpNumeric()) {
        warnEl.textContent = "zCDP conversion is approximate and could encounter numerical issues.";
        warnEl.className = "conv-warning";
      } else {
        warnEl.className = "";
      }
    }

    // Override display value when optimization hit search boundary
    if (result.boundaryHit) {
      if (state.source === "gdp" && state.target === "adp") {
        resultEl.textContent = "> " + formatValue(result.value);
      } else {
        resultEl.textContent = "failed";
      }
    }

    // Update result label for target notion symbol
    var resultLabel = $("result-label");
    if (resultLabel) {
      resultLabel.innerHTML = getTargetResultLabel(true);
    }

    // Determine highlight point
    var highlight = null;
    if (state.target === "fdp" && result.value != null) {
      highlight = { alpha: state.targetParams.alpha, beta: result.value };
    } else if (state.source === "fdp") {
      highlight = { alpha: state.sourceParams.alpha, beta: state.sourceParams.beta };
    }

    updateChart(result.sourceCurve, result.boundaryHit ? null : result.targetCurve, highlight);
  }

  function debouncedConvert() {
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(runConversion, 300);
  }

  // =========================================================================
  // Event handlers
  // =========================================================================

  function setup() {
    renderDropdowns();
    renderSourceParams();
    renderTargetParams();
    initChart();

    $("source-select").addEventListener("change", function () {
      state.source = this.value;
      state.sourceParams = {};
      renderSourceParams();
      updateOptBoxVisibility();
      debouncedConvert();
    });

    $("target-select").addEventListener("change", function () {
      state.target = this.value;
      state.targetParams = {};
      renderTargetParams();
      updateOptBoxVisibility();
      debouncedConvert();
    });

    $("swap-btn").addEventListener("click", function () {
      var tmp = state.source;
      state.source = state.target;
      state.target = tmp;
      var tmpP = state.sourceParams;
      state.sourceParams = state.targetParams;
      state.targetParams = tmpP;
      renderDropdowns();
      renderSourceParams();
      renderTargetParams();
      updateOptBoxVisibility();
      debouncedConvert();
    });

    // Optimization param changes trigger re-conversion
    ["opt-alpha-res", "opt-tol"].forEach(function (id) {
      $(id).addEventListener("input", function () {
        debouncedConvert();
      });
    });

    $("flip-axis-btn").addEventListener("click", function () {
      state.showTPR = !state.showTPR;
      this.innerHTML = state.showTPR
        ? "Show β (FNR)"
        : 'Show <span style="text-decoration:overline">β</span> (TPR)';
      // Re-render f-DP params if active (label changes)
      if (state.source === "fdp") renderSourceParams();
      if (state.target === "fdp") renderTargetParams();
      // Re-run to update chart and displayed values
      runConversion();
    });

    // Initial state
    updateOptBoxVisibility();
    runConversion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
