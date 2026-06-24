"use strict";

/*
  js/app.js
  ---------
  Bootstraps the page and owns the GLOBAL setup (country, template, default
  direction) that applies to every scenario. Wires the top-level buttons,
  validates a scenario before it is added, runs generation (writing each
  scenario's values into the one global template) and handles downloads.
  Attached to window.PUF.app. Loaded last.
*/

window.PUF = window.PUF || {};

PUF.app = (function () {
    var util = PUF.util;
    var byId = util.byId;
    var generated = [];          // [{ filename, xml }]
    var globalCountry = "";      // updated by the Setup country picker

    var GITHUB_BASE = "https://github.com/pagero/puf-billing/tree/master/examples/country-specific-examples/";

    function init() {
        PUF.scenarios.init({
            tbody: byId("scenario-tbody"),
            modal: byId("editor-modal"),
            title: byId("editor-title"),
            body: byId("editor-body"),
            errors: byId("editor-errors"),
            saveBtn: byId("editor-save"),
            cancelBtn: byId("editor-cancel"),
            closeBtn: byId("editor-close")
        });
        mountGlobalCountry();
        updateGlobalTemplateLink();
        PUF.scenarios.render();
        bindEvents();
    }

    /* ------------------------------- events ------------------------------- */

    function bindEvents() {
        on("add-scenario", "click", function () { PUF.scenarios.openEditor("add"); });
        on("clear-scenarios", "click", function () {
            if (PUF.scenarios.getScenarios().length && !confirm("Remove all scenarios?")) return;
            PUF.scenarios.clear();
        });
        on("generate", "click", generate);
        on("download-all", "click", downloadAll);

        // Global setup.
        on("global-direction", "change", function () { PUF.scenarios.render(); });
        bindFile("global-template-file", function (text) {
            var ta = byId("global-template");
            if (ta) ta.value = text;
            setupStatus("Loaded template file.", "info");
        });
        bindFile("xml-import-file", importFromXml);

        // Settings modal (the editor modal is managed inside scenarios.js).
        on("settings-open", "click", function () { openModal(byId("settings-modal")); });
        on("settings-close", "click", function () { closeModal(byId("settings-modal")); });
        on("settings-done", "click", function () { closeModal(byId("settings-modal")); });
        bindModalDismiss(byId("settings-modal"));
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                var m = byId("settings-modal");
                if (m && !m.hasAttribute("hidden")) closeModal(m);
            }
        });
    }

    function on(id, event, handler) {
        var node = byId(id);
        if (node) node.addEventListener(event, handler);
    }
    function bindFile(id, handler) {
        var input = byId(id);
        if (!input) return;
        input.addEventListener("change", function () {
            var file = input.files && input.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () { handler(String(reader.result || ""), file.name); };
            reader.readAsText(file);
            input.value = "";
        });
    }

    /* ----------------------------- global setup --------------------------- */

    function mountGlobalCountry() {
        var host = byId("global-country-host");
        if (!host) return;
        PUF.scenarios.countryControl(host, globalCountry, function (code) {
            globalCountry = code;
            updateGlobalTemplateLink();
            if (PUF.scenarios.refreshCountry) PUF.scenarios.refreshCountry();
        });
    }

    function setGlobalCountry(code) {
        globalCountry = code || "";
        mountGlobalCountry();
        updateGlobalTemplateLink();
        if (PUF.scenarios.refreshCountry) PUF.scenarios.refreshCountry();
    }

    function updateGlobalTemplateLink() {
        var link = byId("global-template-link");
        if (!link) return;
        var c = globalCountry ? PUF_DATA.countriesByCode[globalCountry] : null;
        if (c && c.folder) {
            link.textContent = "open the " + c.name + " examples on GitHub ↗";
            link.setAttribute("href", GITHUB_BASE + encodeURIComponent(c.folder));
        } else {
            link.textContent = "select a country to get its example link";
            link.removeAttribute("href");
        }
    }

    function getGlobalCountry() { return globalCountry; }
    function getGlobalTemplate() { return val("global-template"); }
    function getGlobalDirection() { return val("global-direction") || "AR"; }

    /* --------------------------- import from file ------------------------- */

    function importFromXml(text, name) {
        var doc, ex;
        try {
            doc = PUF.xml.parseXmlString(text);
            ex = PUF.xml.extractScenario(doc);
        } catch (err) {
            setupStatus("Could not parse " + (name || "file") + ": " + err.message, "error");
            return;
        }

        // The imported file becomes the global template, and sets the country.
        var ta = byId("global-template");
        if (ta) ta.value = text;
        if (ex.country) setGlobalCountry(ex.country);
        else updateGlobalTemplateLink();

        var s = PUF.scenarios.newScenario();
        s.scenarioNumber = ex.scenarioNumber || s.scenarioNumber;
        s.docType = ex.docType || "INVOICE";
        s.currency = ex.currency || "";
        s.issueDate = ex.issueDate || "";
        s.amount = ex.amount || "";
        s.payableAmount = ex.payableAmount || "";
        s.seller = mergeParty(s.seller, ex.seller);
        s.buyer = mergeParty(s.buyer, ex.buyer);

        setupStatus("Loaded " + (name || "file") + " as the template" + (ex.country ? " (" + ex.country + ")" : "") + ". Review the scenario and add it.", "info");
        PUF.scenarios.openEditorWith(s);
    }

    function mergeParty(base, parsed) {
        if (!parsed) return base;
        ["name", "legalName", "accountId", "street", "city", "postalZone", "region", "contactName", "contactEmail", "contactPhone"].forEach(function (k) {
            if (parsed[k]) base[k] = parsed[k];
        });
        base.ids = {};
        Object.keys(parsed.ids || {}).forEach(function (k) { if (parsed.ids[k]) base.ids[k] = parsed.ids[k]; });
        return base;
    }

    /* ------------------------------ settings ------------------------------ */

    function getSettings() {
        return {
            currency: (val("setting-currency") || "").toUpperCase() || "EUR",
            payableHandling: val("setting-payable") || "PAYABLE_OR_AMOUNT",
            fillTaxTotals: checked("setting-fill-tax"),
            filenameMode: val("setting-filename") || "scenario"
        };
    }

    /* ----------------------------- validation ----------------------------- */

    function validateScenario(s) {
        var errors = [];
        var warnings = [];

        if (!s.scenarioNumber || !s.scenarioNumber.trim()) errors.push("Scenario number is required.");
        if (!util.normaliseDate(s.issueDate)) errors.push("Issue date is missing or unrecognised (use YYYY-MM-DD).");
        if (!(s.seller && s.seller.name && s.seller.name.trim())) errors.push("Seller trading name is required.");
        if (!(s.buyer && s.buyer.name && s.buyer.name.trim())) errors.push("Buyer trading name is required.");
        if (s.docType === "CREDIT_NOTE" && !(s.originalInvoiceRef && s.originalInvoiceRef.trim())) {
            errors.push("A credit note requires the original invoice reference (BillingReference).");
        }

        if (s.amount && s.amount.trim() && !util.normaliseAmount(s.amount)) warnings.push("Amount is not a number.");
        if (!(s.amount && s.amount.trim())) warnings.push("No amount set — the template's amounts are kept.");

        // Tax-category business rules (BR-S / BR-Z / BR-E / BR-AE …) + Swedish rates.
        var taxCtx = {}; Object.keys(s).forEach(function (k) { taxCtx[k] = s[k]; }); taxCtx.country = globalCountry;
        warnings = warnings.concat(PUF.validate.taxCategoryIssues(taxCtx));

        // Identifier presence + format/check-digit validation.
        if (!globalCountry) warnings.push("No country set in Setup — identifier fields are generic.");
        else {
            checkParty("Seller", s.seller, warnings);
            checkParty("Buyer", s.buyer, warnings);
            warnings = warnings.concat(PUF.validate.identifierIssues(globalCountry, s.seller && s.seller.ids, "Seller"));
            warnings = warnings.concat(PUF.validate.identifierIssues(globalCountry, s.buyer && s.buyer.ids, "Buyer"));
            warnings = warnings.concat(PUF.countryRules.issues(globalCountry, s));
        }
        warnings = warnings.concat(PUF.validate.valueIssues(s, globalCountry));
        return { errors: errors, warnings: warnings };
    }

    function checkParty(role, party, warnings) {
        var anyId = party && party.ids && Object.keys(party.ids).some(function (k) { return (party.ids[k] || "").trim(); });
        if (!anyId) warnings.push(role + " has no identifiers.");
    }

    /* ------------------------------ generate ------------------------------ */

    function generate() {
        var list = PUF.scenarios.getScenarios();
        if (!list.length) { scenarioStatus("Add at least one scenario first.", "error"); return; }

        var template = getGlobalTemplate();
        if (!template || !template.trim()) {
            scenarioStatus("Add a template in the Setup section first (the country example from GitHub).", "error");
            return;
        }

        var settings = getSettings();
        var multiLine = (template.match(/<(?:[\w.-]+:)?(?:Invoice|CreditNote)Line\b/g) || []).length > 1;

        // Structural guard: the template root (<Invoice>/<CreditNote>) can't be
        // rewritten, so a scenario's document type must match it.
        var rt = PUF.validate.rootType(template);
        var rootLabel = rt === "CREDIT_NOTE" ? "<CreditNote>" : (rt === "INVOICE" ? "<Invoice>" : "the template");
        var mismatched = list.filter(function (s) { return !PUF.validate.rootMatchesDocType(rt, s.docType); })
            .map(function (s) { return s.scenarioNumber || "(unnamed)"; });
        if (mismatched.length) {
            scenarioStatus("Template root is " + rootLabel + ", but these scenarios are the other document type: " +
                mismatched.join(", ") + ". Use a matching template or change their document type.", "error");
            return;
        }

        generated = [];
        try {
            list.forEach(function (s) {
                var prepared = prepareScenario(s, settings);
                var xml = PUF.xml.generate(template, prepared);
                generated.push({ filename: createFilename(prepared, settings.filenameMode), xml: xml, country: prepared.country });
            });
        } catch (err) {
            scenarioStatus("Generation failed: " + err.message, "error");
            return;
        }

        showPreview(generated);
        var failed = postGenerationChecks(generated);
        var notes = [];
        if (!globalCountry) notes.push("no country set, identifiers may be generic");
        if (multiLine) notes.push("template has multiple lines, so amounts/tax were left to the template");
        var prof = PUF.validate.profileIssues(template);
        if (prof.length) notes.push(prof[0]);
        var msg = "Generated " + generated.length + " file(s). ";
        if (failed.length) {
            msg += "Checks flagged: " + failed.join("; ") + ".";
            if (notes.length) msg += " (" + notes.join("; ") + ")";
            scenarioStatus(msg, "warning");
        } else {
            msg += "Checks passed: well-formed, no leftover tokens, tax totals balance, currency consistent.";
            if (notes.length) msg += " Note: " + notes.join("; ") + ".";
            scenarioStatus(msg, "success");
        }
    }

    // Post-generation sanity checks. Returns a list of failed-check descriptions
    // (a check fails if it fails for any generated file).
    function postGenerationChecks(files) {
        var fails = {};
        files.forEach(function (f) {
            var xml = f.xml;
            if (xml.indexOf("{{") >= 0) fails["leftover {{ }} tokens"] = true;
            try { PUF.xml.parseXmlString(xml); } catch (e) { fails["not well-formed XML"] = true; }
            if (/<(?:[\w.-]+:)?ID>\s*<\//.test(xml)) fails["empty document ID"] = true;
            if (!/<(?:[\w.-]+:)?IssueDate>\s*\d{4}-\d{2}-\d{2}/.test(xml)) fails["missing/!ISO issue date"] = true;

            var docCur = firstText(xml, "DocumentCurrencyCode");
            var curIds = (xml.match(/currencyID="([^"]*)"/g) || []).map(function (m) { return m.slice(12, -1); });
            var mismatch = curIds.some(function (c) { return docCur && c !== docCur; });
            if (mismatch) fails["currency attributes don't all match DocumentCurrencyCode"] = true;

            var excl = firstAmount(xml, "TaxExclusiveAmount");
            var tax = firstAmount(xml, "TaxAmount");
            var incl = firstAmount(xml, "TaxInclusiveAmount");
            if (isFinite(excl) && isFinite(tax) && isFinite(incl) && Math.abs(excl + tax - incl) > 0.015) {
                fails["tax totals don't balance (excl + tax ≠ incl)"] = true;
            }
            if (/<(?:[\w.-]+:)?CreditNote\b/.test(xml) && !/<(?:[\w.-]+:)?BillingReference\b/.test(xml)) {
                fails["credit note missing BillingReference"] = true;
            }
            var schemeIssue = PUF.validate.taxSchemeIssue(xml, f.country);
            if (schemeIssue) fails[schemeIssue] = true;
        });
        return Object.keys(fails);
    }

    function firstText(xml, localName) {
        var m = new RegExp("<(?:[\\w.-]+:)?" + localName + "(?:\\s[^>]*)?>([^<]*)<").exec(xml);
        return m ? m[1].trim() : "";
    }
    function firstAmount(xml, localName) {
        var t = firstText(xml, localName);
        return t === "" ? NaN : parseFloat(t);
    }

    function prepareScenario(s, settings) {
        var dt = PUF_DATA.getDocumentType(s.docType);
        var currency = (s.currency || settings.currency || "EUR").toUpperCase();
        var country = (globalCountry || "").toUpperCase();

        var net = util.normaliseAmount(s.amount);
        var category = s.taxCategory || "S";
        var entered = (s.taxRate == null ? "" : String(s.taxRate)).trim();
        // Non-standard categories (Z/E/AE/K/G/O) carry a 0 rate and no tax; the
        // exemption reason is written instead (AE also implies excl = incl).
        var isStandard = category === "S";
        var rateNum = isStandard && isFinite(parseFloat(entered)) ? parseFloat(entered) : 0;
        var writtenRate = isStandard ? entered : "0";
        var tax = "", gross = "";
        if (net !== "") {
            var netNum = parseFloat(net);
            var taxNum = roundNum(netNum * rateNum / 100);
            tax = taxNum.toFixed(2);
            gross = roundNum(netNum + taxNum).toFixed(2);
        }
        var payable = resolvePayable(s, gross, settings.payableHandling);

        return {
            scenarioNumber: s.scenarioNumber.trim(),
            issueDate: util.normaliseDate(s.issueDate),
            currency: currency,
            typeCode: dt.typeCode,
            docLabel: dt.label,
            direction: s.direction === "GLOBAL" ? getGlobalDirection() : s.direction,
            country: country,
            // best-effort monetary inputs
            net: net,
            tax: tax,
            gross: gross,
            payable: payable,
            taxRate: writtenRate,
            taxCategory: category,
            taxExemptionReason: isStandard ? "" : (s.taxExemptionReason || "").trim(),
            originalInvoiceRef: s.docType === "CREDIT_NOTE" ? (s.originalInvoiceRef || "").trim() : "",
            fillTaxTotals: settings.fillTaxTotals,
            keepTemplatePayable: settings.payableHandling === "KEEP_TEMPLATE",
            // placeholder-mode aliases
            amount: net,
            payableAmount: payable,
            seller: prepareParty(s.seller, country),
            buyer: prepareParty(s.buyer, country)
        };
    }

    function prepareParty(party, country) {
        var p = {};
        Object.keys(party || {}).forEach(function (k) { p[k] = party[k]; });
        p.country = country;
        p.ids = {};
        Object.keys((party && party.ids) || {}).forEach(function (k) { p.ids[k] = party.ids[k]; });
        return p;
    }

    function roundNum(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

    function resolvePayable(s, gross, mode) {
        var explicit = util.normaliseAmount(s.payableAmount);
        switch (mode) {
            case "USE_AMOUNT": return gross;       // the document total incl. tax
            case "FORCE_ZERO": return "0.00";
            case "KEEP_TEMPLATE": return "";       // leave template (keepTemplatePayable handles it)
            default: return explicit || gross;     // PAYABLE_OR_AMOUNT
        }
    }

    function createFilename(prepared, mode) {
        var base = util.sanitiseFilename(prepared.scenarioNumber || "document");
        var sellerName = prepared.seller && prepared.seller.name ? util.sanitiseFilename(prepared.seller.name) : "";
        var buyerName = prepared.buyer && prepared.buyer.name ? util.sanitiseFilename(prepared.buyer.name) : "";
        var name = base;
        if (mode === "scenario_seller" && sellerName) name = base + "_" + sellerName;
        else if (mode === "scenario_buyer" && buyerName) name = base + "_" + buyerName;
        else if (mode === "scenario_both" && (sellerName || buyerName)) name = base + "_" + sellerName + "-to-" + buyerName;
        return name + ".xml";
    }

    /* ------------------------------ output -------------------------------- */

    function showPreview(files) {
        var pre = byId("preview");
        var info = byId("preview-info");
        var btn = byId("download-all");
        if (pre) pre.textContent = files.length ? files[0].xml : "";
        if (info) info.textContent = files.length
            ? "Showing " + files[0].filename + (files.length > 1 ? "  (+" + (files.length - 1) + " more)" : "")
            : "";
        if (btn) btn.disabled = files.length === 0;
    }

    function downloadAll() {
        if (!generated.length) return;
        generated.forEach(function (file, i) {
            setTimeout(function () { downloadText(file.filename, file.xml); }, i * 250);
        });
    }

    function downloadText(filename, text) {
        var blob = new Blob([text], { type: "application/xml" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    /* ---------------------------- modal (settings) ------------------------ */

    function openModal(modal) {
        if (!modal) return;
        modal._opener = document.activeElement;
        modal.removeAttribute("hidden");
        modal.classList.add("is-open");
        var f = modal.querySelector("button, input, select, textarea");
        if (f) f.focus();
    }
    function closeModal(modal) {
        if (!modal) return;
        modal.setAttribute("hidden", "hidden");
        modal.classList.remove("is-open");
        if (modal._opener && modal._opener.focus) modal._opener.focus();
    }
    function bindModalDismiss(modal) {
        if (!modal) return;
        modal.addEventListener("mousedown", function (e) { if (e.target === modal) closeModal(modal); });
    }

    /* ------------------------------ small utils --------------------------- */

    function val(id) { var n = byId(id); return n ? n.value : ""; }
    function checked(id) { var n = byId(id); return n ? !!n.checked : false; }
    function scenarioStatus(msg, type) { util.setStatus(byId("scenario-status"), msg, type); }
    function setupStatus(msg, type) { util.setStatus(byId("setup-status"), msg, type); }

    return {
        init: init,
        getSettings: getSettings,
        getGlobalCountry: getGlobalCountry,
        getGlobalTemplate: getGlobalTemplate,
        getGlobalDirection: getGlobalDirection,
        setGlobalCountry: setGlobalCountry,
        validateScenario: validateScenario,
        prepareScenario: prepareScenario,
        createFilename: createFilename
    };
})();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", PUF.app.init);
} else {
    PUF.app.init();
}