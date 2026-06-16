(function () {
  if (window.__redactorWorkbenchInitialized) return;
  window.__redactorWorkbenchInitialized = true;

  const addRuleBtn = document.getElementById("add-rule-btn");
  const loadSampleBtn = document.getElementById("load-sample-btn");
  const rulesGrid = document.getElementById("rules-grid");
  const runRedactBtn = document.getElementById("run-redact-btn");

  const checkAllFindingsBtn = document.getElementById("check-all-findings");
  const uncheckAllFindingsBtn = document.getElementById("uncheck-all-findings");

  const sourceTextarea = document.getElementById("source-text");
  const outputTextarea = document.getElementById("output-text");
  const findingsTableBody = document.getElementById("findings-body");
  const copyOutputBtn = document.getElementById("copy-output-btn");

  const SAMPLE_DATA = `Case: Client onboarding review
Analyst: Juan Dela Cruz
Company: Dogban
Partner: Bogdan
Project: Project Narra

Contact email: juan.delacruz@dogban.ai
Backup email: maria.santos+ops@example-internal.test
Phone: +63 917 123 4567
Landline: (02) 8123-4567
Portal URL: https://portal.dogban.ai/admin/reset?token=abc123](https://portal.dogban.ai/admin/reset?token=abc123
Support URL: https://support.bogdan.test/ticket/12345](https://support.bogdan.test/ticket/12345

Domain: dogban.ai
FQDN: juan-main.dogban.ai
Public IPv4: 203.0.113.10
Alt IPv4: 198.51.100.24
IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
MAC Address: AA:BB:CC:DD:EE:FF
Cisco MAC: a1b2.c3d4.e5f6

UUID: 550e8400-e29b-41d4-a716-446655440000
Session: session=ABCDEF1234567890
Bearer Header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def
JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def

AWS Access Key: AKIAIOSFODNN7EXAMPLE
Stripe Key: sk_test_51NabcXYZ1234567890
GitHub Token: ghp_1234567890abcdefghijklmnopqrst
Slack Token: xoxb-123456789012-123456789012-abcdefghijklmnop

Credit Card: 4242 4242 4242 4242
IBAN: GB82WEST12345698765432
SG NRIC: S1234567A
SG FIN: F7654321N
SG UEN: T12AB3456C

Windows Path: C:\\Users\\juan\\Desktop\\secrets.txt
Unix Path: /home/juan/.ssh/id_rsa
DB URL: postgres://admin:SuperSecret123@db.internal.local:5432/prod

Private Key:
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
-----END PRIVATE KEY-----

Certificate:
-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIEbmh5...
-----END CERTIFICATE-----`;

  const state = {
    sourceText: "",
    rules: [],
    findings: [],
    selectedFindingIds: new Set()
  };

  async function copyText(text) {
    if (!text) return false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {}
    }

    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }

    document.body.removeChild(ta);
    return ok;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function addRuleCard(rule) {
    if (!rulesGrid) return;
    rule = rule || {};

    const card = document.createElement("div");
    card.className = "rounded-lg border border-zinc-800 bg-zinc-950/60 p-3";
    card.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-3">
        <strong class="text-sm text-zinc-100">Rule</strong>
        <button type="button" class="btn-danger remove-rule-btn">Remove</button>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-zinc-400">Find text</label>
          <input type="text" class="input-base rule-find" placeholder="Value to redact" value="${escapeHtml(rule.find || "")}">
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-zinc-400">Entity type</label>
          <input type="text" class="input-base rule-entity" placeholder="e.g. PERSON / ORG / PROJECT" value="${escapeHtml(rule.entity_type || "")}">
        </div>

        <div class="md:col-span-2">
          <label class="inline-flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" class="rule-case-sensitive h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-zinc-100" ${rule.case_sensitive ? "checked" : ""}>
            <span>Case sensitive</span>
          </label>
        </div>
      </div>
    `;
    rulesGrid.appendChild(card);
  }

  function collectRules() {
    if (!rulesGrid) return [];

    const rules = [];
    document.querySelectorAll(".rule-find").forEach(function (input) {
      const card = input.closest(".rounded-lg");
      if (!card) return;

      const find = (card.querySelector(".rule-find")?.value || "").trim();
      const entityType = (card.querySelector(".rule-entity")?.value || "").trim().toUpperCase();
      const caseSensitive = !!card.querySelector(".rule-case-sensitive")?.checked;

      if (!find || !entityType) return;

      rules.push({
        find: find,
        entity_type: entityType,
        case_sensitive: caseSensitive
      });
    });

    return rules;
  }

  function getSelectedFindingIdsFromDom() {
    return new Set(
      Array.from(document.querySelectorAll(".finding-toggle:checked")).map(function (checkbox) {
        return checkbox.value;
      })
    );
  }

  function renderFindings(findings) {
    if (!findingsTableBody) return;

    if (!Array.isArray(findings) || !findings.length) {
      findingsTableBody.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="empty-state-block">
              <p>No findings yet. Run redaction to populate this panel.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    findingsTableBody.innerHTML = findings.map(function (item) {
      const checked = item.selected !== false ? "checked" : "";
      return `
        <tr>
          <td class="w-16">
            <input type="checkbox" class="finding-toggle h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-zinc-100" value="${escapeHtml(item.id)}" ${checked}>
          </td>
          <td>${escapeHtml(item.entity)}</td>
          <td><code class="table-code">${escapeHtml(item.match)}</code></td>
          <td><code class="table-code">${escapeHtml(item.replacement)}</code></td>
        </tr>
      `;
    }).join("");

    findingsTableBody.querySelectorAll(".finding-toggle").forEach(function (checkbox) {
      checkbox.addEventListener("change", rerunWithSelection);
    });
  }

  function runClientRedaction() {
    const text = sourceTextarea ? sourceTextarea.value : "";
    const rules = collectRules();

    state.sourceText = text;
    state.rules = rules;

    const result = window.RedactionEngine.runRedaction(text, rules, null);

    state.findings = result.findings;
    state.selectedFindingIds = new Set(
      result.findings
        .filter(function (item) { return item.selected !== false; })
        .map(function (item) { return item.id; })
    );

    renderFindings(result.findings);

    if (outputTextarea) {
      outputTextarea.value = result.redacted_text;
    }

    if (window.RedactionUI) {
      window.RedactionUI.recomputeLayout();
    }
  }

  function rerunWithSelection() {
    state.selectedFindingIds = getSelectedFindingIdsFromDom();

    const result = window.RedactionEngine.runRedaction(
      state.sourceText,
      state.rules,
      state.selectedFindingIds
    );

    state.findings = result.findings;

    if (outputTextarea) {
      outputTextarea.value = result.redacted_text;
    }
  }

  function setAllFindingsChecked(checked) {
    document.querySelectorAll(".finding-toggle").forEach(function (checkbox) {
      checkbox.checked = checked;
    });
    rerunWithSelection();
  }

  if (copyOutputBtn) {
    copyOutputBtn.addEventListener("click", async function () {
      const ok = await copyText(outputTextarea ? outputTextarea.value : "");
      const original = copyOutputBtn.textContent;
      copyOutputBtn.textContent = ok ? "Copied" : "Failed";
      setTimeout(function () {
        copyOutputBtn.textContent = original;
      }, 1400);
    });
  }

  if (loadSampleBtn && sourceTextarea) {
    loadSampleBtn.addEventListener("click", function () {
      sourceTextarea.value = SAMPLE_DATA;
      sourceTextarea.focus();
      state.sourceText = SAMPLE_DATA;

      const original = loadSampleBtn.textContent;
      loadSampleBtn.textContent = "Loaded";
      setTimeout(function () {
        loadSampleBtn.textContent = original;
      }, 1400);
    });
  }

  if (rulesGrid) {
    rulesGrid.innerHTML = "";
    const initialRules = Array.isArray(window.INITIAL_RULES) ? window.INITIAL_RULES : [];
    if (initialRules.length) {
      initialRules.forEach(addRuleCard);
    } else {
      addRuleCard({});
    }

    rulesGrid.addEventListener("click", function (e) {
      if (e.target.classList.contains("remove-rule-btn")) {
        const card = e.target.closest(".rounded-lg");
        if (card) {
          card.remove();
          state.rules = collectRules();
          if (!rulesGrid.children.length) {
            addRuleCard({});
          }
          if (window.RedactionUI) {
            window.RedactionUI.recomputeLayout();
          }
        }
      }
    });

    rulesGrid.addEventListener("input", function () {
      state.rules = collectRules();
    });

    rulesGrid.addEventListener("change", function () {
      state.rules = collectRules();
    });
  }

  if (addRuleBtn) {
    addRuleBtn.addEventListener("click", function () {
      addRuleCard({});
      state.rules = collectRules();
      if (window.RedactionUI) {
        window.RedactionUI.recomputeLayout();
      }
    });
  }

  if (runRedactBtn) {
    runRedactBtn.addEventListener("click", runClientRedaction);
  }

  if (checkAllFindingsBtn) {
    checkAllFindingsBtn.addEventListener("click", function () {
      setAllFindingsChecked(true);
    });
  }

  if (uncheckAllFindingsBtn) {
    uncheckAllFindingsBtn.addEventListener("click", function () {
      setAllFindingsChecked(false);
    });
  }

  state.rules = collectRules();

  if (window.RedactionUI) {
    window.RedactionUI.initResizers();
  }
})();