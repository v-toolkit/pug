"use strict";

/*
  js/examples.js
  --------------
  Optional online enhancement: after a country is picked, look up which real
  example files exist for it (from a small build-time index, examples/manifest.json)
  and fetch the chosen file's content from raw.githubusercontent.com at the pinned
  commit SHA recorded in the manifest.

  Nothing is bundled into the app — only a ~25 KB index. Content is fetched live
  from the exact commit the index was built from, so it is current (advances when
  the submodule is bumped and the site is redeployed) and deterministic.

  This is progressive enhancement: when fetch is unavailable (opened via file://)
  or any request fails, every function resolves to "nothing available" and the
  caller falls back to the manual paste flow. It never throws into the UI.

  Attached to window.PUG.examples. Loaded before app.js.
*/

window.PUG = window.PUG || {};

PUG.examples = (function () {
    var MANIFEST_URL = "examples/manifest.json";
    var _cache = null;
    var _loaded = false;
    var _fetch = null; // test injection

    function setFetch(fn) { _fetch = fn; _loaded = false; _cache = null; } // for tests
    function getFetch() {
        if (_fetch) return _fetch;
        if (typeof window !== "undefined" && typeof window.fetch === "function") return window.fetch.bind(window);
        if (typeof fetch === "function") return fetch;
        return null;
    }
    function available() { return !!getFetch(); }

    // Resolve the manifest once; cache it. Any failure → null (feature off).
    function load() {
        if (_loaded) return Promise.resolve(_cache);
        var fn = getFetch();
        if (!fn) { _loaded = true; _cache = null; return Promise.resolve(null); }
        return fn(MANIFEST_URL).then(function (r) {
            if (!r || !r.ok) throw new Error("manifest HTTP " + (r && r.status));
            return r.json();
        }).then(function (json) {
            _loaded = true; _cache = json; return json;
        }).catch(function () {
            _loaded = true; _cache = null; return null;
        });
    }

    // Entries for a country folder, or [] if none / unavailable.
    function forFolder(folder) {
        return load().then(function (m) {
            if (!m || !m.folders || !folder) return [];
            var list = m.folders[folder];
            return list ? list.slice() : [];
        });
    }

    // Fetch one example's content. Rejects on failure (caller shows fallback).
    function fetchText(href) {
        var fn = getFetch();
        if (!fn) return Promise.reject(new Error("offline"));
        return fn(href).then(function (r) {
            if (!r || !r.ok) throw new Error("HTTP " + (r && r.status));
            return r.text();
        });
    }

    // Sensible default to auto-load: a generic invoice, else any invoice, else first.
    function defaultEntry(entries) {
        if (!entries || !entries.length) return null;
        var byGeneric = entries.filter(function (e) { return e.kind === "invoice" && /generic/i.test(e.file || ""); });
        if (byGeneric.length) return byGeneric[0];
        var invoices = entries.filter(function (e) { return e.kind === "invoice"; });
        if (invoices.length) return invoices[0];
        return entries[0];
    }

    return {
        MANIFEST_URL: MANIFEST_URL,
        setFetch: setFetch,
        available: available,
        load: load,
        forFolder: forFolder,
        fetchText: fetchText,
        defaultEntry: defaultEntry
    };
})();