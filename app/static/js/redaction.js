(function () {
  if (window.RedactionEngine) return;

  function preview(value, limit = 60) {
    const cleaned = String(value || "").replace(/\r/g, " ").replace(/\n/g, " ").trim();
    return cleaned.length <= limit ? cleaned : cleaned.slice(0, limit) + "...";
  }

  function escapeRegExp(str) {
    if (typeof RegExp.escape === "function") return RegExp.escape(str);
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isValidIPv4(value) {
    const parts = String(value).split(".");
    if (parts.length !== 4) return false;
    return parts.every(function (part) {
      if (!/^\d+$/.test(part)) return false;
      const n = Number(part);
      return n >= 0 && n <= 255;
    });
  }

  function isValidIPv6(value) {
    const s = String(value || "").trim();
    if (!s || !s.includes(":")) return false;
    if ((s.match(/::/g) || []).length > 1) return false;

    const hasDouble = s.includes("::");
    const parts = s.split(":");

    if (!hasDouble && parts.length !== 8) return false;
    if (hasDouble && parts.length > 8) return false;

    return parts.every(function (part) {
      if (part === "") return hasDouble;
      return /^[0-9A-Fa-f]{1,4}$/.test(part);
    });
  }

  function isValidUUID(value) {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(String(value || ""));
  }

  function luhnCheck(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let shouldDouble = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = Number(digits[i]);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  const REGEX_RULES = [
    { entity: "PRIVATE_KEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g, reversible: false },
    { entity: "CERTIFICATE", pattern: /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, reversible: false },
    { entity: "DB_CONNECTION_STRING", pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql|amqp):\/\/[^\s'"]+/g, reversible: false },
    { entity: "BEARER_TOKEN", pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, reversible: false },
    { entity: "JWT", pattern: /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\b/g, reversible: false },
    { entity: "AWS_ACCESS_KEY", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, reversible: false },
    { entity: "STRIPE_KEY", pattern: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g, reversible: false },
    { entity: "GITHUB_TOKEN", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, reversible: false },
    { entity: "SLACK_TOKEN", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, reversible: false },
    { entity: "SESSION_ID", pattern: /\b(?:sess|session|sid)[_=:-][A-Za-z0-9\-]{8,}\b/gi, reversible: false },
    { entity: "EMAIL", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, reversible: true },
    { entity: "PHONE", pattern: /\b(?:\+?\d[\d\-\s()]{7,}\d)\b/g, reversible: true },
    { entity: "URL", pattern: /\bhttps?:\/\/[^\s<>'"]+/g, reversible: true },
    { entity: "IPV4", pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g, reversible: true, validator: isValidIPv4 },
    { entity: "IPV6", pattern: /\b(?:[0-9A-Fa-f]{1,4}:){2,7}[0-9A-Fa-f]{1,4}\b/g, reversible: true, validator: isValidIPv6 },
    { entity: "MAC", pattern: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b|\b[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\b/g, reversible: true },
    { entity: "UUID", pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g, reversible: true, validator: isValidUUID },
    { entity: "CREDIT_CARD", pattern: /\b(?:\d[ -]*?){13,19}\b/g, reversible: false, validator: luhnCheck },
    { entity: "IBAN", pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, reversible: true },
    { entity: "SG_NRIC_FIN", pattern: /\b[STFGM]\d{7}[A-Z]\b/gi, reversible: true },
    { entity: "SG_UEN", pattern: /\b(?:\d{8}[A-Z]|\d{9}[A-Z]|T\d{2}[A-Z]{2}\d{4}[A-Z])\b/gi, reversible: true },
    { entity: "WINDOWS_PATH", pattern: /\b[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g, reversible: true },
    { entity: "FQDN", pattern: /\b(?:[a-zA-Z0-9][a-zA-Z0-9-]{0,61}\.)+[a-zA-Z0-9][a-zA-Z0-9-]{0,61}\.[a-zA-Z]{2,}\b\.?/g, reversible: false },
    { entity: "ROOT_DOMAIN", pattern: /\b[a-zA-Z0-9][a-zA-Z0-9-]{0,61}\.[a-zA-Z]{2,}\b(?!\.[a-zA-Z]{2,})/g, reversible: false },
    { entity: "UNIX_PATH", pattern: /(?:^|[^\w])\/(?:[\w.-]+\/)*[\w.-]+/g, reversible: true, transformMatch: function (m) { return m.trimStart(); } }
  ];

  function applyManualRules(text, rules, findings) {
    let output = text;

    rules
      .slice()
      .sort(function (a, b) {
        return String(b.find || "").length - String(a.find || "").length;
      })
      .forEach(function (rule, idx) {
        const flags = rule.case_sensitive ? "g" : "gi";
        const pattern = new RegExp(escapeRegExp(rule.find), flags);

        output = output.replace(pattern, function (match) {
          const token = `[${rule.entity_type}]`;
          findings.push({
            id: `manual-${idx + 1}-${findings.length + 1}`,
            entity: rule.entity_type,
            match: match,
            replacement: token,
            selected: true,
            kind: "manual"
          });
          return token;
        });
      });

    return output;
  }

  function collectSpans(text) {
    const spans = [];

    REGEX_RULES.forEach(function (rule) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match;

      while ((match = regex.exec(text)) !== null) {
        let matchedText = match[0];
        let start = match.index;

        if (typeof rule.transformMatch === "function") {
          const transformed = rule.transformMatch(matchedText);
          const delta = matchedText.length - transformed.length;
          matchedText = transformed;
          start = start + delta;
        }

        if (!matchedText) {
          regex.lastIndex += 1;
          continue;
        }

        if (typeof rule.validator === "function" && !rule.validator(matchedText)) {
          continue;
        }

        spans.push({
          start: start,
          end: start + matchedText.length,
          entity: rule.entity,
          text: matchedText,
          reversible: !!rule.reversible
        });

        if (match.index === regex.lastIndex) regex.lastIndex += 1;
      }
    });

    spans.sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      return (b.end - b.start) - (a.end - a.start);
    });

    const selected = [];
    let lastEnd = -1;

    spans.forEach(function (span) {
      if (span.start < lastEnd) return;
      selected.push(span);
      lastEnd = span.end;
    });

    return selected;
  }

  function buildRegexFindings(text, selectedFindingIds) {
    const spans = collectSpans(text);
    const useDefaultSelected = !selectedFindingIds;
    const selectedSet = selectedFindingIds || new Set();

    return spans.map(function (span, index) {
      const id = `regex-${index + 1}`;
      return {
        id,
        entity: span.entity,
        match: span.text,
        replacement: `[${span.entity}]`,
        start: span.start,
        end: span.end,
        reversible: span.reversible,
        selected: useDefaultSelected ? true : selectedSet.has(id),
        kind: "regex"
      };
    });
  }

  function applySelectedRegexFindings(text, regexFindings, findings) {
    if (!regexFindings || !regexFindings.length) return text;

    let cursor = 0;
    const out = [];

    regexFindings.forEach(function (item) {
      if (!item.selected) return;
      out.push(text.slice(cursor, item.start));
      out.push(item.replacement);
      findings.push({
        id: item.id,
        entity: item.entity,
        match: item.match,
        replacement: item.replacement,
        selected: true,
        kind: "regex"
      });
      cursor = item.end;
    });

    out.push(text.slice(cursor));
    return out.join("");
  }

  function dedupeFindings(findings) {
    const seen = new Set();
    const cleaned = [];

    findings.forEach(function (item) {
      const key = [item.id, item.entity, item.match, item.replacement].join("||");
      if (seen.has(key)) return;
      seen.add(key);

      cleaned.push({
        id: item.id,
        entity: item.entity,
        match: preview(item.match),
        replacement: item.replacement,
        selected: item.selected !== false,
        kind: item.kind || "regex"
      });
    });

    return cleaned;
  }

  function runRedaction(text, rules, selectedFindingIds) {
    const manualAppliedFindings = [];
    const manualRules = Array.isArray(rules) ? rules : [];

    const textAfterManual = applyManualRules(text, manualRules, manualAppliedFindings);
    const regexFindings = buildRegexFindings(textAfterManual, selectedFindingIds);
    const redacted = applySelectedRegexFindings(textAfterManual, regexFindings, manualAppliedFindings);
    const allFindings = manualAppliedFindings.concat(regexFindings);

    return {
      redacted_text: redacted,
      findings: dedupeFindings(allFindings),
      regex_findings: regexFindings,
      manual_rules: manualRules
    };
  }

  window.RedactionEngine = {
    REGEX_RULES,
    runRedaction,
    collectSpans
  };
})();