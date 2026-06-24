"use strict";

/*
  js/util.js
  ----------
  Small shared helpers. Attached to window.PUF.util so the other plain-script
  modules can use them without a build step (works when opened via file://).
*/

window.PUF = window.PUF || {};

PUF.util = (function () {

    function byId(id) {
        return document.getElementById(id);
    }

    function escapeXml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function setStatus(element, message, type) {
        if (!element) return;
        element.className = "status";
        if (type) element.classList.add("status--" + type);
        element.textContent = message;
    }

    function normaliseDate(value) {
        if (!value) return "";
        var trimmed = String(value).trim();

        var iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (iso) return iso[1] + "-" + pad2(iso[2]) + "-" + pad2(iso[3]);

        var slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (slash) return slash[3] + "-" + pad2(slash[2]) + "-" + pad2(slash[1]);

        var dot = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (dot) return dot[3] + "-" + pad2(dot[2]) + "-" + pad2(dot[1]);

        return "";
    }

    function pad2(value) {
        return String(value).padStart(2, "0");
    }

    function normaliseAmount(value) {
        if (value === null || value === undefined) return "";
        var raw = String(value).trim();
        if (!raw) return "";

        var cleaned = raw.replace(/\s/g, "").replace(/[^0-9.,-]/g, "");
        if (!cleaned) return "";

        var hasComma = cleaned.indexOf(",") >= 0;
        var hasDot = cleaned.indexOf(".") >= 0;

        if (hasComma && hasDot) {
            if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
                cleaned = cleaned.replace(/\./g, "").replace(",", ".");
            } else {
                cleaned = cleaned.replace(/,/g, "");
            }
        } else if (hasComma && !hasDot) {
            cleaned = cleaned.replace(/,/g, ".");
        }

        var number = Number(cleaned);
        if (!isFinite(number)) return "";
        return number.toFixed(2);
    }

    function sanitiseFilename(value) {
        var result = String(value || "invoice")
            .replace(/&amp;/g, "&")
            .replace(/[<>:"/\\|?*]+/g, "_")
            .replace(/\s+/g, "_")
            .trim()
            .slice(0, 160);
        return result || "invoice";
    }

    // Generate a short unique id for internal scenario tracking.
    var idCounter = 0;
    function uid(prefix) {
        idCounter += 1;
        return (prefix || "id") + "_" + idCounter;
    }

    return {
        byId: byId,
        escapeXml: escapeXml,
        escapeRegExp: escapeRegExp,
        setStatus: setStatus,
        normaliseDate: normaliseDate,
        normaliseAmount: normaliseAmount,
        sanitiseFilename: sanitiseFilename,
        uid: uid
    };
})();