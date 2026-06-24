"use strict";

/*
  js/xml.js
  ---------
  Everything XML: building party blocks from the country field definitions,
  parsing an uploaded PUF/UBL file back into a scenario, and generating output
  (placeholder mode or best-effort mode). Attached to window.PUG.xml.

  The country data (window.PUG_DATA) drives both directions: the same field
  definitions that render the form also decide where each value is written in
  UBL and how it is read back.
*/

window.PUG = window.PUG || {};

PUG.xml = (function () {
    var util = PUG.util;
    var esc = util.escapeXml;

    /* ---------------------------------------------------------------------- */
    /* Build a <cac:Party> block from party data + the country's field defs    */
    /* ---------------------------------------------------------------------- */

    function buildParty(party) {
        party = party || {};
        var defs = PUG_DATA.getCountryIdentifiers(party.country);
        var ids = party.ids || {};

        var endpoints = [];
        var partyIds = [];
        var legalIds = [];
        var taxSchemes = [];

        defs.forEach(function (def) {
            var value = (ids[def.key] || "").trim();
            if (!value) return;
            (def.slots || []).forEach(function (slot) {
                if (slot === "endpointId") endpoints.push({ schemeID: def.schemeID, value: value });
                else if (slot === "partyIdentification") partyIds.push({ schemeID: def.schemeID, value: value });
                else if (slot === "legalEntityCompanyId") legalIds.push({ schemeID: def.schemeID, value: value });
                else if (slot === "taxScheme") taxSchemes.push({ scheme: def.taxScheme || "VAT", value: value });
            });
        });

        var name = (party.name || "").trim() || (party.legalName || "").trim();
        var L = [];
        L.push("<cac:Party>");

        if (endpoints.length) {
            var e = endpoints[0];
            L.push("    <cbc:EndpointID" + schemeAttr(e.schemeID) + ">" + esc(e.value) + "</cbc:EndpointID>");
        }

        partyIds.forEach(function (p) {
            L.push("    <cac:PartyIdentification>");
            L.push("        <cbc:ID" + schemeAttr(p.schemeID) + ">" + esc(p.value) + "</cbc:ID>");
            L.push("    </cac:PartyIdentification>");
        });

        if (name) {
            L.push("    <cac:PartyName>");
            L.push("        <cbc:Name>" + esc(name) + "</cbc:Name>");
            L.push("    </cac:PartyName>");
        }

        if (hasAddress(party)) {
            L.push("    <cac:PostalAddress>");
            if (party.street) L.push("        <cbc:StreetName>" + esc(party.street) + "</cbc:StreetName>");
            if (party.city) L.push("        <cbc:CityName>" + esc(party.city) + "</cbc:CityName>");
            if (party.postalZone) L.push("        <cbc:PostalZone>" + esc(party.postalZone) + "</cbc:PostalZone>");
            if (party.region) L.push("        <cbc:CountrySubentity>" + esc(party.region) + "</cbc:CountrySubentity>");
            if (party.country) {
                L.push("        <cac:Country>");
                L.push("            <cbc:IdentificationCode>" + esc(party.country) + "</cbc:IdentificationCode>");
                L.push("        </cac:Country>");
            }
            L.push("    </cac:PostalAddress>");
        }

        taxSchemes.forEach(function (t) {
            L.push("    <cac:PartyTaxScheme>");
            L.push("        <cbc:CompanyID>" + esc(t.value) + "</cbc:CompanyID>");
            L.push("        <cac:TaxScheme>");
            L.push("            <cbc:ID>" + esc(t.scheme) + "</cbc:ID>");
            L.push("        </cac:TaxScheme>");
            L.push("    </cac:PartyTaxScheme>");
        });

        var legalName = (party.legalName || "").trim() || name;
        if (legalName || legalIds.length) {
            L.push("    <cac:PartyLegalEntity>");
            if (legalName) L.push("        <cbc:RegistrationName>" + esc(legalName) + "</cbc:RegistrationName>");
            legalIds.forEach(function (l) {
                L.push("        <cbc:CompanyID" + schemeAttr(l.schemeID) + ">" + esc(l.value) + "</cbc:CompanyID>");
            });
            L.push("    </cac:PartyLegalEntity>");
        }

        if (party.contactName || party.contactEmail || party.contactPhone) {
            L.push("    <cac:Contact>");
            if (party.contactName) L.push("        <cbc:Name>" + esc(party.contactName) + "</cbc:Name>");
            if (party.contactPhone) L.push("        <cbc:Telephone>" + esc(party.contactPhone) + "</cbc:Telephone>");
            if (party.contactEmail) L.push("        <cbc:ElectronicMail>" + esc(party.contactEmail) + "</cbc:ElectronicMail>");
            L.push("    </cac:Contact>");
        }

        L.push("</cac:Party>");
        return L.join("\n");
    }

    function schemeAttr(scheme) {
        return scheme ? ' schemeID="' + scheme + '"' : "";
    }

    function hasAddress(party) {
        return !!(party.street || party.city || party.postalZone || party.region || party.country);
    }

    /* ---------------------------------------------------------------------- */
    /* ---------------------------------------------------------------------- */
    /* Generation                                                              */
    /* ---------------------------------------------------------------------- */

    function generate(template, scenario) {
        if (template.indexOf("{{") >= 0) return applyPlaceholders(template, scenario);
        return applyBestEffort(template, scenario);
    }

    function applyPlaceholders(template, s) {
        var xml = template;

        // Party blocks first (raw XML insert — do not escape).
        xml = replaceToken(xml, "{{SELLER_PARTY}}", buildParty(s.seller));
        xml = replaceToken(xml, "{{BUYER_PARTY}}", buildParty(s.buyer));

        // Per-identifier scalar tokens, e.g. {{SELLER_SIRET}}, {{BUYER_GSTIN}}.
        xml = replaceIdentifierTokens(xml, "SELLER", s.seller);
        xml = replaceIdentifierTokens(xml, "BUYER", s.buyer);

        var scalars = {
            "{{SCENARIO_NUMBER}}": esc(s.scenarioNumber),
            "{{ID}}": esc(s.scenarioNumber),
            "{{ISSUE_DATE}}": esc(s.issueDate),
            "{{INVOICE_DATE}}": esc(s.issueDate),
            "{{CURRENCY}}": esc(s.currency),
            "{{TYPE_CODE}}": esc(s.typeCode),
            "{{DOCUMENT_TYPE}}": esc(s.docLabel),
            "{{DIRECTION}}": esc(s.direction),
            "{{COUNTRY_CODE}}": esc(s.country),
            "{{SELLER_NAME}}": esc(s.seller ? s.seller.name : ""),
            "{{BUYER_NAME}}": esc(s.buyer ? s.buyer.name : ""),
            "{{AMOUNT}}": s.amount,
            "{{PAYABLE_AMOUNT}}": s.payableAmount || s.amount
        };
        Object.keys(scalars).forEach(function (token) {
            xml = replaceToken(xml, token, scalars[token] == null ? "" : scalars[token]);
        });

        return xml;
    }

    function replaceIdentifierTokens(xml, prefix, party) {
        if (!party) return xml;
        var defs = PUG_DATA.getCountryIdentifiers(party.country);
        var ids = party.ids || {};
        defs.forEach(function (def) {
            var token = "{{" + prefix + "_" + def.key.toUpperCase() + "}}";
            xml = replaceToken(xml, token, esc(ids[def.key] || ""));
        });
        return xml;
    }

    function replaceToken(xml, token, value) {
        return xml.split(token).join(value == null ? "" : value);
    }

    function applyBestEffort(template, s) {
        var xml = template;

        xml = replaceInHeader(xml, "ID", esc(s.scenarioNumber));
        xml = replaceInHeader(xml, "IssueDate", esc(s.issueDate));
        if (s.currency) xml = replaceInHeader(xml, "DocumentCurrencyCode", esc(s.currency));
        xml = replaceFirstTagValue(xml, "InvoiceTypeCode", esc(s.typeCode));
        xml = replaceFirstTagValue(xml, "CreditNoteTypeCode", esc(s.typeCode));

        // Update the existing party blocks in place (preserves anything we did
        // not model, such as PUF extensions).
        xml = updatePartyBlock(xml, "AccountingSupplierParty", s.seller);
        xml = updatePartyBlock(xml, "AccountingCustomerParty", s.buyer);

        // Monetary values: tax totals, line amounts, currency sync, payable.
        xml = applyMonetary(xml, s);

        // Credit notes: write the original invoice reference.
        xml = applyBillingReference(xml, s);

        return xml;
    }

    /* ---------------------------------------------------------------------- */
    /* Best-effort: monetary engine (tax, totals, currency)                    */
    /* ---------------------------------------------------------------------- */

    function applyMonetary(xml, s) {
        // Currency attribute sync on every monetary element.
        if (s.currency) xml = xml.replace(/currencyID="[^"]*"/g, 'currencyID="' + s.currency + '"');

        var hasAmount = s.fillTaxTotals && s.net != null && s.net !== "";
        if (!hasAmount) {
            if (!s.keepTemplatePayable && s.payable) {
                xml = withinBlock(xml, "LegalMonetaryTotal", function (i) { return replaceFirstTagValue(i, "PayableAmount", s.payable); });
            }
            return xml;
        }

        var lineCount = (xml.match(/<(?:[\w.-]+:)?(?:Invoice|CreditNote)Line\b/g) || []).length;

        // Tax totals (document level): TaxAmount, TaxableAmount, category/rate.
        xml = withinEachBlock(xml, "TaxTotal", function (i) {
            i = replaceAllTagValues(i, "TaxAmount", s.tax);
            i = replaceAllTagValues(i, "TaxableAmount", s.net);
            i = setTaxCategories(i, s);
            return i;
        });

        if (lineCount <= 1) {
            // Single line: drive line + totals from the one net amount.
            xml = withinEachBlock(xml, "InvoiceLine", function (i) { return setLineAmounts(i, s); });
            xml = withinEachBlock(xml, "CreditNoteLine", function (i) { return setLineAmounts(i, s); });
            xml = withinBlock(xml, "LegalMonetaryTotal", function (i) {
                i = replaceFirstTagValue(i, "LineExtensionAmount", s.net);
                i = replaceFirstTagValue(i, "TaxExclusiveAmount", s.net);
                i = replaceFirstTagValue(i, "TaxInclusiveAmount", s.gross);
                if (!s.keepTemplatePayable && s.payable) i = replaceFirstTagValue(i, "PayableAmount", s.payable);
                return i;
            });
        } else {
            // Multiple lines: don't touch amounts (we can't split a single total
            // across lines); only set the tax category/rate on each line.
            xml = withinEachBlock(xml, "InvoiceLine", function (i) { return setTaxCategories(i, s); });
            xml = withinEachBlock(xml, "CreditNoteLine", function (i) { return setTaxCategories(i, s); });
        }
        return xml;
    }

    // Set Percent + category ID (and exemption reason if present) inside every
    // TaxCategory / ClassifiedTaxCategory block. The FIRST <ID> in such a block
    // is the category code; the TaxScheme's own ID comes later and is untouched.
    function setTaxCategories(inner, s) {
        ["TaxCategory", "ClassifiedTaxCategory"].forEach(function (cat) {
            inner = withinEachBlock(inner, cat, function (b) {
                if (s.taxRate != null && s.taxRate !== "") b = replaceFirstTagValue(b, "Percent", s.taxRate);
                if (s.taxCategory) b = replaceFirstTagValue(b, "ID", s.taxCategory);
                b = setExemptionReason(b, s.taxExemptionReason);
                return b;
            });
        });
        return inner;
    }

    // Write the tax exemption reason (BT-120). Replaces an existing element, or
    // injects one before TaxScheme (UBL order: ID, Percent, …Reason, TaxScheme).
    function setExemptionReason(block, reason) {
        if (!reason) return block;
        if (/<(?:[\w.-]+:)?TaxExemptionReason(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w.-]+:)?TaxExemptionReason>/.test(block)) {
            return replaceFirstTagValue(block, "TaxExemptionReason", esc(reason));
        }
        var p = (/<([\w.-]+:)?(?:ID|Percent)[\s>]/.exec(block) || [])[1] || "";
        var el = "<" + p + "TaxExemptionReason>" + esc(reason) + "</" + p + "TaxExemptionReason>";
        return block.replace(/(<(?:[\w.-]+:)?TaxScheme[\s>])/, el + "\n                $1");
    }

    function setLineAmounts(inner, s) {
        inner = replaceFirstTagValue(inner, "LineExtensionAmount", s.net);
        inner = withinBlock(inner, "Price", function (p) { return replaceFirstTagValue(p, "PriceAmount", s.net); });
        inner = setTaxCategories(inner, s);
        return inner;
    }

    function applyBillingReference(xml, s) {
        if (!s.originalInvoiceRef) return xml;
        if (/<(?:[\w.-]+:)?BillingReference\b/.test(xml)) {
            return withinBlock(xml, "BillingReference", function (i) {
                return withinBlock(i, "InvoiceDocumentReference", function (r) {
                    return replaceFirstTagValue(r, "ID", esc(s.originalInvoiceRef));
                });
            });
        }
        // Inject a minimal BillingReference after the type code (or currency).
        var block = "\n    <cac:BillingReference>\n        <cac:InvoiceDocumentReference>\n            <cbc:ID>" +
            esc(s.originalInvoiceRef) + "</cbc:ID>\n        </cac:InvoiceDocumentReference>\n    </cac:BillingReference>";
        var afterType = /(<\/(?:[\w.-]+:)?(?:CreditNoteTypeCode|InvoiceTypeCode)>)/;
        if (afterType.test(xml)) return xml.replace(afterType, "$1" + block);
        var afterCurrency = /(<\/(?:[\w.-]+:)?DocumentCurrencyCode>)/;
        if (afterCurrency.test(xml)) return xml.replace(afterCurrency, "$1" + block);
        return xml;
    }

    // Apply fn to the inner content of the first / every block of a given name.
    function blockPattern(localName, flags) {
        var n = util.escapeRegExp(localName);
        return new RegExp("(<(?:[\\w.-]+:)?" + n + "(?:\\s[^>]*)?>)([\\s\\S]*?)(<\\/(?:[\\w.-]+:)?" + n + ">)", flags);
    }
    function withinBlock(xml, localName, fn) {
        return xml.replace(blockPattern(localName), function (m, open, inner, close) { return open + fn(inner) + close; });
    }
    function withinEachBlock(xml, localName, fn) {
        return xml.replace(blockPattern(localName, "g"), function (m, open, inner, close) { return open + fn(inner) + close; });
    }

    /* ---------------------------------------------------------------------- */
    /* Best-effort: update values inside an existing party block               */
    /* ---------------------------------------------------------------------- */

    function updatePartyBlock(xml, partyTag, party) {
        if (!party) return xml;
        return xml.replace(partyBlockPattern(partyTag), function (block) {
            var updated = block;
            // SupplierAssignedAccountID (customer account / Pagero routing ID) is a
            // direct child of AccountingCustomerParty, before cac:Party.
            if (partyTag === "AccountingCustomerParty" && party.accountId && party.accountId.trim()) {
                updated = setAccountIdInBlock(updated, partyTag, party.accountId.trim());
            }
            if (party.name) updated = setPartyNameInBlock(updated, party.name);
            if (party.legalName) updated = setRegistrationNameInBlock(updated, party.legalName);
            if (party.country) updated = setCountryInBlock(updated, PUG_DATA.isoCountryCode(party.country));

            var defs = PUG_DATA.getCountryIdentifiers(party.country);
            var ids = party.ids || {};
            defs.forEach(function (def) {
                var value = (ids[def.key] || "").trim();
                if (!value) return;
                (def.slots || []).forEach(function (slot) {
                    if (slot === "endpointId") updated = setEndpointInBlock(updated, def.schemeID, value);
                    else if (slot === "partyIdentification") updated = setPartyIdInBlock(updated, def.schemeID, value);
                    else if (slot === "legalEntityCompanyId") updated = setLegalCompanyIdInBlock(updated, def.schemeID, value);
                    else if (slot === "taxScheme") updated = setTaxCompanyIdInBlock(updated, def.taxScheme || "VAT", value);
                });
            });
            return updated;
        });
    }

    // Detect the prefix used by simple (cbc) elements in a block, e.g. "cbc:".
    function cbcPrefix(block) {
        var m = /<([\w.-]+:)?(?:Name|CityName|StreetName|PostalZone|IdentificationCode|CompanyID|ID)[\s>]/.exec(block);
        return (m && m[1]) || "";
    }

    function setAccountIdInBlock(block, partyTag, value) {
        if (/<(?:[\w.-]+:)?SupplierAssignedAccountID(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w.-]+:)?SupplierAssignedAccountID>/.test(block)) {
            return replaceFirstTagValue(block, "SupplierAssignedAccountID", esc(value));
        }
        var p = cbcPrefix(block);
        var open = new RegExp("^(<(?:[\\w.-]+:)?" + util.escapeRegExp(partyTag) + "(?:\\s[^>]*)?>)");
        var el = "\n        <" + p + "SupplierAssignedAccountID>" + esc(value) + "</" + p + "SupplierAssignedAccountID>";
        return block.replace(open, "$1" + el);
    }

    function setPartyNameInBlock(block, name) {
        var v = esc(name);
        var re = /(<(?:[\w.-]+:)?PartyName>\s*<(?:[\w.-]+:)?Name(?:\s[^>]*)?>)([\s\S]*?)(<\/(?:[\w.-]+:)?Name>)/;
        if (re.test(block)) return block.replace(re, function (m, a, b, c) { return a + v + c; });
        return block;
    }

    function setRegistrationNameInBlock(block, name) {
        var v = esc(name);
        var re = tagPattern("RegistrationName");
        if (re.test(block)) return block.replace(re, function (m, a, b, c) { return a + v + c; });
        return block;
    }

    function setCountryInBlock(block, code) {
        var v = esc(code);
        var re = /(<(?:[\w.-]+:)?Country>\s*<(?:[\w.-]+:)?IdentificationCode(?:\s[^>]*)?>)([\s\S]*?)(<\/(?:[\w.-]+:)?IdentificationCode>)/;
        if (re.test(block)) return block.replace(re, function (m, a, b, c) { return a + v + c; });
        return block;
    }

    function setEndpointInBlock(block, schemeID, value) {
        var v = esc(value);
        if (schemeID) {
            var scoped = new RegExp("(<(?:[\\w.-]+:)?EndpointID[^>]*schemeID=\"" + util.escapeRegExp(schemeID) + "\"[^>]*>)([\\s\\S]*?)(<\\/(?:[\\w.-]+:)?EndpointID>)");
            if (scoped.test(block)) return block.replace(scoped, function (m, a, b, c) { return a + v + c; });
        }
        var any = tagPattern("EndpointID");
        if (any.test(block)) return block.replace(any, function (m, a, b, c) { return a + v + c; });
        return block;
    }

    function setPartyIdInBlock(block, schemeID, value) {
        var v = esc(value);
        if (schemeID) {
            var scoped = new RegExp("(<(?:[\\w.-]+:)?ID[^>]*schemeID=\"" + util.escapeRegExp(schemeID) + "\"[^>]*>)([\\s\\S]*?)(<\\/(?:[\\w.-]+:)?ID>)");
            if (scoped.test(block)) return block.replace(scoped, function (m, a, b, c) { return a + v + c; });
        }
        return block;
    }

    function setLegalCompanyIdInBlock(block, schemeID, value) {
        var v = esc(value);
        return block.replace(/(<(?:[\w.-]+:)?PartyLegalEntity>)([\s\S]*?)(<\/(?:[\w.-]+:)?PartyLegalEntity>)/, function (whole, open, inner, close) {
            var newInner = inner;
            if (schemeID) {
                var scoped = new RegExp("(<(?:[\\w.-]+:)?CompanyID[^>]*schemeID=\"" + util.escapeRegExp(schemeID) + "\"[^>]*>)([\\s\\S]*?)(<\\/(?:[\\w.-]+:)?CompanyID>)");
                if (scoped.test(newInner)) {
                    newInner = newInner.replace(scoped, function (m, a, b, c) { return a + v + c; });
                    return open + newInner + close;
                }
            }
            var any = /(<(?:[\w.-]+:)?CompanyID(?:\s[^>]*)?>)([\s\S]*?)(<\/(?:[\w.-]+:)?CompanyID>)/;
            if (any.test(newInner)) newInner = newInner.replace(any, function (m, a, b, c) { return a + v + c; });
            return open + newInner + close;
        });
    }

    function setTaxCompanyIdInBlock(block, schemeName, value) {
        var v = esc(value);
        var re = new RegExp(
            "(<(?:[\\w.-]+:)?PartyTaxScheme>)([\\s\\S]*?)(<\\/(?:[\\w.-]+:)?PartyTaxScheme>)", "g"
        );
        return block.replace(re, function (whole, open, inner, close) {
            var schemeMatch = inner.match(/<(?:[\w.-]+:)?TaxScheme>\s*<(?:[\w.-]+:)?ID(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?ID>/);
            var scheme = schemeMatch ? schemeMatch[1].trim() : "";
            if (scheme.toUpperCase() !== String(schemeName).toUpperCase()) return whole;
            var newInner = inner.replace(/(<(?:[\w.-]+:)?CompanyID(?:\s[^>]*)?>)([\s\S]*?)(<\/(?:[\w.-]+:)?CompanyID>)/, function (m, a, b, c) { return a + v + c; });
            return open + newInner + close;
        });
    }

    /* ---------------------------------------------------------------------- */
    /* Generic namespace-agnostic regex helpers                                */
    /* ---------------------------------------------------------------------- */

    function tagPattern(localName, flags) {
        var name = util.escapeRegExp(localName);
        return new RegExp(
            "(<(?:[\\w.-]+:)?" + name + "(?:\\s[^>]*)?>)([\\s\\S]*?)(<\\/(?:[\\w.-]+:)?" + name + ">)",
            flags
        );
    }

    function replaceFirstTagValue(xml, localName, value) {
        if (value === "") return xml;
        return xml.replace(tagPattern(localName), function (m, a, b, c) { return a + value + c; });
    }

    function replaceAllTagValues(xml, localName, value) {
        if (value === "") return xml;
        return xml.replace(tagPattern(localName, "g"), function (m, a, b, c) { return a + value + c; });
    }

    function indexOfTag(xml, localName) {
        var m = new RegExp("<(?:[\\w.-]+:)?" + util.escapeRegExp(localName) + "\\b").exec(xml);
        return m ? m.index : -1;
    }

    function replaceInHeader(xml, localName, value) {
        if (value === "") return xml;
        var boundary = xml.length;
        var s = indexOfTag(xml, "AccountingSupplierParty");
        var c = indexOfTag(xml, "AccountingCustomerParty");
        if (s >= 0) boundary = Math.min(boundary, s);
        if (c >= 0) boundary = Math.min(boundary, c);
        return replaceFirstTagValue(xml.slice(0, boundary), localName, value) + xml.slice(boundary);
    }

    function partyBlockPattern(partyTag) {
        var name = util.escapeRegExp(partyTag);
        return new RegExp("(<(?:[\\w.-]+:)?" + name + "\\b[\\s\\S]*?<\\/(?:[\\w.-]+:)?" + name + ">)");
    }

    /* ---------------------------------------------------------------------- */
    /* Parsing an uploaded PUF/UBL file                                        */
    /* ---------------------------------------------------------------------- */

    function parseXmlString(text) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(text, "application/xml");
        if (doc.getElementsByTagName("parsererror")[0]) {
            throw new Error("The file is not well-formed XML.");
        }
        if (!doc.documentElement) throw new Error("No XML root element found.");
        return doc;
    }

    function findAll(root, localName) {
        if (!root) return [];
        return Array.prototype.slice.call(root.getElementsByTagName("*")).filter(function (el) {
            return el.localName === localName;
        });
    }

    function findFirst(root, localName) {
        var all = findAll(root, localName);
        return all.length ? all[0] : null;
    }

    function directChild(parent, localName) {
        if (!parent) return null;
        var children = parent.children || [];
        for (var i = 0; i < children.length; i += 1) {
            if (children[i].localName === localName) return children[i];
        }
        return null;
    }

    function textOf(el) {
        return el ? (el.textContent || "").trim() : "";
    }

    function extractParty(partyContainer) {
        var party = { ids: {} };
        if (!partyContainer) return party;

        // Trading name (PartyName/Name).
        var names = findAll(partyContainer, "Name");
        for (var i = 0; i < names.length; i += 1) {
            if (names[i].parentNode && names[i].parentNode.localName === "PartyName") {
                party.name = textOf(names[i]);
                break;
            }
        }

        party.legalName = textOf(findFirst(partyContainer, "RegistrationName"));

        // Address.
        var address = findFirst(partyContainer, "PostalAddress");
        if (address) {
            party.street = textOf(findFirst(address, "StreetName"));
            party.city = textOf(findFirst(address, "CityName"));
            party.postalZone = textOf(findFirst(address, "PostalZone"));
            party.region = textOf(findFirst(address, "CountrySubentity"));
            var country = findFirst(address, "Country");
            party.country = country ? textOf(findFirst(country, "IdentificationCode")) : "";
        }

        // Contact.
        var contact = findFirst(partyContainer, "Contact");
        if (contact) {
            party.contactName = textOf(findFirst(contact, "Name"));
            party.contactEmail = textOf(findFirst(contact, "ElectronicMail"));
            party.contactPhone = textOf(findFirst(contact, "Telephone"));
        }

        // Identifiers, matched against this party's country field defs.
        var defs = PUG_DATA.getCountryIdentifiers(party.country);
        defs.forEach(function (def) {
            party.ids[def.key] = readIdentifier(partyContainer, def);
        });

        return party;
    }

    function readIdentifier(partyContainer, def) {
        var slots = def.slots || [];
        for (var i = 0; i < slots.length; i += 1) {
            var slot = slots[i];
            var value = "";
            if (slot === "taxScheme") value = readTaxScheme(partyContainer, def.taxScheme || "VAT");
            else if (slot === "partyIdentification") value = readSchemed(partyContainer, "PartyIdentification", "ID", def.schemeID);
            else if (slot === "endpointId") value = readEndpoint(partyContainer, def.schemeID);
            else if (slot === "legalEntityCompanyId") value = readLegalCompanyId(partyContainer, def.schemeID);
            if (value) return value;
        }
        return "";
    }

    function readTaxScheme(partyContainer, schemeName) {
        var schemes = findAll(partyContainer, "PartyTaxScheme");
        for (var i = 0; i < schemes.length; i += 1) {
            var ts = findFirst(schemes[i], "TaxScheme");
            var id = ts ? textOf(findFirst(ts, "ID")) : "";
            if (id.toUpperCase() === String(schemeName).toUpperCase()) {
                return textOf(findFirst(schemes[i], "CompanyID"));
            }
        }
        return "";
    }

    function readSchemed(partyContainer, wrapperLocal, idLocal, schemeID) {
        var wrappers = findAll(partyContainer, wrapperLocal);
        for (var i = 0; i < wrappers.length; i += 1) {
            var idEl = findFirst(wrappers[i], idLocal);
            if (!idEl) continue;
            var scheme = idEl.getAttribute ? idEl.getAttribute("schemeID") : "";
            if (!schemeID || scheme === schemeID) return textOf(idEl);
        }
        return "";
    }

    function readEndpoint(partyContainer, schemeID) {
        var endpoints = findAll(partyContainer, "EndpointID");
        for (var i = 0; i < endpoints.length; i += 1) {
            var scheme = endpoints[i].getAttribute ? endpoints[i].getAttribute("schemeID") : "";
            if (!schemeID || scheme === schemeID) return textOf(endpoints[i]);
        }
        return "";
    }

    function readLegalCompanyId(partyContainer, schemeID) {
        var legal = findFirst(partyContainer, "PartyLegalEntity");
        if (!legal) return "";
        var companyIds = findAll(legal, "CompanyID");
        for (var i = 0; i < companyIds.length; i += 1) {
            var scheme = companyIds[i].getAttribute ? companyIds[i].getAttribute("schemeID") : "";
            if (!schemeID || scheme === schemeID) return textOf(companyIds[i]);
        }
        return "";
    }

    function extractScenario(doc) {
        var root = doc.documentElement;
        var rootName = root.localName;
        var docType = /creditnote/i.test(rootName) ? "CREDIT_NOTE" : "INVOICE";

        var rootNs = root.namespaceURI || "";
        var customizationId = textOf(directChild(root, "CustomizationID"));
        var isPuf = /pagero/i.test(rootNs) || /puf/i.test(customizationId);

        var supplier = findFirst(root, "AccountingSupplierParty");
        var customer = findFirst(root, "AccountingCustomerParty");
        var seller = extractParty(supplier);
        var buyer = extractParty(customer);
        if (customer) buyer.accountId = textOf(directChild(customer, "SupplierAssignedAccountID"));

        var total = findFirst(root, "LegalMonetaryTotal") || root;
        var amount = textOf(findFirst(total, "TaxInclusiveAmount")) || textOf(findFirst(total, "PayableAmount"));
        var payable = textOf(findFirst(total, "PayableAmount"));

        return {
            isPuf: isPuf,
            rootName: rootName,
            docType: docType,
            scenarioNumber: textOf(directChild(root, "ID")),
            issueDate: textOf(directChild(root, "IssueDate")),
            currency: textOf(directChild(root, "DocumentCurrencyCode")),
            country: seller.country || buyer.country || "",
            amount: util.normaliseAmount(amount),
            payableAmount: util.normaliseAmount(payable),
            seller: seller,
            buyer: buyer
        };
    }

    return {
        buildParty: buildParty,
        generate: generate,
        parseXmlString: parseXmlString,
        extractScenario: extractScenario
    };
})();