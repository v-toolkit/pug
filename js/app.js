"use strict";

/*
  js/app.js
  ---------
  Bootstraps the page and owns the GLOBAL setup (country, template, default
  direction) that applies to every scenario. Wires the top-level buttons,
  validates a scenario before it is added, runs generation (writing each
  scenario's values into the one global template) and handles downloads.
  Attached to window.PUG.app. Loaded last.
*/

window.PUG = window.PUG || {};

PUG.app = (function () {
    var util = PUG.util;
    var byId = util.byId;
    var generated = [];          // [{ filename, xml }]
    var globalCountry = "";      // updated by the Setup country picker

    var GITHUB_BASE = "https://github.com/pagero/puf-billing/tree/master/examples/country-specific-examples/";

    function init() {
        PUG.scenarios.init({
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
        PUG.scenarios.render();
        bindEvents();
    }

    /* ------------------------------- events ------------------------------- */

    function bindEvents() {
        on("add-scenario", "click", function () { PUG.scenarios.openEditor("add"); });
        on("clear-scenarios", "click", function () {
            if (PUG.scenarios.getScenarios().length && !confirm("Remove all scenarios?")) return;
            PUG.scenarios.clear();
        });
        on("generate", "click", generate);
        on("download-all", "click", downloadAll);

        // Global setup.
        on("global-direction", "change", function () { PUG.scenarios.render(); });
        bindFile("global-template-file", function (text) {
            var ta = byId("global-template");
            if (ta) ta.value = text;
            setupStatus("Loaded template file.", "info");
        });
        bindFile("xml-import-file", importFromXml);

        // Example picker (online enhancement; no-ops when fetch is unavailable).
        on("example-select", "change", function () {
            var sel = byId("example-select");
            if (sel) loadExampleByIndex(parseInt(sel.value, 10) || 0);
        });
        on("example-load", "click", function () {
            var sel = byId("example-select");
            if (sel) loadExampleByIndex(parseInt(sel.value, 10) || 0);
        });
        on("example-add-scenario", "click", addScenarioFromExample);

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
        PUG.scenarios.countryControl(host, globalCountry, function (code) {
            globalCountry = code;
            updateGlobalTemplateLink();
            if (PUG.scenarios.refreshCountry) PUG.scenarios.refreshCountry();
            refreshExamples();
        });
    }

    function setGlobalCountry(code) {
        globalCountry = code || "";
        mountGlobalCountry();
        updateGlobalTemplateLink();
        if (PUG.scenarios.refreshCountry) PUG.scenarios.refreshCountry();
        refreshExamples();
    }

    function updateGlobalTemplateLink() {
        var link = byId("global-template-link");
        if (!link) return;
        var c = globalCountry ? PUG_DATA.countriesByCode[globalCountry] : null;
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

    /* --------------------------- example loading -------------------------- */

    function currentFolder() {
        var c = globalCountry ? PUG_DATA.countriesByCode[globalCountry] : null;
        return (c && c.folder) || "";
    }
    function exampleStatus(msg, kind) {
        var n = byId("example-status");
        if (!n) return;
        n.textContent = msg || "";
        n.className = "field-hint" + (kind ? " is-" + kind : "");
    }
    function hideExamples() {
        var host = byId("example-host");
        if (host) host.setAttribute("hidden", "");
        var sel = byId("example-select");
        if (sel) { sel.innerHTML = ""; sel._entries = null; }
    }
    // Populate the picker for the current country. Auto-loads a default example
    // only when the template box is empty (never clobbers a pasted/edited one).
    function refreshExamples() {
        var host = byId("example-host");
        var sel = byId("example-select");
        if (!host || !sel || !PUG.examples) return Promise.resolve();
        var folder = currentFolder();
        if (!folder || !PUG.examples.available()) { hideExamples(); return Promise.resolve(); }
        return PUG.examples.forFolder(folder).then(function (entries) {
            if (!entries || !entries.length) { hideExamples(); return; }
            sel.innerHTML = "";
            entries.forEach(function (e, i) {
                var o = document.createElement("option");
                o.value = String(i);
                o.textContent = e.label + (e.kind === "creditnote" ? " — credit note" : "");
                sel.appendChild(o);
            });
            sel._entries = entries;
            var def = PUG.examples.defaultEntry(entries);
            var defIdx = def ? entries.indexOf(def) : 0;
            if (defIdx < 0) defIdx = 0;
            sel.value = String(defIdx);
            host.removeAttribute("hidden");
            var ta = byId("global-template");
            if (ta && !ta.value.trim()) return loadExampleByIndex(defIdx);
            exampleStatus(entries.length + " example" + (entries.length > 1 ? "s" : "") + " available — pick one to load it (replaces the template below).");
        }).catch(function () { hideExamples(); });
    }
    function loadExampleByIndex(i) {
        var sel = byId("example-select");
        var ta = byId("global-template");
        if (!sel || !ta || !sel._entries) return Promise.resolve();
        var e = sel._entries[i];
        if (!e) return Promise.resolve();
        exampleStatus("Loading " + e.label + "…");
        return PUG.examples.fetchText(e.href).then(function (text) {
            ta.value = text;
            exampleStatus("Loaded " + e.label + ". Edit below, or pick another to replace it.", "ok");
            setupStatus("Loaded example: " + e.label + ".", "info");
        }).catch(function (err) {
            exampleStatus("Couldn't fetch that example (" + ((err && err.message) || "network") + "). Copy it from GitHub and paste below.", "error");
        });
    }

    /* --------------------------- import from file ------------------------- */

    // Build a fully-seeded scenario from an extracted example, carrying its own
    // template + country + lines + France fields. Shared by file import and the
    // "add scenario from example" flow.
    function scenarioFromExtract(ex, templateText) {
        var s = PUG.scenarios.newScenario();
        s.template = templateText || "";
        s.country = ex.country || getGlobalCountry() || "";
        s.scenarioNumber = ex.scenarioNumber || s.scenarioNumber;
        s.docType = ex.docType || "INVOICE";
        s.currency = ex.currency || "";
        s.issueDate = ex.issueDate || "";
        s.amount = ex.amount || "";
        s.payableAmount = ex.payableAmount || "";
        if (ex.businessProcess) s.businessProcess = ex.businessProcess;
        if (ex.invoicingContext) s.invoicingContext = ex.invoicingContext;
        if (ex.notes && ex.notes.length) s.notes = ex.notes.map(function (n) { return { code: n.code, value: n.value }; });
        if (ex.lines && ex.lines.length) {
            s.lines = ex.lines.map(function (l) {
                return { name: l.name || "", description: l.description || "", quantity: l.quantity || "1", unitCode: l.unitCode || "", unitPrice: l.unitPrice || "", taxCategory: l.taxCategory || "S", rate: l.rate || "" };
            });
        }
        s.seller = mergeParty(s.seller, ex.seller);
        s.buyer = mergeParty(s.buyer, ex.buyer);
        return s;
    }

    function importFromXml(text, name) {
        var doc, ex;
        try {
            doc = PUG.xml.parseXmlString(text);
            ex = PUG.xml.extractScenario(doc);
        } catch (err) {
            setupStatus("Could not parse " + (name || "file") + ": " + err.message, "error");
            return;
        }

        // Also keep it as the Setup template default + reflect the country.
        var ta = byId("global-template");
        if (ta) ta.value = text;
        if (ex.country) setGlobalCountry(ex.country);
        else updateGlobalTemplateLink();

        var s = scenarioFromExtract(ex, text);
        setupStatus("Loaded " + (name || "file") + " as a scenario" + (ex.country ? " (" + ex.country + ")" : "") + ". Review it and add it.", "info");
        PUG.scenarios.openEditorWith(s);
    }

    // Seed a brand-new scenario from the example currently chosen in the picker.
    function addScenarioFromExample() {
        var sel = byId("example-select");
        if (!sel || !sel._entries || !sel._entries.length) { setupStatus("Pick a country with examples first.", "error"); return; }
        var e = sel._entries[parseInt(sel.value, 10) || 0];
        if (!e) return;
        exampleStatus("Loading " + e.label + "…");
        return PUG.examples.fetchText(e.href).then(function (text) {
            var ex = PUG.xml.extractScenario(PUG.xml.parseXmlString(text));
            if (!ex.country) ex.country = getGlobalCountry();
            var s = scenarioFromExtract(ex, text);
            exampleStatus("Added " + e.label + " as a scenario — edit and add it.", "ok");
            PUG.scenarios.openEditorWith(s);
        }).catch(function (err) {
            exampleStatus("Couldn't fetch that example (" + ((err && err.message) || "network") + ").", "error");
        });
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

        var hasLineAmount = (s.lines || []).some(function (l) { return l && util.normaliseAmount(l.unitPrice) !== ""; });
        if (!hasLineAmount && !(s.amount && s.amount.trim())) warnings.push("No line amounts set — the template's amounts are kept.");

        // Tax-category business rules (BR-S / BR-Z / BR-E / BR-AE …) + Swedish rates.
        var taxCtx = {}; Object.keys(s).forEach(function (k) { taxCtx[k] = s[k]; }); taxCtx.country = globalCountry;
        warnings = warnings.concat(PUG.validate.taxCategoryIssues(taxCtx));

        // Identifier presence + format/check-digit validation.
        if (!globalCountry) warnings.push("No country set in Setup — identifier fields are generic.");
        else {
            checkParty("Seller", s.seller, warnings);
            checkParty("Buyer", s.buyer, warnings);
            warnings = warnings.concat(PUG.validate.identifierIssues(globalCountry, s.seller && s.seller.ids, "Seller"));
            warnings = warnings.concat(PUG.validate.identifierIssues(globalCountry, s.buyer && s.buyer.ids, "Buyer"));
            warnings = warnings.concat(PUG.countryRules.issues(globalCountry, s));
        }
        warnings = warnings.concat(PUG.validate.valueIssues(s, globalCountry));
        return { errors: errors, warnings: warnings };
    }

    function checkParty(role, party, warnings) {
        var anyId = party && party.ids && Object.keys(party.ids).some(function (k) { return (party.ids[k] || "").trim(); });
        if (!anyId) warnings.push(role + " has no identifiers.");
    }

    /* ------------------------------ generate ------------------------------ */

    function generate() {
        var list = PUG.scenarios.getScenarios();
        if (!list.length) { scenarioStatus("Add at least one scenario first.", "error"); return; }

        var settings = getSettings();
        var globalTpl = getGlobalTemplate();
        function templateFor(s) { return (s.template && s.template.trim()) ? s.template : globalTpl; }

        // Each scenario uses its own example template (or the Setup template as a
        // fallback). Validate presence + root/document-type match per scenario.
        var noTemplate = [], mismatched = [];
        list.forEach(function (s) {
            var tpl = templateFor(s);
            if (!tpl || !tpl.trim()) { noTemplate.push(s.scenarioNumber || "(unnamed)"); return; }
            var rt = PUG.validate.rootType(tpl);
            if (!PUG.validate.rootMatchesDocType(rt, s.docType)) {
                mismatched.push((s.scenarioNumber || "(unnamed)") + " needs " + (rt === "CREDIT_NOTE" ? "<CreditNote>" : "<Invoice>"));
            }
        });
        if (noTemplate.length) {
            scenarioStatus("No template for: " + noTemplate.join(", ") + ". Seed them from an example, or add a Setup template.", "error");
            return;
        }
        if (mismatched.length) {
            scenarioStatus("Document type doesn't match the template root — " + mismatched.join("; ") + ". Change their document type or template.", "error");
            return;
        }

        generated = [];
        try {
            list.forEach(function (s) {
                var prepared = prepareScenario(s, settings);
                var xml = PUG.xml.generate(templateFor(s), prepared);
                generated.push({ filename: createFilename(prepared, settings.filenameMode), xml: xml, country: prepared.country });
            });
        } catch (err) {
            scenarioStatus("Generation failed: " + err.message, "error");
            return;
        }
        var firstTpl = list.length ? templateFor(list[0]) : globalTpl;

        showPreview(generated);
        var failed = postGenerationChecks(generated);
        var notes = [];
        var prof = PUG.validate.profileIssues(firstTpl);
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
            try { PUG.xml.parseXmlString(xml); } catch (e) { fails["not well-formed XML"] = true; }
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
            var schemeIssue = PUG.validate.taxSchemeIssue(xml, f.country);
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
        var dt = PUG_DATA.getDocumentType(s.docType);
        var currency = (s.currency || settings.currency || "EUR").toUpperCase();
        var country = ((s.country || globalCountry) || "").toUpperCase();

        var docExemption = (s.taxExemptionReason || "").trim();

        // Effective lines: prefer explicit lines with a price; otherwise fall
        // back to a single line synthesised from a legacy "amount" (imports).
        var rawLines = (s.lines || []).filter(function (l) {
            return l && util.normaliseAmount(l.unitPrice) !== "";
        });
        if (!rawLines.length && util.normaliseAmount(s.amount) !== "") {
            rawLines = [{ name: "", description: "", quantity: "1", unitCode: "", unitPrice: s.amount, taxCategory: s.taxCategory || "S", rate: s.taxRate }];
        }

        var lines = rawLines.map(function (l) {
            var category = l.taxCategory || "S";
            var isStandard = category === "S";
            var qtyNum = parseFloat(l.quantity); if (!isFinite(qtyNum)) qtyNum = 1;
            var priceNum = parseFloat(util.normaliseAmount(l.unitPrice)); if (!isFinite(priceNum)) priceNum = 0;
            var netNum = roundNum(qtyNum * priceNum);
            var enteredRate = (l.rate == null ? "" : String(l.rate)).trim();
            var writtenRate = isStandard ? enteredRate : "0";
            return {
                name: (l.name || "").trim(),
                description: (l.description || "").trim(),
                quantity: (l.quantity == null || String(l.quantity).trim() === "") ? "1" : String(l.quantity).trim(),
                unitCode: (l.unitCode || "").trim(),
                unitPrice: priceNum.toFixed(2),
                net: netNum.toFixed(2),
                taxCategory: category,
                rate: writtenRate
            };
        });

        // Group lines into tax subtotals by (category, written rate).
        var byKey = {}, order = [];
        lines.forEach(function (ln) {
            var key = ln.taxCategory + "|" + ln.rate;
            if (!byKey[key]) { byKey[key] = { category: ln.taxCategory, rate: ln.rate, taxableNum: 0 }; order.push(key); }
            byKey[key].taxableNum += parseFloat(ln.net);
        });
        var taxGroups = order.map(function (key) {
            var g = byKey[key];
            var taxable = roundNum(g.taxableNum);
            var isStandard = g.category === "S";
            var rateNum = isStandard && isFinite(parseFloat(g.rate)) ? parseFloat(g.rate) : 0;
            var tax = roundNum(taxable * rateNum / 100);
            return { category: g.category, rate: g.rate, taxable: taxable.toFixed(2), tax: tax.toFixed(2) };
        });

        var lineExtNum = lines.reduce(function (a, ln) { return a + parseFloat(ln.net); }, 0);
        var taxNum = taxGroups.reduce(function (a, g) { return a + parseFloat(g.tax); }, 0);
        var net = lines.length ? roundNum(lineExtNum).toFixed(2) : "";
        var tax = lines.length ? roundNum(taxNum).toFixed(2) : "";
        var gross = lines.length ? roundNum(lineExtNum + taxNum).toFixed(2) : "";

        var payable = resolvePayable(s, gross, settings.payableHandling);

        // Aggregates for the single-line / legacy code path.
        var firstCat = lines.length ? lines[0].taxCategory : (s.taxCategory || "S");
        var firstRate = lines.length ? lines[0].rate : (firstCat === "S" ? (s.taxRate || "") : "0");

        // France-specific document fields (business process + coded notes).
        var isFrance = country === "FR";
        var frBarMap = { DOMESTIC: "B2B", CROSSBORDER: "B2BINT", B2C: "B2C" };
        var frNotes = [];
        if (isFrance) {
            frNotes = (s.notes || []).filter(function (n) { return n && n.value != null && String(n.value).trim() !== ""; })
                .map(function (n) { return { code: (n.code || "").trim(), value: String(n.value) }; });
            if (!frNotes.some(function (n) { return n.code === "BAR"; })) {
                frNotes.push({ code: "BAR", value: frBarMap[s.invoicingContext] || "B2B" });
            }
        }

        return {
            scenarioNumber: s.scenarioNumber.trim(),
            issueDate: util.normaliseDate(s.issueDate),
            currency: currency,
            typeCode: dt.typeCode,
            docLabel: dt.label,
            direction: s.direction === "GLOBAL" ? getGlobalDirection() : s.direction,
            country: country,
            // best-effort monetary inputs (aggregate)
            net: net,
            tax: tax,
            gross: gross,
            payable: payable,
            taxRate: firstRate,
            taxCategory: firstCat,
            taxExemptionReason: (firstCat === "S") ? "" : docExemption,
            // multi-line model (used by the generator's line rebuild)
            lines: lines.map(function (ln, i) {
                return { id: i + 1, name: ln.name, description: ln.description, quantity: ln.quantity, unitCode: ln.unitCode, unitPrice: ln.unitPrice, net: ln.net, taxCategory: ln.taxCategory, rate: ln.rate };
            }),
            taxGroups: taxGroups,
            docExemptionReason: docExemption,
            originalInvoiceRef: s.docType === "CREDIT_NOTE" ? (s.originalInvoiceRef || "").trim() : "",
            businessProcess: isFrance ? (s.businessProcess || "B1") : "",
            notes: frNotes,
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
        refreshExamples: refreshExamples,
        getGlobalDirection: getGlobalDirection,
        setGlobalCountry: setGlobalCountry,
        validateScenario: validateScenario,
        prepareScenario: prepareScenario,
        createFilename: createFilename
    };
})();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", PUG.app.init);
} else {
    PUG.app.init();
}