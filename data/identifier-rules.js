"use strict";

/*
  data/identifier-rules.js
  ------------------------
  Per-country identifier *format* rules, keyed by ISO 3166-1 alpha-2 country
  code and then by the identifier key used in countries.js. Grounded in the PUF
  / Peppol / EN 16931 country rule sets (see the implementation outline, Part 9).

  Each rule is one of:
    { re: "<regex source>", label }            — value must match the regex
    { digits: <n>, check: "<algo>", label }    — strip to digits, length n, run check
  An optional `check` names a check-digit algorithm implemented in validation.js
  ("luhn", "abn", "fiBiz", "plNip").

  These drive *warnings*, never hard errors — a user may have a legitimate edge
  case, and this tool builds test data as well as real documents.

  Attached to window.PUF_DATA (shared global; loaded after countries.js).
*/

window.PUF_DATA = window.PUF_DATA || {};

PUF_DATA.identifierRules = {
    SE: {
        orgNumber: { digits: 10, check: "luhn", label: "Swedish org number" },
        vat: { re: "^SE\\d{12}$", label: "Swedish VAT" }
    },
    DE: {
        vat: { re: "^DE\\d{9}$", label: "German VAT" }
    },
    FR: {
        siret: { re: "^\\d{14}$", label: "SIRET" },
        siren: { re: "^\\d{9}$", label: "SIREN" },
        vat: { re: "^FR[A-Z0-9]{2}\\d{9}$", label: "French VAT" }
    },
    NO: {
        orgNumber: { re: "^\\d{9}$", label: "Norwegian org number" },
        vat: { re: "^NO\\d{9}MVA$", label: "Norwegian VAT" }
    },
    FI: {
        businessId: { re: "^\\d{7}-\\d$", check: "fiBiz", label: "Finnish Business ID" }
    },
    DK: {
        vat: { re: "^DK\\d{8}$", label: "Danish VAT" }
    },
    IT: {
        vat: { re: "^IT\\d{11}$", label: "Italian VAT" },
        codiceFiscale: { re: "^(\\d{11}|[A-Z]{6}\\d{2}[A-Z]\\d{2}[A-Z]\\d{3}[A-Z])$", label: "Codice Fiscale" }
    },
    BE: {
        enterprise: { re: "^\\d{10}$", label: "Belgian enterprise no." },
        vat: { re: "^BE\\d{10}$", label: "Belgian VAT" }
    },
    NL: {
        vat: { re: "^NL\\d{9}B\\d{2}$", label: "Dutch VAT" }
    },
    PL: {
        nip: { re: "^\\d{10}$", check: "plNip", label: "Polish NIP" }
    },
    GR: {
        vat: { re: "^EL\\d{9}$", label: "Greek VAT" }
    },
    AU: {
        abn: { re: "^\\d{11}$", check: "abn", label: "ABN" }
    },
    IN: {
        gstin: { re: "^\\d{2}[A-Z]{5}\\d{4}[A-Z]\\d[A-Z0-9][A-Z]$", label: "GSTIN" },
        pan: { re: "^[A-Z]{5}\\d{4}[A-Z]$", label: "PAN" }
    },
    SA: {
        vat: { re: "^3\\d{13}3$", label: "Saudi VAT" }
    },
    HR: {
        vat: { re: "^(HR)?\\d{11}$", label: "Croatian OIB / VAT" }
    },
    GB: {
        vat: { re: "^(GB\\d{9}|GB\\d{12}|GBGD\\d{3}|GBHA\\d{3})$", label: "UK VAT" }
    },
    ES: {
        vat: { re: "^ES[0-9A-Z]\\d{7}[0-9A-Z]$", label: "Spanish NIF / VAT" }
    },
    SK: {
        ico: { re: "^\\d{8}$", label: "IČO" },
        vat: { re: "^SK\\d{10}$", label: "Slovak VAT" }
    },
    RO: {
        vat: { re: "^RO\\d{2,10}$", label: "Romanian CUI" }
    }
};