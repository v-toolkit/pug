"use strict";

/*
  data/document-types.js
  ----------------------
  Registry of the document types the generator can build. Everything that
  differs between document types lives here, so adding a new type later (debit
  note, self-billed invoice, etc.) is a matter of appending one entry — no code
  changes required.

  We start with the Invoice. Credit notes are included and working; further
  types can follow the same shape.

  FIELDS
    key            internal id (used in the UI and scenario data)
    label          shown in the document-type dropdown
    enabled        whether it appears in the dropdown
    rootElement    XML root element local name (e.g. "Invoice")
    namespace      default namespace for the root element (PUF)
    typeCodeElement  element that carries the type code (e.g. "InvoiceTypeCode")
    typeCode       default UN/CEFACT code (380 invoice, 381 credit note, ...)
    lineElement    repeating line element local name (e.g. "InvoiceLine")
    customizationId / profileId   PUF billing identifiers
*/

window.PUF_DATA = window.PUF_DATA || {};

PUF_DATA.documentTypes = [
    {
        key: "INVOICE",
        label: "Invoice",
        enabled: true,
        rootElement: "Invoice",
        namespace: "urn:pagero:PageroUniversalFormat:Invoice:1.0",
        typeCodeElement: "InvoiceTypeCode",
        typeCode: "380",
        lineElement: "InvoiceLine",
        customizationId: "urn:pagero.com:puf:billing:2.0",
        profileId: "urn:pagero.com:puf:billing:1.0"
    },
    {
        key: "CREDIT_NOTE",
        label: "Credit note",
        enabled: true,
        rootElement: "CreditNote",
        namespace: "urn:pagero:PageroUniversalFormat:CreditNote:1.0",
        typeCodeElement: "CreditNoteTypeCode",
        typeCode: "381",
        lineElement: "CreditNoteLine",
        customizationId: "urn:pagero.com:puf:billing:2.0",
        profileId: "urn:pagero.com:puf:billing:1.0"
    }
    // Future types (append and set enabled:true when ready), e.g.:
    // { key:"DEBIT_NOTE", label:"Debit note", enabled:false, rootElement:"DebitNote", ... }
];

PUF_DATA.documentTypesByKey = PUF_DATA.documentTypes.reduce(function (map, type) {
    map[type.key] = type;
    return map;
}, {});

PUF_DATA.getDocumentType = function (key) {
    return PUF_DATA.documentTypesByKey[key] || PUF_DATA.documentTypesByKey.INVOICE;
};

PUF_DATA.enabledDocumentTypes = function () {
    return PUF_DATA.documentTypes.filter(function (type) { return type.enabled; });
};