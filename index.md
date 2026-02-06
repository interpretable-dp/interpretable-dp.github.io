---
layout: default
title: Interpretable DP
---

<h1 id="suite">Interpretable DP</h1>

A suite of tools for statistics and machine learning with interpretable risk-based provable privacy guarantees for easy auditability and communication of the guarantees in regulated environments.

<div class="section">
<h3>Technical Layer</h3>
<p class="audience">Audience: Researchers, differential privacy experts</p>

<div class="card-grid">
  <div class="card">
    <h3><a href="https://github.com/Felipe-Gomez/riskcal"><code>riskcal</code></a></h3>
    <p>Tools for computing f-DP trade-off curves for differentially private algorithms, and calibrating their noise scale to operational privacy risk measures (attack advantage, or attack TPR and FPR).</p>
    <p><code>pip install riskcal</code></p>
  </div>
  <div class="card">
    <h3><a href="https://github.com/Felipe-Gomez/gdp-numeric/"><code>gdpnum</code></a></h3>
    <p>Correct numerical accounting in terms of Gaussian differential privacy for more interpretable
    and auditable guarantees in privacy-preserving machine learning.</p>
    <p><code>pip install gdpnum</code></p>
  </div>
</div>
</div>

<div class="section">
<h3>Application Layer</h3>
<p class="audience">Audience: Researchers, data scientists</p>

<p>Coming soon: Synthetic data with interpretable privacy guarantees.</p>
</div>

<h2 id="about">About</h2>

<h3 id="publications">Publications</h3>

This software suite has emerged as a result of several independent scientific collaborations.
<ul class="paper-list">
  <li>
    <div class="title"><a href="https://arxiv.org/abs/2407.02191">Attack-Aware Noise Calibration for Differential Privacy</a></div>
    <div class="meta">Bogdan Kulynych*, Juan Felipe Gomez*, Georgios Kaissis, Flavio P. Calmon, Carmela Troncoso · NeurIPS'24</div>
  </li>
  <li>
    <div class="title"><a href="https://arxiv.org/abs/2507.06969">Unifying Re-Identification, Attribute Inference, and Data Reconstruction Risks in Differential Privacy</a></div>
    <div class="meta">Bogdan Kulynych, Juan Felipe Gomez, Georgios Kaissis, Jamie Hayes, Borja Balle, Flavio P. Calmon, Jean Louis Raisaro · NeurIPS'25</div>
  </li>
  <li>
    <div class="title"><a href="https://arxiv.org/abs/2503.10945">Gaussian DP for Reporting Differential Privacy Guarantees in Machine Learning</a></div>
    <div class="meta">Juan Felipe Gomez, Bogdan Kulynych, Georgios Kaissis, Flavio P. Calmon, Jamie Hayes, Borja Balle, Antti Honkela · SatML'26</div>
  </li>
</ul>

<div class="logo-wall">
  <img src="/images/logos/chuv_black.svg" alt="Lausanne University Hospital">
  <img src="/images/logos/epfl.svg" alt="EPFL">
  <img src="/images/logos/harvard.svg" alt="Harvard University" class="logo-harvard">
  <img src="/images/logos/hpi.svg" alt="Hasso Plattner Institute" class="logo-hpi">
  <img src="/images/logos/uni_helsinki_black.svg" alt="University of Helsinki" class="logo-helsinki">
</div>

<h3 id="people">People</h3>

<div class="people-grid">
  <div class="person">
    <img src="https://kulyny.ch/images/bogdan_large_picture.jpg" alt="Bogdan Kulynych">
    <a href="https://kulyny.ch">Bogdan Kulynych</a>
    <span class="role">Principal Investigator</span>
  </div>
  <div class="person">
    <img src="https://felipe-gomez.com/assets/gomez_sailing.jpg" alt="Juan Felipe Gomez">
    <a href="https://felipe-gomez.com/">Juan Felipe Gomez</a>
    <span class="role">Development</span>
  </div>
</div>

<h3 id="funding">Funding</h3>

The effort is partially funded by the Swiss National Science Foundation (SNF):<br>
<a href="https://data.snf.ch/grants/grant/237378">Bridging Regulatory Data Protection Standards and Model Sharing in Healthcare</a>
