"use strict";

/*
  js/country-rules.js
  -------------------
  Country-specific validation rule packs, applied by the SELLER's country.
  These translate the published per-country schematron rules (Peppol national
  rules / PUF) into JS checks against the fields we model. They return warnings
  (this tool also builds test data, so it never hard-blocks on these).

  Only rules that can be checked against modeled fields are implemented; rules
  needing data we don't model yet (payment means, BuyerReference/Leitweg-ID,
  F-skatt text) are deliberately left for the relevant later pass.

  Coverage so far:
    SE — org/VAT presence (SE-R format + Luhn live in identifier-rules/validation)
    DE — seller contact (name/phone/email), seller+buyer city/postcode, seller VAT
  Attached to window.PUF.countryRules. Loaded after validation.js, before app.js.
*/

window.PUF = window.PUF || {};

PUF.countryRules = (function () {

    function iso(code) {
        return PUF_DATA.isoCountryCode ? PUF_DATA.isoCountryCode(code) : (code || "").toUpperCase();
    }
    function has(v) { return !!(v && String(v).trim()); }

    // Sweden — SE-R. Format/Luhn/rate rules already covered by identifier-rules
    // and the tax-category checks; this adds the presence rule on modeled data.
    function sweden(s, out) {
        var sel = s.seller || {}, ids = sel.ids || {};
        if (!has(ids.orgNumber) && !has(ids.vat)) {
            out.push("Sweden: the seller should carry an organisation number (scheme 0007) or a VAT identifier.");
        }
    }

    // Germany — DE-R (XRechnung). Seller contact + addresses are mandatory.
    function germany(s, out) {
        var sel = s.seller || {}, buy = s.buyer || {}, ids = sel.ids || {};
        if (!has(sel.contactName)) out.push("Germany: seller contact name is required (DE-R-005).");
        if (!has(sel.contactPhone)) out.push("Germany: seller contact telephone is required (DE-R-006).");
        if (!has(sel.contactEmail)) out.push("Germany: seller contact email is required (DE-R-007).");
        if (!has(sel.city)) out.push("Germany: seller city is required (DE-R-003).");
        if (!has(sel.postalZone)) out.push("Germany: seller post code is required (DE-R-004).");
        if (!has(buy.city)) out.push("Germany: buyer city is required (DE-R-008).");
        if (!has(buy.postalZone)) out.push("Germany: buyer post code is required (DE-R-009).");
        if (!has(ids.vat)) out.push("Germany: seller VAT identifier or tax number is required (DE-R-016/017).");
    }

    var PACKS = { SE: sweden, DE: germany };

    function issues(countryCode, scenario) {
        var out = [];
        var pack = PACKS[iso(countryCode)];
        if (pack) pack(scenario, out);
        return out;
    }

    // True when the seller country has its own rule pack (for UI hints / notes).
    function hasPack(countryCode) { return !!PACKS[iso(countryCode)]; }

    return { issues: issues, hasPack: hasPack };
})();