(function () {
  if (window.RedactionUI) return;

  const MIN = {
    source: 180,
    rules: 160,
    findings: 220
  };

  function getPanels() {
    return {
      source: document.getElementById("source-collapsible"),
      rules: document.getElementById("rules-collapsible"),
      findings: document.getElementById("findings-collapsible"),
      leftPane: document.getElementById("pane-left"),
      workspace: document.getElementById("workspace-form"),
      leftColumn: document.getElementById("left-column"),
      leftResizer: document.getElementById("left-resizer"),
      rulesFindingsResizer: document.getElementById("rules-findings-resizer"),
      mainResizer: document.getElementById("main-resizer")
    };
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function panelMin(name) {
    return MIN[name] || 160;
  }

  function setPanelHeight(node, px) {
    if (!node) return;
    node.style.flex = `0 0 ${Math.max(0, px)}px`;
    node.style.minHeight = `${panelMin(node.dataset.panel)}px`;
  }

  function getHandleHeight(el) {
    if (!el || getComputedStyle(el).display === "none") return 0;
    return el.getBoundingClientRect().height;
  }

  function getLeftAvailableHeight() {
    const { leftColumn, leftResizer, rulesFindingsResizer } = getPanels();
    if (!leftColumn) return 0;

    return Math.max(
      0,
      leftColumn.getBoundingClientRect().height
      - getHandleHeight(leftResizer)
      - getHandleHeight(rulesFindingsResizer)
      - 8
    );
  }

  function getCurrentHeight(node, fallbackName) {
    if (!node) return 0;
    const basis = parseFloat(node.style.flexBasis || "");
    if (Number.isFinite(basis) && basis > 0) return basis;
    return panelMin(fallbackName || node.dataset.panel);
  }

  function distributeLeftHeights(sourceH, rulesH, findingsH) {
    const { source, rules, findings } = getPanels();

    if (window.innerWidth < 1024) {
      [source, rules, findings].forEach(function (node) {
        if (!node) return;
        node.style.flex = "";
        node.style.minHeight = "";
      });
      return;
    }

    setPanelHeight(source, sourceH);
    setPanelHeight(rules, rulesH);
    setPanelHeight(findings, findingsH);
  }

  function normalizeVisibleHeights() {
    const { source, rules, findings } = getPanels();
    const available = getLeftAvailableHeight();
    if (!source || !rules || !findings || !available) return;

    const mins = [panelMin("source"), panelMin("rules"), panelMin("findings")];
    const minTotal = mins.reduce((a, b) => a + b, 0);

    if (available <= minTotal) {
      setPanelHeight(source, mins[0]);
      setPanelHeight(rules, mins[1]);
      setPanelHeight(findings, mins[2]);
      return;
    }

    const current = [
      getCurrentHeight(source, "source"),
      getCurrentHeight(rules, "rules"),
      getCurrentHeight(findings, "findings")
    ];

    const currentTotal = current.reduce((a, b) => a + b, 0) || 1;
    const scaled = current.map(v => (v / currentTotal) * available);

    let nextSource = Math.max(mins[0], scaled[0]);
    let nextRules = Math.max(mins[1], scaled[1]);
    let nextFindings = Math.max(mins[2], scaled[2]);

    const assigned = nextSource + nextRules + nextFindings;
    const diff = available - assigned;

    nextFindings = Math.max(mins[2], nextFindings + diff);

    distributeLeftHeights(nextSource, nextRules, nextFindings);
  }

  function recomputeLayout() {
    if (window.innerWidth < 1024) return;
    normalizeVisibleHeights();
  }

  function beginPointerDrag(cursor, onMove) {
    document.body.classList.add("is-resizing");
    document.body.style.cursor = cursor;

    function move(ev) {
      ev.preventDefault();
      onMove(ev);
    }

    function stop() {
      document.body.classList.remove("is-resizing");
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      recomputeLayout();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  function initMainResizer() {
    const { mainResizer, workspace, leftPane } = getPanels();
    if (!mainResizer || !workspace || !leftPane) return;

    mainResizer.addEventListener("pointerdown", function (e) {
      if (window.innerWidth < 1024) return;
      e.preventDefault();
      e.stopPropagation();

      const workspaceRect = workspace.getBoundingClientRect();

      beginPointerDrag("col-resize", function (ev) {
        const raw = ((ev.clientX - workspaceRect.left) / workspaceRect.width) * 100;
        const pct = clamp(raw, 28, 72);
        leftPane.style.flex = `0 0 ${pct}%`;
      });
    });
  }

  function initTopHandle() {
    const { leftResizer, leftColumn, source, rules, findings } = getPanels();
    if (!leftResizer || !leftColumn || !source || !rules || !findings) return;

    leftResizer.addEventListener("pointerdown", function (e) {
      if (window.innerWidth < 1024) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = leftColumn.getBoundingClientRect();
      const total = getLeftAvailableHeight();

      beginPointerDrag("row-resize", function (ev) {
        const pointer = ev.clientY - rect.top;
        const lowerMin = panelMin("rules") + panelMin("findings");
        const nextSource = clamp(pointer - 6, panelMin("source"), total - lowerMin);
        const remaining = total - nextSource;

        const currentRules = getCurrentHeight(rules, "rules");
        const currentFindings = getCurrentHeight(findings, "findings");
        const lowerTotal = currentRules + currentFindings || 1;
        const rulesRatio = currentRules / lowerTotal;

        const nextRules = clamp(
          remaining * rulesRatio,
          panelMin("rules"),
          remaining - panelMin("findings")
        );
        const nextFindings = remaining - nextRules;

        distributeLeftHeights(nextSource, nextRules, nextFindings);
      });
    });
  }

  function initMiddleHandle() {
    const { rulesFindingsResizer, leftColumn, source, rules, findings } = getPanels();
    if (!rulesFindingsResizer || !leftColumn || !source || !rules || !findings) return;

    rulesFindingsResizer.addEventListener("pointerdown", function (e) {
      if (window.innerWidth < 1024) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = leftColumn.getBoundingClientRect();
      const total = getLeftAvailableHeight();

      beginPointerDrag("row-resize", function (ev) {
        const pointerFromTop = ev.clientY - rect.top;
        const minSource = panelMin("source");
        const minRules = panelMin("rules");
        const minFindings = panelMin("findings");

        const maxFindings = total - minRules - minSource;
        const nextFindings = clamp(total - pointerFromTop, minFindings, maxFindings);

        const remainingAboveFindings = total - nextFindings;

        let nextSource = getCurrentHeight(source, "source");
        nextSource = clamp(nextSource, minSource, remainingAboveFindings - minRules);

        let nextRules = remainingAboveFindings - nextSource;

        if (nextRules < minRules) {
          nextRules = minRules;
          nextSource = remainingAboveFindings - nextRules;
        }

        nextSource = clamp(nextSource, minSource, remainingAboveFindings - minRules);
        nextRules = remainingAboveFindings - nextSource;

        distributeLeftHeights(nextSource, nextRules, nextFindings);
      });
    });
  }

  function initResizers() {
    initMainResizer();
    initTopHandle();
    initMiddleHandle();
    recomputeLayout();
    window.addEventListener("resize", recomputeLayout);
  }

  window.RedactionUI = {
    recomputeLayout,
    initResizers
  };
})();