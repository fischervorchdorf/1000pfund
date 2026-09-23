/* Sichern und Einlesen des gesamten Punktestands als Datei.
   Nimmt alle sieben Tageswertungen und die Gesamtwertung mit, egal von
   welcher Seite aus gesichert wird. Braucht keinen Server. */
(function () {
    // Alles, was zur Wertung gehoert. Der Rallye-Code bleibt absichtlich draussen,
    // damit eine weitergegebene Sicherung kein Passwort enthaelt.
    var DAYS = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];

    function store() {
        try {
            localStorage.setItem('__t__', '1');
            localStorage.removeItem('__t__');
            return localStorage;
        } catch (e) { return null; }
    }

    function keys() {
        var list = DAYS.map(function (d) { return 'rallye:' + d; });
        list.push('rallyeData', 'rallyeData:stand');
        return list;
    }

    function sammeln() {
        var s = store();
        if (!s) return null;
        var daten = {};
        keys().forEach(function (k) {
            var wert = s.getItem(k);
            if (wert !== null) daten[k] = wert;
        });
        return daten;
    }

    function beschreiben(daten) {
        var tage = DAYS.filter(function (d) { return daten['rallye:' + d]; });
        var text = tage.length ? tage.length + ' Tageswertung' + (tage.length === 1 ? '' : 'en') +
                                 ' (' + tage.join(', ') + ')'
                               : 'keine Tageswertung';
        return text + (daten['rallyeData'] ? ' und die Gesamtwertung' : ', keine Gesamtwertung');
    }

    function zeitstempel() {
        var d = new Date(), z = function (n) { return ('0' + n).slice(-2); };
        return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) +
               '-' + z(d.getHours()) + z(d.getMinutes());
    }

    function sichern() {
        var daten = sammeln();
        if (!daten) { alert('Dieser Browser gibt nichts heraus (privates Fenster?).'); return; }
        if (!Object.keys(daten).length) { alert('Es ist noch nichts eingetragen, das sich sichern liesse.'); return; }

        var datei = {
            app: '1000pfund',
            art: 'wertung-sicherung',
            version: 1,
            erstellt: new Date().toISOString(),
            inhalt: daten
        };
        var blob = new Blob([JSON.stringify(datei, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = '1000pfund-wertung-' + zeitstempel() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function einlesen(text) {
        var datei;
        try { datei = JSON.parse(text); } catch (e) {
            alert('Das ist keine gültige Sicherungsdatei.');
            return;
        }
        if (!datei || datei.app !== '1000pfund' || !datei.inhalt) {
            alert('Diese Datei gehört nicht zur 1000 Pfund Rallye.');
            return;
        }
        var erlaubt = keys();
        var inhalt = {};
        Object.keys(datei.inhalt).forEach(function (k) {
            if (erlaubt.indexOf(k) !== -1 && typeof datei.inhalt[k] === 'string') inhalt[k] = datei.inhalt[k];
        });
        if (!Object.keys(inhalt).length) { alert('In der Datei steht keine Wertung.'); return; }

        var wann = datei.erstellt ? new Date(datei.erstellt).toLocaleString('de-AT') : 'unbekannt';
        if (!confirm('Sicherung vom ' + wann + '\n\nEnthält: ' + beschreiben(inhalt) +
                     '\n\nDie vorhandenen Eingaben dieser Bereiche werden überschrieben. Fortfahren?')) return;

        var s = store();
        if (!s) { alert('Dieser Browser speichert nichts (privates Fenster?).'); return; }
        Object.keys(inhalt).forEach(function (k) { s.setItem(k, inhalt[k]); });
        alert('Eingelesen. Die Seite wird neu geladen.');
        location.reload();
    }

    function auswaehlen() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', function () {
            var datei = input.files && input.files[0];
            if (!datei) return;
            var leser = new FileReader();
            leser.onload = function () { einlesen(String(leser.result)); };
            leser.onerror = function () { alert('Die Datei liess sich nicht lesen.'); };
            leser.readAsText(datei);
        });
        input.click();
    }

    function css() {
        if (document.getElementById('rallyeBarCss')) return;
        var style = document.createElement('style');
        style.id = 'rallyeBarCss';
        style.textContent =
            '#autosaveBar{position:fixed;right:12px;bottom:12px;z-index:9999;display:flex;' +
            'align-items:center;gap:8px;background:rgba(33,37,41,.92);color:#fff;padding:8px 12px;' +
            'border-radius:999px;font:600 13px/1 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3)}' +
            '#autosaveBar button{border:0;border-radius:999px;padding:5px 10px;cursor:pointer;' +
            'background:#ffd43b;color:#212529;font:600 12px/1 system-ui,sans-serif}' +
            '#autosaveBar button:hover{background:#fcc419}' +
            '@media(max-width:480px){#autosaveBar{left:12px;right:12px;justify-content:space-between}}' +
            '@media print{#autosaveBar{display:none}}';
        document.head.appendChild(style);
    }

    function knopf(text, titel, fn) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.title = titel;
        b.addEventListener('click', fn);
        return b;
    }

    document.addEventListener('DOMContentLoaded', function () {
        css();
        var bar = document.getElementById('autosaveBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'autosaveBar';
            bar.appendChild(document.createTextNode('Punktestand'));
            document.body.appendChild(bar);
        }
        bar.appendChild(knopf('Sichern', 'Alle Wertungen als Datei herunterladen', sichern));
        bar.appendChild(knopf('Einlesen', 'Eine gesicherte Datei wieder einspielen', auswaehlen));
    });

    window.RALLYE_BACKUP = { sichern: sichern, einlesen: auswaehlen };
}());
