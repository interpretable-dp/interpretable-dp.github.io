---
layout: default
title: dpconverter — Interpretable DP
permalink: /converter/
---

<style>
  .converter-wrap {
    max-width: 900px;
    margin: 0 auto;
  }
  .converter-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }
  .converter-header select {
    font-size: 1rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    min-width: 150px;
    cursor: pointer;
  }
  .converter-header select:focus {
    outline: none;
    border-color: #0066cc;
  }
  #swap-btn {
    font-size: 1.2rem;
    background: none;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    line-height: 1;
  }
  #swap-btn:hover {
    background: #f5f5f5;
  }
  .params-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
  }
  @media (max-width: 500px) {
    .params-row {
      grid-template-columns: 1fr;
    }
  }
  .params-section {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    min-height: 120px;
  }
  .params-section h3 {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .param-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }
  .param-row label {
    font-weight: 600;
    min-width: 1.5rem;
  }
  .param-input {
    width: 100px;
    padding: 0.35rem 0.5rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.95rem;
  }
  .param-input:focus {
    outline: none;
    border-color: #0066cc;
  }
  .param-slider {
    flex: 1;
    min-width: 80px;
  }
  .result-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #0066cc;
  }
  #progress-bar {
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
    height: 2px;
    background: #eee;
    border-radius: 1px;
    margin-bottom: 0.25rem;
    overflow: hidden;
    visibility: hidden;
  }
  #progress-bar.active {
    visibility: visible;
  }
  #progress-fill {
    height: 100%;
    background: #0066cc;
    border-radius: 3px;
    transition: width 0.15s;
    width: 0%;
  }
  .chart-wrap {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    max-width: 500px;
    flex: 1;
    min-width: 0;
  }
  .chart-controls {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.5rem;
  }
  #flip-axis-btn {
    font-size: 0.85rem;
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    color: #666;
  }
  #flip-axis-btn:hover {
    background: #f5f5f5;
    color: #333;
  }
  #approx-warning {
    visibility: hidden;
    font-size: 0.8rem;
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    margin-bottom: 1rem;
    text-align: center;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
    border: 1px solid transparent;
  }
  #approx-warning.conv-warning {
    visibility: visible;
    color: #996600;
    background: #fff8e6;
    border-color: #eed;
  }
  #approx-warning.conv-error {
    visibility: visible;
    color: #993300;
    background: #fff0f0;
    border-color: #ecc;
  }
  .param-error {
    font-size: 0.8rem;
    color: #993300;
  }
  .chart-row {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    justify-content: center;
  }
  .opt-box {
    width: 180px;
    flex-shrink: 0;
    min-height: 100px;
  }
  .opt-box .opt-inner {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    display: none;
  }
  .opt-box.active .opt-inner {
    display: block;
  }
  .opt-box h4 {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .opt-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.4rem;
  }
  .opt-row label {
    font-size: 0.8rem;
    color: #555;
    min-width: 55px;
  }
  .opt-row input {
    width: 60px;
    padding: 0.2rem 0.35rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  .opt-row input:focus {
    outline: none;
    border-color: #0066cc;
  }
  @media (max-width: 720px) {
    .chart-row {
      flex-direction: column;
      align-items: center;
    }
    .opt-box {
      width: 100%;
      max-width: 500px;
    }
  }
</style>

<div class="converter-wrap">

<h2 style="text-align:center; margin-bottom:0.25rem"><code>dpconverter</code></h2>
<p style="text-align:center; color:#666; margin-top:0; margin-bottom:1.5rem; font-size:0.9rem;">
  Convert between DP, zCDP, GDP, f-DP
</p>

<div class="converter-header">
  <select id="source-select"></select>
  <button id="swap-btn" title="Swap source and target">⇄</button>
  <select id="target-select"></select>
</div>

<div class="params-row">
  <div class="params-section">
    <h3>Source</h3>
    <div id="source-params"></div>
  </div>
  <div class="params-section">
    <h3>Target</h3>
    <div id="target-params"></div>
    <div id="target-extra-params"></div>
  </div>
</div>

<div id="approx-warning">Result is approximate (GDP approximation)</div>

<div id="progress-bar"><div id="progress-fill"></div></div>

<div class="chart-row">
  <div class="chart-wrap">
    <div class="chart-controls">
      <button id="flip-axis-btn">Show <span style="text-decoration:overline">β</span> (TPR)</button>
    </div>
    <canvas id="tradeoff-chart"></canvas>
  </div>
  <div class="opt-box" id="opt-box">
    <div class="opt-inner">
      <h4>Search params</h4>
      <div class="opt-row">
        <label for="opt-alpha-res">α grid size</label>
        <input type="number" id="opt-alpha-res" min="10" max="10000" step="5" value="200">
      </div>
      <div class="opt-row">
        <label for="opt-tol">tolerance</label>
        <input type="text" id="opt-tol" value="1e-4">
      </div>
    </div>
  </div>
</div>

</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script src="/lib/math-utils.js"></script>
<script src="/lib/privacy-lib.js"></script>
<script src="/converter/converter-ui.js"></script>
