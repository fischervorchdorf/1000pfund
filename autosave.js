/* Automatisches Speichern der Tageswertungen.
   Jede Eingabe wird sofort im Browser gesichert und beim naechsten Aufruf
   derselben Seite wiederhergestellt. Gespeichert wird pro Geraet und Browser. */
(function () {
    var STORAGE_KEY = 'rallye:' + (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
    var fields = [];
    var badge, hint, timer;

    function storage() {
        try {
            var t = '__test__';
            localStorage.setItem(t, t);
            localStorage.removeItem(t);
            return localStorage;
        } catch (e) {
            return null;
        }
    }

    function valueOf(el) {
        return el.type === 'checkbox' ? el.checked : el.value;
    }

    function save() {
        var store = storage();
        if (!store) return;
        var data = {};
        fields.forEach(function (el) { data[el.id] = valueOf(el); });
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            show('⚠️ Speicher voll', true);
            return;
        }
        var now = new Date();
        show('✓ gespeichert ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2));
    }

    function restore() {
        var store = storage();
        if (!store) {
            show('⚠️ Browser speichert nicht', true);
            return;
        }
        var raw = store.getItem(STORAGE_KEY);
        if (!raw) return;
        var data;
        try { data = JSON.parse(raw); } catch (e) { return; }
        var touched = [];
        fields.forEach(function (el) {
            if (!Object.prototype.hasOwnProperty.call(data, el.id)) return;
            if (el.type === 'checkbox') el.checked = !!data[el.id];
            else el.value = data[el.id];
            touched.push(el);
        });
        // Rechnet die Seite mit den geladenen Werten neu durch.
        touched.forEach(function (el) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        if (touched.length) show('✓ Eingaben geladen');
    }

    function clearAll() {
        if (!confirm('Alle Eingaben dieser Seite löschen?')) return;
        var store = storage();
        if (store) store.removeItem(STORAGE_KEY);
        location.reload();
    }

    function show(text, sticky) {
        if (!badge) return;
        badge.textContent = text;
        badge.style.opacity = '1';
        clearTimeout(timer);
        if (!sticky) timer = setTimeout(function () { badge.style.opacity = '0.45'; }, 2500);
    }

    function buildBar() {
        var bar = document.createElement('div');
        bar.id = 'autosaveBar';
        bar.innerHTML =
            '<span id="autosaveBadge">✓ wird automatisch gespeichert</span>' +
            '<button type="button" id="autosaveClear">Eingaben löschen</button>';
        document.body.appendChild(bar);
        badge = document.getElementById('autosaveBadge');
        document.getElementById('autosaveClear').addEventListener('click', clearAll);

        var css = document.createElement('style');
        css.textContent =
            '#autosaveBar{position:fixed;right:12px;bottom:12px;z-index:9999;display:flex;' +
            'align-items:center;gap:10px;background:rgba(33,37,41,.92);color:#fff;' +
            'padding:8px 12px;border-radius:999px;font:600 13px/1 system-ui,sans-serif;' +
            'box-shadow:0 4px 14px rgba(0,0,0,.3)}' +
            '#autosaveBadge{opacity:.45;transition:opacity .2s}' +
            '#autosaveBar button{border:0;border-radius:999px;padding:5px 10px;cursor:pointer;' +
            'background:#ffd43b;color:#212529;font:600 12px/1 system-ui,sans-serif}' +
            '#autosaveBar button:hover{background:#fcc419}' +
            '@media print{#autosaveBar{display:none}}';
        document.head.appendChild(css);
    }

    document.addEventListener('DOMContentLoaded', function () {
        fields = [].slice.call(document.querySelectorAll('input[id], select[id], textarea[id]'));
        if (!fields.length) return;
        buildBar();
        restore();
        document.addEventListener('input', function (e) {
            if (e.target && e.target.id) save();
        }, true);
        document.addEventListener('change', function (e) {
            if (e.target && e.target.id) save();
        }, true);
    });
}());
