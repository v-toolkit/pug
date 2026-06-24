"use strict";

/*
  data/code-lists.js
  ------------------
  Bundled STATIC reference enums used to validate values offline. These are
  stable standards (ISO 4217 currencies, ISO 3166-1 alpha-2 countries,
  UN/CEFACT tax category + scheme codes), not examples — bundling them is safe
  and is how we validate values without a network. Invoice *templates* are
  never bundled.

  Attached to window.PUG_DATA (loaded after countries.js, before validation.js).
*/

window.PUG_DATA = window.PUG_DATA || {};

(function () {
    // ISO 4217 — active currency codes (broad; includes the common supranational
    // codes so legitimate values are never false-flagged).
    var CURRENCIES = ("AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND " +
        "BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUC CUP CVE CZK DJF DKK DOP DZD " +
        "EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR " +
        "IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD " +
        "MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN " +
        "PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP " +
        "STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VED VES VND VUV " +
        "WST XAF XCD XDR XOF XPF XXX YER ZAR ZMW ZWG ZWL").split(" ");

    // ISO 3166-1 alpha-2 — country codes.
    var COUNTRIES = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ " +
        "BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY " +
        "CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM " +
        "GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE " +
        "KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML " +
        "MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF " +
        "PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN " +
        "SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ " +
        "VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");

    // UN/CEFACT 5305 tax category codes used in EN 16931 / PUF (PUF-012).
    var TAX_CATEGORIES = {
        S: "Standard rate",
        Z: "Zero rated",
        E: "Exempt from tax",
        AE: "Reverse charge",
        K: "Intra-community supply (VAT zero rated)",
        G: "Export outside the EU (VAT zero rated)",
        O: "Outside scope of tax",
        L: "Canary Islands general indirect tax (IGIC)",
        M: "Ceuta & Melilla tax (IPSI)"
    };

    // Tax scheme codes (PUF-009).
    var TAX_SCHEMES = ["VAT", "GST", "TAX"];

    var currencySet = toSet(CURRENCIES);
    var countrySet = toSet(COUNTRIES);
    var schemeSet = toSet(TAX_SCHEMES);

    function toSet(arr) {
        var m = {};
        arr.forEach(function (c) { m[c] = true; });
        return m;
    }

    PUG_DATA.codeLists = {
        currencies: CURRENCIES,
        countries: COUNTRIES,
        taxCategories: TAX_CATEGORIES,
        taxSchemes: TAX_SCHEMES
    };

    PUG_DATA.isCurrency = function (code) { return !!currencySet[(code || "").toUpperCase()]; };
    PUG_DATA.isCountryCode = function (code) { return !!countrySet[(code || "").toUpperCase()]; };
    PUG_DATA.isTaxScheme = function (code) { return !!schemeSet[(code || "").toUpperCase()]; };
    PUG_DATA.isTaxCategory = function (code) { return Object.prototype.hasOwnProperty.call(TAX_CATEGORIES, (code || "").toUpperCase()); };
})();