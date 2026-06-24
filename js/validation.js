"use strict";

/*
  js/validation.js
  ----------------
  A structured validation layer. Pure, dependency-light functions that return
  human-readable issue strings. Errors block; warnings inform (a scenario may
  still be added — the tool builds test data as well as production documents).

  Coverage in this pass (the deterministic, offline-checkable rules):
    - Identifier formats + check-digit algorithms (Luhn / ABN / Finnish / Polish)
    - Tax-category business rules (BR-S / BR-Z / BR-E / BR-AE …) + Swedish rates
    - Structural: root element vs document type, PUF/EN16931 CustomizationID &
      ProfileID, TaxScheme vs the country's expected scheme

  NOT covered (and deliberately so — needs services a browser tool can't host):
    full schematron, live registry lookups, ZATCA crypto stamps, QR/hash chains.

  Attached to window.PUG.validate. Loaded after the data files, before app.js.
*/

window.PUG = window.PUG || {};

PUG.validate = (function () {

    /* --------------------------- check digits ----------------------------- */

    function digitsOnly(s) { return (s || "").replace(/\D/g, ""); }

    function luhn(value) {
        var num = digitsOnly(value);
        if (!num) return false;
        var sum = 0, alt = false;
        for (var i = num.length - 1; i >= 0; i -= 1) {
            var d = +num[i];
            if (alt) { d *= 2; if (d > 9) d -= 9; }
            sum += d; alt = !alt;
        }
        return sum % 10 === 0;
    }

    // Australian Business Number — subtract 1 from the first digit, weighted sum mod 89.
    function abn(value) {
        var num = digitsOnly(value);
        if (!/^\d{11}$/.test(num)) return false;
        var w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
        var d = num.split("").map(Number);
        d[0] -= 1;
        var s = 0;
        for (var i = 0; i < 11; i += 1) s += d[i] * w[i];
        return s % 89 === 0;
    }

    // Finnish Business ID "1234567-8" — weighted mod 11.
    function fiBiz(value) {
        var m = /^(\d{7})-(\d)$/.exec((value || "").trim());
        if (!m) return false;
        var w = [7, 9, 10, 5, 8, 4, 2], s = 0;
        for (var i = 0; i < 7; i += 1) s += (+m[1][i]) * w[i];
        var r = s % 11;
        if (r === 1) return false;           // 1 → no valid check digit
        var c = r === 0 ? 0 : 11 - r;
        return c === +m[2];
    }

    // Polish NIP — weighted mod 11 on the first 9 digits.
    function plNip(value) {
        var num = digitsOnly(value);
        if (!/^\d{10}$/.test(num)) return false;
        var w = [6, 5, 7, 2, 3, 4, 5, 6, 7], s = 0;
        for (var i = 0; i < 9; i += 1) s += (+num[i]) * w[i];
        var c = s % 11;
        if (c === 10) return false;
        return c === +num[9];
    }

    var ALGOS = { luhn: luhn, abn: abn, fiBiz: fiBiz, plNip: plNip };

    /* ------------------------------ helpers ------------------------------- */

    function isoOf(code) {
        return PUG_DATA.isoCountryCode ? PUG_DATA.isoCountryCode(code) : (code || "").toUpperCase();
    }

    function firstText(xml, localName) {
        var m = new RegExp("<(?:[\\w.-]+:)?" + localName + "(?:\\s[^>]*)?>([^<]*)<").exec(xml);
        return m ? m[1].trim() : "";
    }

    /* --------------------------- identifiers ------------------------------ */

    function identifierIssues(countryCode, ids, roleLabel) {
        var out = [];
        var rules = PUG_DATA.identifierRules ? PUG_DATA.identifierRules[isoOf(countryCode)] : null;
        if (!rules || !ids) return out;
        var prefix = roleLabel ? roleLabel + " " : "";
        Object.keys(rules).forEach(function (key) {
            var val = (ids[key] || "").trim();
            if (!val) return;
            var rule = rules[key];
            if (rule.re && !(new RegExp(rule.re).test(val))) {
                out.push(prefix + rule.label + " \"" + val + "\" doesn't match the expected format.");
                return;
            }
            if (rule.digits && digitsOnly(val).length !== rule.digits) {
                out.push(prefix + rule.label + " should be " + rule.digits + " digits.");
                return;
            }
            if (rule.check && ALGOS[rule.check] && !ALGOS[rule.check](val)) {
                out.push(prefix + rule.label + " check digit is invalid.");
            }
        });
        return out;
    }

    /* ----------------------------- tax rules ------------------------------ */

    function expectedTaxScheme(countryCode) {
        var defs = (PUG_DATA.getCountryIdentifiers && PUG_DATA.getCountryIdentifiers(countryCode)) || [];
        for (var i = 0; i < defs.length; i += 1) {
            if ((defs[i].slots || []).indexOf("taxScheme") >= 0) return defs[i].taxScheme || "VAT";
        }
        return "VAT";
    }

    function taxCategoryIssues(s) {
        var out = [];
        var cat = s.taxCategory || "S";
        var rate = parseFloat(s.taxRate);
        var hasReason = !!(s.taxExemptionReason && s.taxExemptionReason.trim());
        var hasAmount = !!(s.amount && String(s.amount).trim());
        if (!hasAmount) return out;   // no amount → tax rules don't apply to the draft

        if (cat === "S") {
            if (!(rate > 0)) out.push("Tax category S requires a rate greater than 0 (BR-S-08).");
            if (hasReason) out.push("Tax category S must not carry an exemption reason (BR-S-09).");
            if (isoOf(s.country) === "SE" && rate > 0 && [6, 12, 25].indexOf(rate) < 0) {
                out.push("Swedish standard VAT must be 6, 12, or 25% (SE-R-006).");
            }
        } else {
            if (rate > 0) out.push("Tax category " + cat + " should have a 0 rate.");
            if (!hasReason && ["E", "AE", "K", "G", "O"].indexOf(cat) >= 0) {
                out.push("Tax category " + cat + " requires an exemption reason (BR-" + cat + ").");
            }
        }
        return out;
    }

    /* ---------------------------- structure ------------------------------- */

    function rootType(xml) {
        var m = /<(?:[\w.-]+:)?(Invoice|CreditNote)[\s>]/.exec(xml);
        if (!m) return "UNKNOWN";
        return m[1] === "CreditNote" ? "CREDIT_NOTE" : "INVOICE";
    }

    function rootMatchesDocType(rt, docType) {
        if (rt === "UNKNOWN") return true;            // can't tell → don't block
        return docType === "CREDIT_NOTE" ? rt === "CREDIT_NOTE" : rt === "INVOICE";
    }

    function profileIssues(xml) {
        var out = [];
        var cust = firstText(xml, "CustomizationID");
        var prof = firstText(xml, "ProfileID");
        if (!cust) out.push("CustomizationID is missing (PUF-R001).");
        else if (cust.indexOf("urn:pagero.com:puf:billing") < 0 && cust.indexOf("en16931:2017#compliant") < 0) {
            out.push("CustomizationID is not a recognised PUF/EN16931 value (PUF-R001).");
        }
        if (prof && prof.indexOf("urn:pagero.com:puf:") < 0 && prof.indexOf("poacc:billing") < 0) {
            out.push("ProfileID is not a recognised PUF value (PUF-R002).");
        }
        return out;
    }

    function taxSchemeIssue(xml, countryCode) {
        var exp = expectedTaxScheme(countryCode);
        var m = /<(?:[\w.-]+:)?TaxScheme>[\s\S]*?<(?:[\w.-]+:)?ID(?:\s[^>]*)?>([^<]*)</.exec(xml);
        var got = m ? m[1].trim() : "";
        if (got && exp && got !== exp) {
            return "Output TaxScheme is " + got + " but " + (countryCode || "this country") + " usually uses " + exp + ".";
        }
        return "";
    }

    // Code-list value checks (currency / tax category / country code).
    function valueIssues(s, countryCode) {
        var out = [];
        var cur = (s.currency || "").trim().toUpperCase();
        if (cur && PUG_DATA.isCurrency && !PUG_DATA.isCurrency(cur)) {
            out.push("Currency \"" + cur + "\" is not a valid ISO 4217 code.");
        }
        var cat = (s.taxCategory || "S").toUpperCase();
        if (PUG_DATA.isTaxCategory && !PUG_DATA.isTaxCategory(cat)) {
            out.push("Tax category \"" + cat + "\" is not a recognised code.");
        }
        var c = isoOf(countryCode);
        if (c && PUG_DATA.isCountryCode && !PUG_DATA.isCountryCode(c)) {
            out.push("Country code \"" + c + "\" is not a valid ISO 3166-1 code.");
        }
        return out;
    }

    return {
        luhn: luhn,
        abn: abn,
        fiBiz: fiBiz,
        plNip: plNip,
        identifierIssues: identifierIssues,
        taxCategoryIssues: taxCategoryIssues,
        valueIssues: valueIssues,
        expectedTaxScheme: expectedTaxScheme,
        rootType: rootType,
        rootMatchesDocType: rootMatchesDocType,
        profileIssues: profileIssues,
        taxSchemeIssue: taxSchemeIssue
    };
})();