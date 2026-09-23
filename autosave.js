/* Automatisches Speichern der Wertungsseiten.
   Jede Eingabe wird sofort im Browser gesichert. Ist in sync.js eine
   Worker-Adresse eingetragen, geht sie zusätzlich auf den Server, damit
   Laptop und Handy denselben Stand zeigen. */
(function () {
    var PAGE = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
    var STORAGE_KEY = 'rallye:' + PAGE;
    var PUSH_DELAY = 800;      // Tippen sammeln, bevor gesendet wird
    var POLL_EVERY = 15000;    // so oft beim Server nachfragen
    var EDIT_GRACE = 6000;     // so lange nach einer Eingabe nichts überschreiben

    var sync = window.RALLYE_SYNC;
    var stamp = 0;             // Zeitpunkt unseres letzten Standes
    var lastEdit = 0;
    var pushTimer, badgeTimer, badge, bar;

    function storage() {
        try {
            localStorage.setItem('__t__', '1');
            localStorage.removeItem('__t__');
            return localStorage;
        } catch (e) { return null; }
    }

    function fields() {
        return [].slice.call(document.querySelectorAll('input[id], select[id], textarea[id]'));
    }

    function collect() {
        var data = {};
        fields().forEach(function (el) {
            data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        });
        return data;
    }

    function apply(data) {
        var touched = [];
        fields().forEach(function (el) {
            if (!Object.prototype.hasOwnProperty.call(data, el.id)) return;
            if (el.type === 'checkbox') el.checked = !!data[el.id];
            else el.value = data[el.id];
            touched.push(el);
        });
        // Die Seite mit den geladenen Werten neu durchrechnen lassen.
        touched.forEach(function (el) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        return touched.length;
    }

    function readLocal() {
        var s = storage();
        if (!s) return null;
        var raw = s.getItem(STORAGE_KEY);
        if (!raw) return null;
        var parsed;
        try { parsed = JSON.parse(raw); } catch (e) { return null; }
        // Ältere Fassung speicherte die Felder direkt, ohne Zeitstempel.
        if (parsed && parsed.data) return parsed;
        return { data: parsed, updatedAt: 0 };
    }

    function writeLocal(data, updatedAt) {
        var s = storage();
        if (!s) return false;
        try {
            s.setItem(STORAGE_KEY, JSON.stringify({ data: data, updatedAt: updatedAt }));
            return true;
        } catch (e) { return false; }
    }

    function uhrzeit(ms) {
        var d = new Date(ms);
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function show(text, sticky) {
        if (!badge) return;
        badge.textContent = text;
        badge.style.opacity = '1';
        clearTimeout(badgeTimer);
        if (!sticky) badgeTimer = setTimeout(function () { badge.style.opacity = '.5'; }, 2500);
    }

    /* ---------- Server ---------- */

    function serverReady() {
        return sync && sync.enabled() && sync.hasCode();
    }

    function push() {
        if (!serverReady()) return;
        sync.save(PAGE, collect()).then(function (res) {
            stamp = res.updatedAt;
            writeLocal(collect(), stamp);
            show('✓ geteilt ' + uhrzeit(stamp));
        }).catch(function (err) {
            show(err.status === 401 ? '⚠️ Code falsch' : '⚠️ offline, nur lokal', true);
        });
    }

    function pull(initial) {
        if (!serverReady()) return;
        if (!initial && Date.now() - lastEdit < EDIT_GRACE) return;
        sync.load(PAGE).then(function (res) {
            if (!res.data || res.updatedAt <= stamp) return;
            if (!initial && Date.now() - lastEdit < EDIT_GRACE) return;
            stamp = res.updatedAt;
            apply(res.data);
            writeLocal(res.data, stamp);
            show('✓ Stand vom Server ' + uhrzeit(stamp));
        }).catch(function (err) {
            show(err.status === 401 ? '⚠️ Code falsch' : '⚠️ offline, nur lokal', true);
        });
    }

    var polling = false;

    function startPolling() {
        if (polling || !serverReady()) return;
        polling = true;
        setInterval(function () { pull(false); }, POLL_EVERY);
        window.addEventListener('focus', function () { pull(false); });
    }

    function connect() {
        if (!sync || !sync.enabled()) {
            alert('Der Abgleich ist noch nicht eingerichtet. Die Worker-Adresse fehlt in sync.js.');
            return;
        }
        if (!sync.askForCode()) return;
        stamp = 0;
        pull(true);
        push();
        startPolling();
    }

    /* ---------- Leiste ---------- */

    function clearAll() {
        if (!confirm('Alle Eingaben dieser Seite löschen?')) return;
        var s = storage();
        if (s) s.removeItem(STORAGE_KEY);
        if (serverReady()) {
            sync.save(PAGE, {}).then(function () { location.reload(); })
                               .catch(function () { location.reload(); });
        } else {
            location.reload();
        }
    }

    function buildBar() {
        bar = document.createElement('div');
        bar.id = 'autosaveBar';
        bar.innerHTML = '<span id="autosaveBadge">✓ wird automatisch gespeichert</span>' +
                        '<button type="button" id="autosaveCode">Code</button>' +
                        '<button type="button" id="autosaveClear">Leeren</button>';
        document.body.appendChild(bar);
        badge = document.getElementById('autosaveBadge');
        document.getElementById('autosaveClear').addEventListener('click', clearAll);
        document.getElementById('autosaveCode').addEventListener('click', connect);
        if (!sync || !sync.enabled()) document.getElementById('autosaveCode').style.display = 'none';

        var css = document.createElement('style');
        css.textContent =
            '#autosaveBar{position:fixed;right:12px;bottom:12px;z-index:9999;display:flex;' +
            'align-items:center;gap:8px;background:rgba(33,37,41,.92);color:#fff;padding:8px 12px;' +
            'border-radius:999px;font:600 13px/1 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3)}' +
            '#autosaveBadge{opacity:.5;transition:opacity .2s}' +
            '#autosaveBar button{border:0;border-radius:999px;padding:5px 10px;cursor:pointer;' +
            'background:#ffd43b;color:#212529;font:600 12px/1 system-ui,sans-serif}' +
            '#autosaveBar button:hover{background:#fcc419}' +
            '@media(max-width:480px){#autosaveBar{left:12px;right:12px;justify-content:space-between}}' +
            '@media print{#autosaveBar{display:none}}';
        document.head.appendChild(css);
    }

    /* ---------- Start ---------- */

    document.addEventListener('DOMContentLoaded', function () {
        if (!fields().length) return;
        buildBar();

        if (!storage()) show('⚠️ Browser speichert nicht', true);

        var local = readLocal();
        if (local) {
            stamp = local.updatedAt || 0;
            if (apply(local.data)) show('✓ Eingaben geladen');
        }

        function onEdit(e) {
            if (!e.target || !e.target.id || e.target.id.indexOf('autosave') === 0) return;
            lastEdit = Date.now();
            stamp = lastEdit;
            writeLocal(collect(), stamp);
            show('✓ gespeichert ' + uhrzeit(stamp));
            clearTimeout(pushTimer);
            pushTimer = setTimeout(push, PUSH_DELAY);
        }
        document.addEventListener('input', onEdit, true);
        document.addEventListener('change', onEdit, true);

        if (sync && sync.enabled()) {
            if (!sync.hasCode()) show('Code eingeben, dann teilen alle Geräte den Stand', true);
            else {
                pull(true);
                startPolling();
            }
        }
    });
}());
