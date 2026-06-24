"use strict";

/*
  data/countries.js
  -----------------
  Static reference data for the invoice XML generator.

  Each country lists the party identifier fields that are relevant for that
  market, grounded in the official Pagero PUF example files
  (github.com/pagero/puf-billing). The same field set is used for both the
  seller and the buyer, because UBL/EN 16931 uses the same identifier slots on
  each party (only the Business Term numbers differ, e.g. BT-29 seller SIRET vs
  BT-46 buyer party identifier).

  FIELD DEFINITION SCHEMA
  -----------------------
  {
    key:       unique id within the country (also used as the data key and
               placeholder name, e.g. "siret" -> {{SELLER_SIRET}})
    label:     shown next to the input (e.g. "SIRET")
    hint:      short helper text under the input (optional)
    example:   placeholder text inside the input (optional)
    slots:     where the value is written in UBL. One or more of:
                 "endpointId"           -> <cbc:EndpointID schemeID=..>
                 "partyIdentification"  -> <cac:PartyIdentification><cbc:ID schemeID=..>
                 "legalEntityCompanyId" -> <cac:PartyLegalEntity><cbc:CompanyID schemeID=..>
                 "taxScheme"            -> <cac:PartyTaxScheme><cbc:CompanyID>..<TaxScheme><ID>
    schemeID:  schemeID attribute applied to endpointId / partyIdentification /
               legalEntityCompanyId placements (optional)
    taxScheme: required when "taxScheme" is in slots; the TaxScheme/ID value
               (VAT, GST, TAX, ...)
  }

  COMMON FIELDS (handled by the form for every party, not listed here):
    trading name, legal name, address (street, city, postal code, region,
    country) and contact (name, email, phone).

  To add a country: append an entry below. To add an identifier: add a field to
  that country's `identifiers` array. Nothing else needs to change.
*/

window.PUG_DATA = window.PUG_DATA || {};

// Fallback identifiers used when a custom / unlisted country code is entered.
PUG_DATA.defaultIdentifiers = [
    { key: "vat", label: "VAT / Tax number", hint: "Tax registration identifier", slots: ["taxScheme"], taxScheme: "VAT", example: "VAT number" },
    { key: "legalId", label: "Legal registration ID", hint: "Company / organisation number", slots: ["legalEntityCompanyId"], example: "Company number" }
];

PUG_DATA.countries = [
    {
        code: "AU", name: "Australia", folder: "australia",
        identifiers: [
            { key: "abn", label: "ABN", hint: "Australian Business Number (11 digits) — also used as the electronic address", example: "98765432101", slots: ["endpointId", "partyIdentification", "legalEntityCompanyId"], schemeID: "0151" },
            { key: "gst", label: "GST registration", hint: "Tax registration (ABN-based)", example: "13245678910", slots: ["taxScheme"], taxScheme: "GST" }
        ]
    },
    {
        code: "ES-PV", iso: "ES", name: "Basque Country (Spain)", folder: "basque-country",
        note: "Spanish entity under the Basque TicketBAI regime.",
        identifiers: [
            { key: "vat", label: "NIF / VAT", hint: "Spanish VAT identifier (ES + NIF/CIF)", example: "ESA123456789", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "legalId", label: "Company ID (NIF/CIF)", example: "A12345678", slots: ["legalEntityCompanyId"] }
        ]
    },
    {
        code: "BE", name: "Belgium", folder: "belgium",
        identifiers: [
            { key: "enterprise", label: "Enterprise number (KBO/BCE)", hint: "Also used as the electronic address (scheme 9925)", example: "BE1234567891", slots: ["endpointId", "legalEntityCompanyId"], schemeID: "9925" },
            { key: "gln", label: "GLN", hint: "Global Location Number", example: "8808808000121", slots: ["partyIdentification"], schemeID: "0088" },
            { key: "vat", label: "VAT number", example: "BE1234567891", slots: ["taxScheme"], taxScheme: "VAT" }
        ]
    },
    {
        code: "CA", name: "Canada", folder: "canada",
        identifiers: [
            { key: "gst", label: "GST/HST number", hint: "Business Number with RT program account", example: "123456789RT0002", slots: ["partyIdentification", "taxScheme"], schemeID: "CA:GST", taxScheme: "GST" }
        ]
    },
    {
        code: "HR", name: "Croatia", folder: "croatia",
        identifiers: [
            { key: "vat", label: "OIB / VAT", hint: "Croatian VAT identifier (HR + OIB)", example: "HR11223344556", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "endpoint", label: "Electronic address (OIB)", hint: "Croatia routing scheme 9934", example: "11223344556", slots: ["endpointId"], schemeID: "9934" }
        ]
    },
    {
        code: "FI", name: "Finland", folder: "finland",
        identifiers: [
            { key: "businessId", label: "Business ID (Y-tunnus)", hint: "Finnish organisation number", example: "0765432-1", slots: ["partyIdentification", "legalEntityCompanyId"], schemeID: "0212" },
            { key: "ovt", label: "OVT number", hint: "Finnish electronic address (scheme 0216)", example: "00370765432100001", slots: ["endpointId"], schemeID: "0216" },
            { key: "vat", label: "VAT number", example: "FI07654321", slots: ["taxScheme"], taxScheme: "VAT" }
        ]
    },
    {
        code: "FR", name: "France", folder: "france",
        identifiers: [
            { key: "siret", label: "SIRET", hint: "14-digit establishment identifier (mandatory for French entities)", example: "98765432100012", slots: ["partyIdentification"], schemeID: "0009" },
            { key: "siren", label: "SIREN", hint: "9-digit legal registration identifier", example: "987654321", slots: ["legalEntityCompanyId"], schemeID: "0002" },
            { key: "vat", label: "VAT number", hint: "FR + 11 characters", example: "FR12987654321", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "endpoint", label: "E-invoicing address (Annuaire)", hint: "Scheme 0225 — SIREN or SIREN_SIRET", example: "987654321", slots: ["endpointId"], schemeID: "0225" }
        ]
    },
    {
        code: "DE", name: "Germany", folder: "germany",
        identifiers: [
            { key: "vat", label: "VAT number (USt-IdNr.)", example: "DE1234567891", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "endpoint", label: "Electronic address", hint: "German VAT routing scheme 9930", example: "DE1234567891", slots: ["endpointId"], schemeID: "9930" },
            { key: "gln", label: "GLN", hint: "Global Location Number", example: "8808808000121", slots: ["partyIdentification"], schemeID: "0088" }
        ]
    },
    {
        code: "GR", name: "Greece", folder: "greece",
        identifiers: [
            { key: "vat", label: "VAT number (AFM)", hint: "EL + 9 digits", example: "EL111111111", slots: ["taxScheme"], taxScheme: "VAT" }
        ]
    },
    {
        code: "HU", name: "Hungary", folder: "hungary",
        identifiers: [
            { key: "taxNumber", label: "Tax number", hint: "Hungarian tax number", example: "23542378214", slots: ["legalEntityCompanyId"] }
        ]
    },
    {
        code: "IN", name: "India", folder: "india",
        identifiers: [
            { key: "gstin", label: "GSTIN", hint: "Goods & Services Tax Identification Number", example: "01AAAAA0000A1Z5", slots: ["partyIdentification"], schemeID: "IN:GSTIN" },
            { key: "pan", label: "PAN", hint: "Permanent Account Number", example: "AAAAA0000A", slots: ["legalEntityCompanyId"], schemeID: "IN:PAN" }
        ]
    },
    {
        code: "IL", name: "Israel", folder: "israel",
        identifiers: [
            { key: "vat", label: "VAT number", example: "123456789", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "unionVat", label: "Union VAT number", hint: "If applicable (scheme IL:UNION_VAT)", example: "777777777", slots: ["partyIdentification"], schemeID: "IL:UNION_VAT" }
        ]
    },
    {
        code: "IT", name: "Italy", folder: "italy",
        note: "REA / share-capital data uses PUF extensions (not yet generated).",
        identifiers: [
            { key: "vat", label: "VAT (Partita IVA)", hint: "Country code + 1–28 chars", example: "IT12121212", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "codiceFiscale", label: "Codice Fiscale", hint: "11–16 characters (TaxScheme TAX)", example: "12345678901", slots: ["taxScheme"], taxScheme: "TAX" },
            { key: "legalId", label: "Legal / REA number", example: "12345678", slots: ["legalEntityCompanyId"] }
        ]
    },
    {
        code: "JP", name: "Japan", folder: "japan",
        identifiers: [
            { key: "corporateNumber", label: "Corporate Number", hint: "13-digit corporate number (scheme 0188)", example: "1234567890123", slots: ["endpointId", "legalEntityCompanyId"], schemeID: "0188" },
            { key: "qiin", label: "Qualified Invoice Issuer Reg. No.", hint: "Starts with T", example: "T9241094382473", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "sellerId", label: "Party identifier (scheme 0147)", example: "111111:222222:3333:1", slots: ["partyIdentification"], schemeID: "0147" }
        ]
    },
    {
        code: "MY", name: "Malaysia", folder: "malaysia",
        identifiers: [
            { key: "tin", label: "TIN", hint: "Tax Identification Number", example: "C1234567890", slots: ["partyIdentification"], schemeID: "MY:TIN" },
            { key: "brn", label: "BRN", hint: "Business Registration Number", example: "AB123456", slots: ["partyIdentification"], schemeID: "MY:BRN" },
            { key: "tourismTax", label: "Tourism Tax Reg. No.", hint: "If applicable", example: "TTX-123456", slots: ["partyIdentification"], schemeID: "MY:TTX" },
            { key: "sst", label: "SST number", hint: "Sales & Service Tax registration", example: "SST-123456", slots: ["taxScheme"], taxScheme: "VAT" }
        ]
    },
    {
        code: "NO", name: "Norway", folder: "norway",
        identifiers: [
            { key: "orgNumber", label: "Organisation number", hint: "9-digit org. number (scheme 0192)", example: "811143758", slots: ["endpointId", "partyIdentification", "legalEntityCompanyId"], schemeID: "0192" },
            { key: "gln", label: "GLN", example: "8808808000121", slots: ["partyIdentification"], schemeID: "0088" },
            { key: "vat", label: "VAT number", hint: "NO + org number + MVA", example: "NO811143758MVA", slots: ["taxScheme"], taxScheme: "VAT" }
        ]
    },
    {
        code: "PH", name: "Philippines", folder: "philippines",
        identifiers: [
            { key: "tin", label: "TIN", hint: "Taxpayer Identification Number", example: "123456789", slots: ["taxScheme"], taxScheme: "TAX" }
        ]
    },
    {
        code: "PL", name: "Poland", folder: "poland",
        identifiers: [
            { key: "nip", label: "NIP / VAT", hint: "Polish tax identification number", example: "9999999999", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "gln", label: "GLN", example: "7310000000000", slots: ["partyIdentification"], schemeID: "0088" },
            { key: "regon", label: "REGON", hint: "Statistical number", example: "999999999", slots: ["partyIdentification"], schemeID: "PL:REGON" },
            { key: "krs", label: "KRS", hint: "National Court Register number", example: "0000099999", slots: ["partyIdentification"], schemeID: "PL:KRS" },
            { key: "bdo", label: "BDO", hint: "Waste database number", example: "000099999", slots: ["partyIdentification"], schemeID: "PL:BDO" }
        ]
    },
    {
        code: "PT", name: "Portugal", folder: "portugal",
        identifiers: [
            { key: "nif", label: "NIF", hint: "Tax identification number (scheme 0001)", example: "PT123456789", slots: ["partyIdentification", "legalEntityCompanyId", "taxScheme"], schemeID: "0001", taxScheme: "VAT" }
        ]
    },
    {
        code: "RO", name: "Romania", folder: "romania",
        identifiers: [
            { key: "vat", label: "VAT number (CUI)", example: "RO1234567", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "tradeRegister", label: "Trade register no.", hint: "Format J##/####/####", example: "J12/1234/1234", slots: ["legalEntityCompanyId"] }
        ]
    },
    {
        code: "SA", name: "Saudi Arabia", folder: "saudi-arabia",
        identifiers: [
            { key: "vat", label: "VAT number", hint: "15-digit VAT registration", example: "300000000000003", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "groupVat", label: "Group VAT number", hint: "If applicable (scheme SA:HQ)", example: "311111111111113", slots: ["partyIdentification"], schemeID: "SA:HQ" }
        ]
    },
    {
        code: "RS", name: "Serbia", folder: "serbia",
        identifiers: [
            { key: "vat", label: "PIB / VAT", hint: "Serbian tax identification (RS + PIB)", example: "RS123456789", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "companyRegNo", label: "Company reg. no. (matični broj)", example: "12345678", slots: ["legalEntityCompanyId"] }
        ]
    },
    {
        code: "SG", name: "Singapore", folder: "singapore",
        identifiers: [
            { key: "uen", label: "UEN", hint: "Unique Entity Number (scheme 0195)", example: "SG1234567891", slots: ["endpointId", "legalEntityCompanyId"], schemeID: "0195" },
            { key: "gst", label: "GST registration", example: "SG1234567891", slots: ["taxScheme"], taxScheme: "GST" },
            { key: "gln", label: "GLN", example: "8808808000121", slots: ["partyIdentification"], schemeID: "0088" }
        ]
    },
    {
        code: "SK", name: "Slovakia", folder: "slovakia",
        identifiers: [
            { key: "ico", label: "IČO", hint: "Organisation identifier (scheme 0158)", example: "36045612", slots: ["endpointId"], schemeID: "0158" },
            { key: "vat", label: "IČ DPH / VAT", example: "SK2020317068", slots: ["taxScheme"], taxScheme: "VAT" }
        ]
    },
    {
        code: "ES", name: "Spain", folder: "spain",
        identifiers: [
            { key: "vat", label: "NIF / VAT", hint: "Spanish VAT (ES + NIF/CIF)", example: "ESB12121212", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "legalId", label: "Company ID", example: "12345678", slots: ["legalEntityCompanyId"] }
        ]
    },
    {
        code: "SE", name: "Sweden", folder: "sweden",
        identifiers: [
            { key: "orgNumber", label: "Organisation number", hint: "10-digit org. number (scheme 0007)", example: "556752-2981", slots: ["endpointId", "legalEntityCompanyId"], schemeID: "0007" },
            { key: "gln", label: "GLN", example: "8808808000121", slots: ["partyIdentification"], schemeID: "0088" },
            { key: "vat", label: "VAT number", hint: "SE + 12 digits", example: "SE123456789001", slots: ["taxScheme"], taxScheme: "VAT" }
        ]
    },
    {
        code: "TR", name: "Türkiye", folder: "turkiye",
        identifiers: [
            { key: "vat", label: "Tax number (VKN)", hint: "10-digit tax number", example: "1234567890", slots: ["taxScheme"], taxScheme: "VAT" }
        ]
    },
    {
        code: "AE", name: "United Arab Emirates", folder: "uae",
        identifiers: [
            { key: "trn", label: "TRN", hint: "15-digit Tax Registration Number — also used as the electronic address", example: "100000000000003", slots: ["endpointId", "taxScheme"], schemeID: "0235", taxScheme: "VAT" },
            { key: "lra", label: "Legal registration authority", hint: "Issuer of the trade licence (scheme AE:LRA)", example: "Department of Economic Development - Dubai", slots: ["partyIdentification"], schemeID: "AE:LRA" },
            { key: "tradeLicense", label: "Trade licence no.", hint: "Scheme AE:TL", example: "CN-1234567", slots: ["legalEntityCompanyId"], schemeID: "AE:TL" }
        ]
    },
    {
        code: "GB", name: "United Kingdom", folder: "united kingdom",
        identifiers: [
            { key: "vat", label: "VAT number", hint: "GB + 9 digits", example: "GB1234567891", slots: ["taxScheme"], taxScheme: "VAT" },
            { key: "companyNumber", label: "Company number", hint: "Companies House number (scheme 9932)", example: "GB1234567891", slots: ["endpointId", "legalEntityCompanyId"], schemeID: "9932" },
            { key: "gln", label: "GLN", example: "8808808000121", slots: ["partyIdentification"], schemeID: "0088" }
        ]
    },
    {
        code: "US", name: "United States", folder: "usa",
        identifiers: [
            { key: "taxId", label: "Tax ID / EIN", hint: "Federal Employer Identification Number", example: "12-3456789", slots: ["taxScheme"], taxScheme: "GST" }
        ]
    },
    {
        code: "VN", name: "Vietnam", folder: "vietnam",
        identifiers: [
            { key: "taxCode", label: "Tax code (MST)", hint: "Vietnamese enterprise tax code", example: "1234567890", slots: ["taxScheme"], taxScheme: "TAX" }
        ]
    }
];

// Look-ups (built once).
PUG_DATA.countriesByCode = PUG_DATA.countries.reduce(function (map, country) {
    // First entry for a code wins for the generic lookup; specific variants
    // (e.g. Basque Country) are still reachable through the full list.
    if (!map[country.code]) map[country.code] = country;
    return map;
}, {});

PUG_DATA.getCountryIdentifiers = function (code) {
    var country = PUG_DATA.countriesByCode[(code || "").toUpperCase()];
    return country ? country.identifiers : PUG_DATA.defaultIdentifiers;
};

// The ISO 3166-1 alpha-2 country code to write into the XML. Usually the same
// as the lookup code, but variants (e.g. ES-PV Basque Country) map back to ES.
PUG_DATA.isoCountryCode = function (code) {
    var c = PUG_DATA.countriesByCode[(code || "").toUpperCase()];
    return (c && c.iso) || (code || "").toUpperCase();
};

// Default standard VAT/GST rates (%) — starting points the user can override.
// Verify against current local rates before relying on them.
PUG_DATA.defaultTaxRates = {
    "AT": "20", "AU": "10", "BE": "21", "CH": "8.1", "CN": "13", "CZ": "21",
    "DE": "19", "DK": "25", "ES": "21", "ES-PV": "21", "FI": "25.5", "FR": "20",
    "GB": "20", "IE": "23", "IN": "18", "IT": "22", "JP": "10", "NL": "21",
    "NO": "25", "PL": "23", "PT": "23", "RO": "19", "SA": "15", "SE": "25",
    "SG": "9", "TR": "20", "AE": "5", "US": "0"
};
PUG_DATA.defaultTaxRateFor = function (code) {
    return PUG_DATA.defaultTaxRates[(code || "").toUpperCase()] || "";
};

// Default document currency per country (falls back to the Settings default).
PUG_DATA.defaultCurrencies = {
    "AU": "AUD", "CH": "CHF", "CN": "CNY", "CZ": "CZK", "DK": "DKK", "GB": "GBP",
    "IN": "INR", "JP": "JPY", "NO": "NOK", "PL": "PLN", "RO": "RON", "SA": "SAR",
    "SE": "SEK", "SG": "SGD", "TR": "TRY", "AE": "AED", "US": "USD"
};
PUG_DATA.defaultCurrencyFor = function (code) {
    var up = (code || "").toUpperCase();
    if (PUG_DATA.defaultCurrencies[up]) return PUG_DATA.defaultCurrencies[up];
    return PUG_DATA.countriesByCode[up] ? "EUR" : "";
};