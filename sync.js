/* Punktestand zwischen Geräten abgleichen.
   Ohne Adresse unten läuft alles wie bisher: nur lokal im Browser. */
window.RALLYE_SYNC = (function () {

    /* ====== HIER die Worker-Adresse eintragen, siehe worker-wertung/README.md ======
       Beispiel: var API = "https://rallye-wertung.deinname.workers.dev"; */
    var API = "";
    /* ============================================================================ */

    var CODE_KEY = 'rallye:code';
    var listeners = [];

    function enabled() { return !!API; }

    function store() {
        try { return localStorage; } catch (e) { return null; }
    }

    function code() {
        var s = store();
        return s ? (s.getItem(CODE_KEY) || '') : '';
    }

    function setCode(value) {
        var s = store();
        if (s) s.setItem(CODE_KEY, value || '');
    }

    function askForCode() {
        var given = prompt('Rallye-Code eingeben, damit die Punkte auf allen Geräten gleich sind:', code());
        if (given === null) return false;
        setCode(given.trim());
        return true;
    }

    function forgetCode() {
        var s = store();
        if (s) s.removeItem(CODE_KEY);
    }

    function call(action, page, data) {
        if (!enabled()) return Promise.reject(new Error('aus'));
        if (!code()) return Promise.reject(new Error('kein Code'));
        return fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, code: code(), page: page, data: data })
        }).then(function (r) {
            return r.json().then(function (body) {
                if (!r.ok) {
                    var err = new Error(body && body.error ? body.error : 'Fehler ' + r.status);
                    err.status = r.status;
                    throw err;
                }
                return body;
            });
        });
    }

    function onStatus(fn) { listeners.push(fn); }
    function status(text, kind) {
        listeners.forEach(function (fn) { fn(text, kind); });
    }

    return {
        enabled: enabled,
        hasCode: function () { return !!code(); },
        askForCode: askForCode,
        forgetCode: forgetCode,
        load: function (page) { return call('load', page, null); },
        save: function (page, data) { return call('save', page, data); },
        onStatus: onStatus,
        status: status
    };
}());
