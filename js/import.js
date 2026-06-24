"use strict";

/*
  js/import.js
  ------------
  Turns a pasted / CSV scenario table into scenario objects. Attached to
  window.PUF.import.

  Recognised columns (case / spacing / punctuation insensitive):
    Core    : scenario number, direction, document type, country, currency,
              issue date, amount, payable
    Parties : any core party column prefixed with a party word, e.g.
                seller name, supplier vat, from country
                buyer name, customer vat, to siret
              Country-specific identifiers can be addressed by their key, e.g.
              "seller siret", "buyer gstin", "supplier org number".
*/

window.PUF = window.PUF || {};

PUF.import = (function () {
    var util = PUF.util;

    var CORE_ALIASES = {
        scenarioNumber: ["scenario", "scenario number", "number", "no", "id", "invoice number", "invoice no", "document number", "doc number", "ref", "reference"],
        direction: ["direction", "ap ar", "apar", "ar ap", "flow"],
        docType: ["doc type", "document type", "type"],
        country: ["country", "country code", "market"],
        currency: ["currency", "currency code", "ccy"],
        issueDate: ["issue date", "date", "invoice date", "document date"],
        amount: ["amount", "total", "gross", "gross amount", "total amount", "value"],
        payableAmount: ["payable", "payable amount", "amount due", "due"]
    };

    var SELLER_PREFIXES = ["seller", "supplier", "from", "vendor"];
    var BUYER_PREFIXES = ["buyer", "customer", "to", "client"];

    var PARTY_FIELD_ALIASES = {
        name: ["name", "trading name", "party name"],
        legalName: ["legal name", "registration name", "legal", "company name"],
        country: ["country", "country code"],
        street: ["street", "address", "street name", "address line"],
        city: ["city", "town"],
        postalZone: ["postal", "postal code", "zip", "post code", "postcode"],
        region: ["region", "state", "province", "subentity", "county"],
        contactName: ["contact", "contact name"],
        contactEmail: ["email", "contact email", "e mail"],
        contactPhone: ["phone", "telephone", "contact phone", "tel"]
    };

    // Friendly aliases that resolve to an identifier key.
    var ID_KEY_ALIASES = {
        "org number": "orgNumber",
        "organisation number": "orgNumber",
        "organization number": "orgNumber",
        "company number": "companyNumber",
        "enterprise number": "enterprise",
        "business id": "businessId",
        "corporate number": "corporateNumber",
        "trade register": "tradeRegister",
        "trade licence": "tradeLicense",
        "trade license": "tradeLicense",
        "tax id": "taxId",
        "tax code": "taxCode",
        "tax number": "vat"
    };

    // Build a set of all identifier keys (normalised, spaces removed) -> key.
    var ID_KEYS = (function () {
        var map = {};
        (PUF_DATA.countries || []).forEach(function (country) {
            (country.identifiers || []).forEach(function (def) {
                map[def.key.toLowerCase()] = def.key;
            });
        });
        (PUF_DATA.defaultIdentifiers || []).forEach(function (def) {
            map[def.key.toLowerCase()] = def.key;
        });
        return map;
    })();

    function parseScenarioText(text) {
        var lines = String(text || "").split(/\r\n|\r|\n/).filter(function (line) {
            return line.trim() !== "";
        });
        if (!lines.length) return { scenarios: [], matched: [], unmatched: [], error: "No rows found." };

        var delimiter = detectDelimiter(lines[0]);
        var header = parseDelimitedLine(lines[0], delimiter).map(normaliseHeader);
        var mapping = buildMapping(header);

        var matched = mapping.filter(function (m) { return m; }).map(describeColumn);
        var unmatched = [];
        mapping.forEach(function (m, i) {
            if (!m && header[i]) unmatched.push(header[i]);
        });

        if (!mapping.some(function (m) { return m && m.field === "scenarioNumber"; }) &&
            !mapping.some(function (m) { return m && m.party; })) {
            return {
                scenarios: [], matched: matched, unmatched: unmatched,
                error: "Could not find a scenario number or any party columns in the header row."
            };
        }

        var scenarios = [];
        for (var r = 1; r < lines.length; r += 1) {
            var cells = parseDelimitedLine(lines[r], delimiter);
            if (cells.every(function (c) { return c.trim() === ""; })) continue;
            scenarios.push(buildScenario(cells, mapping, scenarios.length + 1));
        }

        return { scenarios: scenarios, matched: matched, unmatched: unmatched, error: null };
    }

    function buildScenario(cells, mapping, index) {
        var s = newScenario();
        s.scenarioNumber = "";

        mapping.forEach(function (m, i) {
            if (!m) return;
            var value = (cells[i] || "").trim();
            if (value === "") return;

            if (m.party) {
                var party = m.party === "seller" ? s.seller : s.buyer;
                if (m.idKey) {
                    party.ids[m.idKey] = value;
                } else if (m.partyField === "country") {
                    party.country = value.toUpperCase();
                } else {
                    party[m.partyField] = value;
                }
                return;
            }

            switch (m.field) {
                case "direction": s.direction = normaliseDirection(value); break;
                case "docType": s.docType = normaliseDocType(value); break;
                case "country": s.country = value.toUpperCase(); break;
                case "currency": s.currency = value.toUpperCase(); break;
                case "issueDate": s.issueDate = value; break;
                case "amount": s.amount = value; break;
                case "payableAmount": s.payableAmount = value; break;
                default: s[m.field] = value;
            }
        });

        if (!s.scenarioNumber) s.scenarioNumber = "INV-" + String(index).padStart(3, "0");
        return s;
    }

    function newScenario() {
        return {
            id: util.uid("s"),
            scenarioNumber: "",
            direction: "AR",
            docType: "INVOICE",
            country: "",
            currency: "",
            issueDate: "",
            amount: "",
            payableAmount: "",
            seller: newParty(),
            buyer: newParty()
        };
    }

    function newParty() {
        return {
            country: "", name: "", legalName: "", ids: {},
            street: "", city: "", postalZone: "", region: "",
            contactName: "", contactEmail: "", contactPhone: ""
        };
    }

    /* ----------------------------- header mapping ------------------------- */

    function buildMapping(header) {
        return header.map(function (h) { return matchHeader(h); });
    }

    function matchHeader(h) {
        if (!h) return null;

        // Party-prefixed?
        var prefixHit = takePrefix(h, SELLER_PREFIXES) || takePrefix(h, BUYER_PREFIXES);
        if (prefixHit) {
            var party = SELLER_PREFIXES.indexOf(prefixHit.prefix) >= 0 ? "seller" : "buyer";
            var rest = prefixHit.rest;

            var idKey = resolveIdKey(rest);
            if (idKey) return { party: party, idKey: idKey, raw: h };

            var partyField = matchAlias(rest, PARTY_FIELD_ALIASES);
            if (partyField) return { party: party, partyField: partyField, raw: h };

            // Unknown party attribute — ignore but record nothing.
            return null;
        }

        var coreField = matchAlias(h, CORE_ALIASES);
        if (coreField) return { field: coreField, raw: h };

        return null;
    }

    function takePrefix(h, prefixes) {
        for (var i = 0; i < prefixes.length; i += 1) {
            var p = prefixes[i];
            if (h === p) return { prefix: p, rest: "" };
            if (h.indexOf(p + " ") === 0) return { prefix: p, rest: h.slice(p.length + 1) };
        }
        return null;
    }

    function resolveIdKey(rest) {
        if (!rest) return null;
        if (ID_KEY_ALIASES[rest]) return ID_KEY_ALIASES[rest];
        var collapsed = rest.replace(/\s+/g, "");
        if (ID_KEYS[collapsed]) return ID_KEYS[collapsed];
        return null;
    }

    function matchAlias(value, table) {
        var keys = Object.keys(table);
        for (var i = 0; i < keys.length; i += 1) {
            if (table[keys[i]].indexOf(value) >= 0) return keys[i];
        }
        return null;
    }

    function describeColumn(m) {
        if (m.party) {
            var what = m.idKey || m.partyField;
            return m.party + " · " + what;
        }
        return m.field;
    }

    /* ----------------------------- value helpers -------------------------- */

    function normaliseDirection(value) {
        var v = value.toLowerCase();
        if (/^(ar|receivable|sales|sell|seller|outgoing|sending|sent|issued)/.test(v)) return "AR";
        if (/^(ap|payable|purchase|buy|buyer|incoming|receiving|received)/.test(v)) return "AP";
        return "AR";
    }

    function normaliseDocType(value) {
        var v = value.toLowerCase();
        if (/credit/.test(v) || v === "381") return "CREDIT_NOTE";
        return "INVOICE";
    }

    /* --------------------------- delimited parsing ------------------------ */

    function detectDelimiter(line) {
        var tab = (line.match(/\t/g) || []).length;
        var comma = (line.match(/,/g) || []).length;
        var semi = (line.match(/;/g) || []).length;
        if (tab >= comma && tab >= semi && tab > 0) return "\t";
        if (semi > comma && semi > 0) return ";";
        if (comma > 0) return ",";
        return tab > 0 ? "\t" : ",";
    }

    function parseDelimitedLine(line, delimiter) {
        var result = [];
        var current = "";
        var inQuotes = false;
        for (var i = 0; i < line.length; i += 1) {
            var ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { current += '"'; i += 1; }
                    else inQuotes = false;
                } else {
                    current += ch;
                }
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === delimiter) {
                result.push(current);
                current = "";
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result.map(trimOuterQuotes);
    }

    function trimOuterQuotes(value) {
        var v = value.trim();
        if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') {
            v = v.slice(1, -1).replace(/""/g, '"');
        }
        return v.trim();
    }

    function normaliseHeader(h) {
        return String(h || "")
            .trim()
            .replace(/^["']|["']$/g, "")
            .toLowerCase()
            .replace(/[_\-/]+/g, " ")
            .replace(/[^a-z0-9 ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    return {
        parseScenarioText: parseScenarioText,
        newScenario: newScenario,
        newParty: newParty
    };
})();
