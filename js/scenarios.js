"use strict";

/*
  js/scenarios.js
  ---------------
  Owns the list of completed scenarios and the editor modal.

  Country, template and the default direction are GLOBAL (set in the Setup
  section above the table, owned by app.js). The editor therefore does not let
  you choose a country or a template per scenario: it shows the global country
  read-only, and each party's identifier fields follow that global country.
  Direction can be left on "Global" or overridden per scenario.

  A scenario is committed only once it passes validation, at which point it
  appears as a read-only row. "Add scenario" / "Edit" (re)opens the editor.

  Attached to window.PUG.scenarios.
*/

window.PUG = window.PUG || {};

PUG.scenarios = (function () {
    var util = PUG.util;

    var scenarios = [];          // committed scenarios (source of truth)
    var refs = {};               // DOM references (set in init)

    // Editor working state.
    var working = null;
    var editMode = "add";
    var editId = null;
    var partiesHost = null;      // re-rendered when the global country changes
    var countryDisplayEl = null; // read-only country line in the editor
    var editorIssuesEl = null;   // live validation summary in the editor

    /* --------------------------------- init ------------------------------- */

    function init(elements) {
        refs = elements;
        if (refs.saveBtn) refs.saveBtn.addEventListener("click", onSave);
        if (refs.cancelBtn) refs.cancelBtn.addEventListener("click", closeEditor);
        if (refs.closeBtn) refs.closeBtn.addEventListener("click", closeEditor);
        if (refs.modal) {
            refs.modal.addEventListener("mousedown", function (e) {
                if (e.target === refs.modal) closeEditor();
            });
        }
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && refs.modal && !refs.modal.hasAttribute("hidden")) closeEditor();
        });
    }

    /* --------------------------------- state ------------------------------ */

    function getScenarios() { return scenarios; }
    function setScenarios(list) { scenarios = list || []; render(); }
    function clear() { scenarios = []; render(); }
    function removeScenario(id) {
        scenarios = scenarios.filter(function (s) { return s.id !== id; });
        render();
    }

    function newScenario() {
        var gc = globalCountry();
        return {
            id: util.uid("s"),
            scenarioNumber: "",
            template: "",
            templateName: "",
            templateHref: "",
            templateFile: "",
            country: "",
            direction: "GLOBAL",
            docType: "INVOICE",
            currency: PUG_DATA.defaultCurrencyFor(gc),
            issueDate: "",
            amount: "",
            payableAmount: "",
            taxRate: PUG_DATA.defaultTaxRateFor(gc),
            taxCategory: "S",
            taxExemptionReason: "",
            originalInvoiceRef: "",
            invoicingContext: "DOMESTIC",
            businessProcess: "B1",
            notes: [],
            lines: [newLine()],
            seller: newParty(),
            buyer: newParty()
        };
    }

    function newLine() {
        var gc = globalCountry();
        return {
            name: "", description: "", quantity: "1", unitCode: "",
            unitPrice: "", taxCategory: "S", rate: PUG_DATA.defaultTaxRateFor(gc)
        };
    }

    // Guarantee at least one line, and seed a line from a legacy single "amount"
    // (e.g. a scenario produced by import) so it appears as an editable line.
    function ensureLines(s) {
        if (!s.lines || !s.lines.length) s.lines = [newLine()];
        var anyPrice = s.lines.some(function (l) { return l && String(l.unitPrice == null ? "" : l.unitPrice).trim() !== ""; });
        if (!anyPrice && s.amount != null && String(s.amount).trim() !== "") {
            s.lines[0].unitPrice = s.amount;
            if (s.taxRate) s.lines[0].rate = s.taxRate;
            if (s.taxCategory) s.lines[0].taxCategory = s.taxCategory;
        }
    }

    function newParty() {
        return {
            name: "", legalName: "", ids: {}, accountId: "",
            street: "", city: "", postalZone: "", region: "",
            contactName: "", contactEmail: "", contactPhone: ""
        };
    }

    function cloneScenario(s) { return JSON.parse(JSON.stringify(s)); }

    function globalCountry() { return (PUG.app && PUG.app.getGlobalCountry) ? PUG.app.getGlobalCountry() : ""; }
    function scenarioCountry() { return (working && working.country) ? working.country : globalCountry(); }
    function globalDirection() { return (PUG.app && PUG.app.getGlobalDirection) ? PUG.app.getGlobalDirection() : "AR"; }
    function resolveDirection(s) { return s.direction === "GLOBAL" ? globalDirection() : s.direction; }

    /* ------------------------------ table (view) -------------------------- */

    function render() {
        var tbody = refs.tbody;
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!scenarios.length) {
            var tr = el("tr", { class: "empty-row" });
            var td = el("td", { colspan: "7", class: "empty-cell" });
            td.textContent = "No scenarios yet. Click “Add scenario” to create one.";
            tr.appendChild(td);
            tbody.appendChild(tr);
            updateCount();
            return;
        }

        scenarios.forEach(function (s) { tbody.appendChild(renderViewRow(s)); });
        updateCount();
    }

    function updateCount() {
        var label = util.byId("scenario-count");
        if (!label) return;
        var n = scenarios.length;
        label.textContent = n === 0 ? "" : n + (n === 1 ? " scenario" : " scenarios");
    }

    function renderViewRow(s) {
        var tr = el("tr", { "data-id": s.id });

        var idCell = el("td");
        idCell.appendChild(document.createTextNode(s.scenarioNumber || "—"));
        var warnings = (PUG.app.validateScenario(s) || {}).warnings || [];
        if (warnings.length) {
            var badge = el("span", { class: "warn-badge", title: warnings.join("\n") });
            badge.textContent = "⚠ " + warnings.length;
            idCell.appendChild(badge);
        }
        tr.appendChild(idCell);

        tr.appendChild(tdText(directionLabel(s)));
        tr.appendChild(tdText(docTypeLabel(s.docType)));
        tr.appendChild(tdText(s.issueDate || "—"));
        tr.appendChild(tdText(displayAmount(s)));
        tr.appendChild(tdText(partySummary(s)));

        var actions = el("div", { class: "row-actions" });
        actions.appendChild(button("Edit", "btn btn--small", function () { openEditor("edit", s.id); }));
        actions.appendChild(button("Duplicate", "btn btn--small btn--ghost", function () { duplicateScenario(s.id); }));
        var del = button("✕", "btn btn--small btn--ghost", function () { removeScenario(s.id); });
        del.setAttribute("title", "Remove scenario");
        actions.appendChild(del);
        tr.appendChild(cell(actions, "actions-cell"));
        return tr;
    }

    // Deep-copy a committed scenario into a new editable row just below it.
    function duplicateScenario(id) {
        var idx = scenarios.findIndex(function (s) { return s.id === id; });
        if (idx < 0) return;
        var copy = cloneScenario(scenarios[idx]);
        copy.id = util.uid("s");
        if (copy.scenarioNumber && copy.scenarioNumber.trim()) copy.scenarioNumber = copy.scenarioNumber + " (copy)";
        scenarios.splice(idx + 1, 0, copy);
        render();
    }

    function directionLabel(s) {
        var d = resolveDirection(s);
        return s.direction === "GLOBAL" ? d + " (global)" : d;
    }
    function docTypeLabel(key) {
        var dt = PUG_DATA.getDocumentType(key);
        return dt ? dt.label : key;
    }
    function partySummary(s) {
        var sName = (s.seller && s.seller.name) || "—";
        var bName = (s.buyer && s.buyer.name) || "—";
        return sName + " → " + bName;
    }

    // Sum of line nets for the scenario table (falls back to a legacy amount).
    function displayAmount(s) {
        var lines = (s && s.lines) || [];
        var total = 0, any = false;
        lines.forEach(function (l) {
            var p = parseFloat(util.normaliseAmount(l.unitPrice));
            if (!isFinite(p)) return;
            var q = parseFloat(l.quantity); if (!isFinite(q)) q = 1;
            total += q * p; any = true;
        });
        if (any) return total.toFixed(2);
        return (s && s.amount && String(s.amount).trim()) ? s.amount : "—";
    }

    /* -------------------------------- editor ------------------------------ */

    function openEditor(mode, id) {
        editMode = mode;
        editId = id || null;
        working = mode === "edit"
            ? cloneScenario(scenarios.find(function (s) { return s.id === id; }))
            : newScenario();
        ensureLines(working);
        showEditor(mode === "edit" ? "Edit scenario" : "Add scenario",
            mode === "edit" ? "Save changes" : "Add scenario");
    }

    // Open the editor pre-filled with an already-built scenario (used by import).
    function openEditorWith(scenarioData) {
        editMode = "add";
        editId = null;
        working = scenarioData;
        ensureLines(working);
        showEditor("Add scenario (imported)", "Add scenario");
    }

    function showEditor(title, saveLabel) {
        buildEditorBody(working);
        if (refs.title) refs.title.textContent = title;
        if (refs.saveBtn) refs.saveBtn.textContent = saveLabel;
        setErrors("");
        showModal(refs.modal);
        focusFirst(refs.body);
    }

    function onSave() {
        var result = PUG.app.validateScenario(working);
        if (result.errors.length) { setErrors(result.errors.join(" ")); return; }

        if (editMode === "edit") {
            var idx = scenarios.findIndex(function (s) { return s.id === editId; });
            if (idx >= 0) scenarios[idx] = working; else scenarios.push(working);
        } else {
            scenarios.push(working);
        }
        hideModal(refs.modal);
        working = null;
        render();
    }

    function closeEditor() {
        hideModal(refs.modal);
        working = null;
    }

    function setErrors(message) {
        if (refs.errors) refs.errors.textContent = message || "";
    }

    function buildEditorBody(s) {
        var body = refs.body;
        body.innerHTML = "";
        editorIssuesEl = el("div", { class: "issues-panel", hidden: "hidden" });
        body.appendChild(editorIssuesEl);
        body.appendChild(templateSection(s));
        body.appendChild(documentSection(s));
        if (scenarioCountry() === "FR") body.appendChild(franceSection(s));
        body.appendChild(linesSection(s));
        body.appendChild(partiesSection(s));
        if (!body._issuesBound) {
            body.addEventListener("input", function () { renderIssues(working); });
            body.addEventListener("change", function () { renderIssues(working); });
            body._issuesBound = true;
        }
        renderIssues(s);
    }

    // Live validation summary inside the editor (non-blocking; errors still
    // block on Save). Updates as the user edits.
    function renderIssues(s) {
        if (!editorIssuesEl || !s) return;
        var res = PUG.app.validateScenario(s);
        editorIssuesEl.innerHTML = "";
        if (!res.errors.length && !res.warnings.length) {
            editorIssuesEl.setAttribute("hidden", "hidden");
            return;
        }
        editorIssuesEl.removeAttribute("hidden");
        if (res.errors.length) editorIssuesEl.appendChild(issueGroup("Required", res.errors, "issues-group--error"));
        if (res.warnings.length) editorIssuesEl.appendChild(issueGroup("May cause rejection", res.warnings, "issues-group--warn"));
    }

    function issueGroup(title, items, cls) {
        var box = el("div", { class: "issues-group " + cls });
        box.appendChild(elText("p", title, "issues-group__title"));
        var ul = el("ul", { class: "issues-list" });
        items.forEach(function (msg) {
            var li = el("li"); li.textContent = msg; ul.appendChild(li);
        });
        box.appendChild(ul);
        return box;
    }

    function templateSection(s) {
        var box = el("div", { class: "editor-section" });
        box.appendChild(elText("h3", "Template", "editor-section__title"));

        var srcLabel = el("div", { class: "readonly-value" });
        srcLabel.textContent = s.templateName
            ? ("Based on: " + s.templateName)
            : ((s.template && s.template.trim()) ? "This scenario has its own template." : "Using the Setup template.");
        box.appendChild(srcLabel);

        var code = scenarioCountry();
        var country = (code && PUG_DATA.countriesByCode[code]) ? PUG_DATA.countriesByCode[code] : null;
        var folder = country ? country.folder : "";

        if (PUG.examples && PUG.examples.available() && folder) {
            box.appendChild(fieldLabel("Swap to another " + (country ? country.name : code) + " example (keeps your values)"));
            var controls = el("div", { class: "example-host__controls" });
            var sel = el("select", { class: "field example-select" });
            var status = el("p", { class: "field-hint" });
            var useBtn = button("Use this example", "btn btn--ghost", function () {
                if (!sel._entries || !sel._entries.length) return;
                var e = sel._entries[parseInt(sel.value, 10) || 0];
                if (!e) return;
                status.textContent = "Loading " + e.label + "…";
                PUG.examples.fetchText(e.href).then(function (xml) {
                    s.template = xml;
                    s.country = code;
                    s.templateName = e.label;
                    s.templateHref = e.href || "";
                    s.templateFile = e.file || "";
                    buildEditorBody(s); // rebuild; values live on the scenario, so they persist
                }).catch(function (err) {
                    status.textContent = "Couldn't fetch that example (" + ((err && err.message) || "network") + ").";
                });
            });
            controls.appendChild(sel);
            controls.appendChild(useBtn);
            box.appendChild(controls);
            box.appendChild(status);
            PUG.examples.forFolder(folder).then(function (entries) {
                entries = entries || [];
                sel.innerHTML = "";
                entries.forEach(function (e, i) {
                    var o = el("option", { value: String(i) });
                    o.textContent = e.label + (e.kind === "creditnote" ? " — credit note" : "");
                    sel.appendChild(o);
                });
                sel._entries = entries;
                // Reflect the scenario's current example so the dropdown doesn't
                // snap back to the first option after a rebuild.
                var idx = matchExampleIndex(entries, s);
                if (idx < 0 && !(s.template && s.template.trim())) {
                    // No per-scenario template yet: reflect the Setup-selected
                    // example — the template this scenario falls back to at
                    // generation — instead of defaulting to the first option.
                    var setupSel = document.getElementById("example-select");
                    var sidx = (setupSel && setupSel.value !== "") ? parseInt(setupSel.value, 10) : -1;
                    if (sidx >= 0 && sidx < entries.length) {
                        idx = sidx;
                        srcLabel.textContent = "Using the Setup template: " + entries[idx].label;
                    }
                }
                if (idx >= 0 && idx < entries.length) sel.value = String(idx);
            }).catch(function () { });
        } else {
            box.appendChild(elText("p", "Load examples from Setup (needs to be online). Offline, this scenario uses the Setup template.", "field-hint"));
        }
        return box;
    }

    // Which manifest entry is this scenario currently based on? Match by href,
    // then file, then label. Returns -1 when the template isn't a known example.
    function matchExampleIndex(entries, s) {
        var i;
        for (i = 0; i < entries.length; i += 1) { if (s.templateHref && entries[i].href === s.templateHref) return i; }
        for (i = 0; i < entries.length; i += 1) { if (s.templateFile && entries[i].file === s.templateFile) return i; }
        for (i = 0; i < entries.length; i += 1) { if (s.templateName && entries[i].label === s.templateName) return i; }
        return -1;
    }

    function documentSection(s) {
        var box = el("div", { class: "editor-section" });
        box.appendChild(elText("h3", "Document", "editor-section__title"));

        var grid = el("div", { class: "editor-grid" });
        grid.appendChild(field("Scenario number", textInput(s.scenarioNumber, "INV-001", function (v) { s.scenarioNumber = v; })));
        grid.appendChild(field("Direction", select([
            { value: "GLOBAL", label: "Global (default)" },
            { value: "AR", label: "AR (I sell)" },
            { value: "AP", label: "AP (I buy)" }
        ], s.direction, function (v) { s.direction = v; })));

        // Conditional field: only for credit notes.
        var billingField = field("Original invoice ref", textInput(s.originalInvoiceRef, "Number of the invoice being credited", function (v) { s.originalInvoiceRef = v; }));

        var docOpts = PUG_DATA.enabledDocumentTypes().map(function (t) { return { value: t.key, label: t.label }; });
        grid.appendChild(field("Document type", select(docOpts, s.docType, function (v) {
            s.docType = v;
            toggle(billingField, v === "CREDIT_NOTE");
        })));

        grid.appendChild(countryField());

        grid.appendChild(field("Currency", textInput(s.currency, "EUR (used if blank)", function (v) { s.currency = v; })));
        grid.appendChild(field("Issue date", textInput(s.issueDate, "YYYY-MM-DD", function (v) { s.issueDate = v; })));

        // Document-level tax exemption reason (used for reverse-charge / exempt lines).
        var exemptionField = field("Tax exemption reason", textInput(s.taxExemptionReason, "e.g. Reverse charge — Article 196", function (v) { s.taxExemptionReason = v; }));

        grid.appendChild(field("Payable", textInput(s.payableAmount, "(defaults to total incl. tax)", function (v) { s.payableAmount = v; })));

        grid.appendChild(exemptionField);
        grid.appendChild(billingField);
        toggle(billingField, s.docType === "CREDIT_NOTE");

        box.appendChild(grid);
        return box;
    }

    /* -------------------------------- lines ------------------------------- */

    var TAX_CATEGORY_OPTIONS = [
        { value: "S", label: "S — Standard rate" },
        { value: "Z", label: "Z — Zero rated" },
        { value: "E", label: "E — Exempt" },
        { value: "AE", label: "AE — Reverse charge" },
        { value: "K", label: "K — Intra-community" },
        { value: "G", label: "G — Export (outside EU)" },
        { value: "O", label: "O — Outside scope of VAT" }
    ];

    function linesSection(s) {
        if (!s.lines || !s.lines.length) s.lines = [newLine()];
        var box = el("div", { class: "editor-section" });
        box.appendChild(elText("h3", "Lines", "editor-section__title"));
        var host = el("div", { class: "lines-host" });
        box.appendChild(host);
        var add = button("+ Add line", "btn btn--secondary btn--small", function () {
            s.lines.push(newLine());
            renderLines(s, host);
            renderIssues(working);
        });
        box.appendChild(add);
        renderLines(s, host);
        return box;
    }

    function renderLines(s, host) {
        host.innerHTML = "";
        s.lines.forEach(function (line, i) { host.appendChild(lineRow(s, line, i, host)); });
    }

    function lineRow(s, line, index, host) {
        var row = el("div", { class: "line-row" });

        var head = el("div", { class: "line-row__head" });
        head.appendChild(elText("span", "Line " + (index + 1), "line-row__title"));
        var rm = button("✕", "btn btn--small btn--ghost", function () {
            s.lines.splice(index, 1);
            if (!s.lines.length) s.lines.push(newLine());
            renderLines(s, host);
            renderIssues(working);
        });
        rm.setAttribute("title", "Remove line");
        head.appendChild(rm);
        row.appendChild(head);

        var grid = el("div", { class: "editor-grid" });
        grid.appendChild(field("Item name", textInput(line.name, "Item name", function (v) { line.name = v; })));
        grid.appendChild(field("Description", textInput(line.description, "Optional", function (v) { line.description = v; })));
        grid.appendChild(field("Quantity", textInput(line.quantity, "1", function (v) { line.quantity = v; })));
        grid.appendChild(field("Unit price (net)", textInput(line.unitPrice, "0.00", function (v) { line.unitPrice = v; })));
        grid.appendChild(field("Tax category", select(TAX_CATEGORY_OPTIONS, line.taxCategory || "S", function (v) { line.taxCategory = v; renderIssues(working); })));
        grid.appendChild(field("Rate (%)", textInput(line.rate, "e.g. 20", function (v) { line.rate = v; })));
        row.appendChild(grid);
        return row;
    }

    /* --------------------------- France profile --------------------------- */

    function franceProfile() { return PUG_DATA.getCountryProfile("FR"); }

    function frNoteValue(s, code) {
        var n = (s.notes || []).filter(function (x) { return x.code === code; })[0];
        return n ? n.value : "";
    }
    function frSetNote(s, code, value) {
        s.notes = s.notes || [];
        var existing = null;
        s.notes.forEach(function (x) { if (x.code === code) existing = x; });
        if (value == null || String(value).trim() === "") {
            if (existing) s.notes = s.notes.filter(function (x) { return x !== existing; });
            return;
        }
        if (existing) existing.value = value; else s.notes.push({ code: code, value: value });
    }
    function frBarFor(profile, ctxCode) {
        var ctx = profile.contexts.filter(function (c) { return c.code === ctxCode; })[0] || profile.contexts[0];
        return ctx.bar;
    }
    function ensureFrance(s) {
        var profile = franceProfile(); if (!profile) return;
        if (!s.invoicingContext) s.invoicingContext = profile.contexts[0].code;
        if (!s.businessProcess) s.businessProcess = profile.businessProcesses[0].code;
        if (frNoteValue(s, "BAR") === "") frSetNote(s, "BAR", frBarFor(profile, s.invoicingContext));
    }

    function franceSection(s) {
        var profile = franceProfile();
        if (!profile) return el("div", { hidden: "hidden" });
        ensureFrance(s);

        var box = el("div", { class: "editor-section" });
        box.appendChild(elText("h3", "France — invoicing details", "editor-section__title"));

        var grid = el("div", { class: "editor-grid" });
        var notesHost = el("div", { class: "editor-grid" });

        grid.appendChild(field("Invoicing context", select(profile.contexts.map(function (c) { return { value: c.code, label: c.label }; }), s.invoicingContext, function (v) {
            s.invoicingContext = v;
            frSetNote(s, "BAR", frBarFor(profile, v));
            renderFranceNotes(s, profile, notesHost);
            renderIssues(working);
        }), "Sets the mandatory #BAR# treatment code."));

        grid.appendChild(field("Business process (@name)", select(profile.businessProcesses.map(function (b) { return { value: b.code, label: b.label }; }), s.businessProcess, function (v) { s.businessProcess = v; }), "Written as name=\"…\" on the type code."));

        box.appendChild(grid);
        box.appendChild(elText("h4", "French notes (#…#) — leave blank to keep the template's", "editor-section__title"));
        box.appendChild(notesHost);
        renderFranceNotes(s, profile, notesHost);
        return box;
    }

    function renderFranceNotes(s, profile, host) {
        host.innerHTML = "";
        host.appendChild(field("#BAR# treatment code", select(profile.barValues.map(function (v) { return { value: v, label: v }; }), frNoteValue(s, "BAR") || frBarFor(profile, s.invoicingContext), function (v) { frSetNote(s, "BAR", v); })));
        profile.noteCodes.forEach(function (nc) {
            host.appendChild(field(nc.label, textInput(frNoteValue(s, nc.code), nc.example || "", function (v) { frSetNote(s, nc.code, v); })));
        });
    }

    function toggle(node, show) {
        if (show) node.removeAttribute("hidden");
        else node.setAttribute("hidden", "hidden");
    }

    // Read-only country, taken from the global Setup section.
    function countryField() {
        var box = el("div", { class: "editor-field" });
        box.appendChild(fieldLabel("Country (from template / Setup)"));
        countryDisplayEl = el("div", { class: "readonly-value" });
        countryDisplayEl.textContent = countryText();
        box.appendChild(countryDisplayEl);
        return box;
    }

    function countryText() {
        var code = scenarioCountry();
        if (!code) return "Not set — choose a country in Setup above";
        var c = PUG_DATA.countriesByCode[code];
        return c ? c.name + " (" + code + ")" : code;
    }

    function partiesSection(s) {
        var box = el("div", { class: "editor-section" });
        box.appendChild(elText("h3", "Parties", "editor-section__title"));
        partiesHost = el("div", { class: "parties-grid" });
        box.appendChild(partiesHost);
        renderParties(s);
        return box;
    }

    function renderParties(s) {
        if (!partiesHost) return;
        partiesHost.innerHTML = "";
        partiesHost.appendChild(partyColumn("Seller", "AccountingSupplierParty", s.seller, false));
        partiesHost.appendChild(partyColumn("Buyer", "AccountingCustomerParty", s.buyer, true));
    }

    // Called by app.js when the global country changes while the editor is open.
    function refreshCountry() {
        if (!working) return;
        if (countryDisplayEl) countryDisplayEl.textContent = countryText();
        renderParties(working);
    }

    function partyColumn(title, ublNote, party, isBuyer) {
        var col = el("div", { class: "party-col" });

        var head = el("div", { class: "party-col__head" });
        head.appendChild(elText("h4", title, ""));
        head.appendChild(elText("span", ublNote, "party-col__ubl"));
        col.appendChild(head);

        col.appendChild(fieldLabel("Trading name"));
        col.appendChild(textInput(party.name, "Trading name", function (v) { party.name = v; }));
        col.appendChild(fieldLabel("Legal name"));
        col.appendChild(textInput(party.legalName, "Registered legal name", function (v) { party.legalName = v; }));

        if (isBuyer) {
            col.appendChild(fieldLabel("Pagero / customer account ID"));
            col.appendChild(textInput(party.accountId, "e.g. 1234567 — used for routing in Pagero Online", function (v) { party.accountId = v; }));
            col.appendChild(elText("p", "Optional. Written as SupplierAssignedAccountID to help route the document to the right recipient.", "field-hint"));
        }

        col.appendChild(identifiers(party));

        col.appendChild(collapsible("Address & contact", function (cbody) {
            cbody.appendChild(fieldLabel("Street"));
            cbody.appendChild(textInput(party.street, "Street", function (v) { party.street = v; }));
            var row = el("div", { class: "field-row" });
            row.appendChild(fieldCell(fieldLabel("City"), textInput(party.city, "City", function (v) { party.city = v; })));
            row.appendChild(fieldCell(fieldLabel("Postal code"), textInput(party.postalZone, "Postal", function (v) { party.postalZone = v; })));
            cbody.appendChild(row);
            cbody.appendChild(fieldLabel("Region / state"));
            cbody.appendChild(textInput(party.region, "Region", function (v) { party.region = v; }));
            cbody.appendChild(fieldLabel("Contact name"));
            cbody.appendChild(textInput(party.contactName, "Contact", function (v) { party.contactName = v; }));
            var row2 = el("div", { class: "field-row" });
            row2.appendChild(fieldCell(fieldLabel("Email"), textInput(party.contactEmail, "Email", function (v) { party.contactEmail = v; })));
            row2.appendChild(fieldCell(fieldLabel("Phone"), textInput(party.contactPhone, "Phone", function (v) { party.contactPhone = v; })));
            cbody.appendChild(row2);
        }));

        return col;
    }

    function identifiers(party) {
        var host = el("div", { class: "id-host" });
        var code = scenarioCountry();
        var defs = PUG_DATA.getCountryIdentifiers(code);

        var title = el("div", { class: "id-host__title" });
        title.textContent = code
            ? "Identifiers — " + (PUG_DATA.countriesByCode[code] ? PUG_DATA.countriesByCode[code].name : code)
            : "Identifiers (set a country in Setup)";
        host.appendChild(title);

        party.ids = party.ids || {};
        defs.forEach(function (def) {
            host.appendChild(fieldLabel(def.label));
            host.appendChild(textInput(party.ids[def.key] || "", def.example || "", function (v) { party.ids[def.key] = v; }));
            if (def.hint) host.appendChild(elText("p", def.hint, "field-hint"));
        });
        return host;
    }

    /* --------------------------- country control -------------------------- */
    // Exposed so app.js can mount the global country picker in the Setup section.

    function countryControl(host, currentCode, onChange) {
        host.innerHTML = "";
        if (currentCode && !PUG_DATA.countriesByCode[currentCode]) renderCustom(host, currentCode, onChange);
        else renderSelect(host, currentCode || "", onChange);
    }

    function renderSelect(host, currentCode, onChange) {
        host.innerHTML = "";
        var sel = el("select", { class: "field country-select" });
        sel.appendChild(option("", "Select country…"));
        PUG_DATA.countries.forEach(function (c) { sel.appendChild(option(c.code, c.code + " — " + c.name)); });
        sel.appendChild(option("__custom__", "Custom code…"));
        sel.value = currentCode || "";
        sel.addEventListener("change", function () {
            if (sel.value === "__custom__") { renderCustom(host, "", onChange); onChange(""); }
            else onChange(sel.value);
        });
        host.appendChild(sel);
    }

    function renderCustom(host, currentCode, onChange) {
        host.innerHTML = "";
        var input = el("input", { type: "text", class: "field country-custom", maxlength: "4", placeholder: "e.g. FR" });
        input.value = currentCode || "";
        input.addEventListener("input", function () { input.value = input.value.toUpperCase(); onChange(input.value.trim()); });
        var back = button("▾", "btn btn--small btn--ghost", function () { renderSelect(host, "", onChange); onChange(""); });
        back.setAttribute("title", "Pick from list");
        host.appendChild(input);
        host.appendChild(back);
    }

    /* ------------------------------ DOM helpers --------------------------- */

    function el(tag, attrs) {
        var node = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
        return node;
    }
    function elText(tag, text, cls) {
        var node = el(tag, cls ? { class: cls } : null);
        node.textContent = text;
        return node;
    }
    function cell(child, cls) {
        var td = el("td", cls ? { class: cls } : null);
        td.appendChild(child);
        return td;
    }
    function tdText(text) {
        var td = el("td");
        td.textContent = text;
        return td;
    }
    function field(labelText, control) {
        var box = el("div", { class: "editor-field" });
        box.appendChild(fieldLabel(labelText));
        box.appendChild(control);
        return box;
    }
    function fieldCell() {
        var box = el("div", { class: "field-cell" });
        for (var i = 0; i < arguments.length; i += 1) box.appendChild(arguments[i]);
        return box;
    }
    function fieldLabel(text) { return elText("label", text, "field-label"); }

    function textInput(value, placeholder, onChange) {
        var input = el("input", { type: "text", class: "field", placeholder: placeholder || "" });
        input.value = value || "";
        input.addEventListener("input", function () { onChange(input.value); });
        return input;
    }
    function select(options, value, onChange) {
        var sel = el("select", { class: "field" });
        options.forEach(function (o) { sel.appendChild(option(o.value, o.label)); });
        sel.value = value;
        sel.addEventListener("change", function () { onChange(sel.value); });
        return sel;
    }
    function option(value, label) {
        var o = el("option", { value: value });
        o.textContent = label;
        return o;
    }
    function button(label, cls, onClick) {
        var b = el("button", { type: "button", class: cls });
        b.textContent = label;
        b.addEventListener("click", onClick);
        return b;
    }
    function collapsible(title, fill) {
        var box = el("div", { class: "collapsible" });
        var btn = el("button", { type: "button", class: "collapsible__toggle" });
        btn.textContent = "▸ " + title;
        var body = el("div", { class: "collapsible__body", hidden: "hidden" });
        var open = false;
        btn.addEventListener("click", function () {
            open = !open;
            if (open) { body.removeAttribute("hidden"); btn.textContent = "▾ " + title; }
            else { body.setAttribute("hidden", "hidden"); btn.textContent = "▸ " + title; }
        });
        fill(body);
        box.appendChild(btn);
        box.appendChild(body);
        return box;
    }

    function showModal(modal) {
        if (!modal) return;
        modal._opener = document.activeElement;
        modal.removeAttribute("hidden");
        modal.classList.add("is-open");
    }
    function hideModal(modal) {
        if (!modal) return;
        modal.setAttribute("hidden", "hidden");
        modal.classList.remove("is-open");
        if (modal._opener && modal._opener.focus) modal._opener.focus();
    }
    function focusFirst(scope) {
        if (!scope) return;
        var f = scope.querySelector("input, select, textarea, button");
        if (f) f.focus();
    }

    return {
        init: init,
        render: render,
        getScenarios: getScenarios,
        setScenarios: setScenarios,
        clear: clear,
        removeScenario: removeScenario,
        openEditor: openEditor,
        openEditorWith: openEditorWith,
        newScenario: newScenario,
        newParty: newParty,
        countryControl: countryControl,
        refreshCountry: refreshCountry
    };
})();