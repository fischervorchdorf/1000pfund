/* Wertung je Team speichern.
   Jede Tagesseite hält für jedes Team einen eigenen Datensatz. Beim Wechsel
   der Teamauswahl wird der bisherige Stand weggeschrieben und der des neuen
   Teams geladen. Dazu: Tachostand und Punktestand aus den Vortagen.
   Ist in sync.js eine Worker-Adresse eingetragen, geht alles zusätzlich auf
   den Server. */
(function () {
    var TAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];
    var SEITE = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
    var SCHLUESSEL = 'rallye:' + SEITE;
    var TAG_NR = TAGE.indexOf(SEITE);          // -1, wenn keine Tagesseite
    var SENDE_VERZUG = 800;
    var TAKT = 15000;
    var SCHONFRIST = 6000;

    var sync = window.RALLYE_SYNC;
    var datensaetze = {};      // Teamname -> Felder
    var team = '';             // gerade gewähltes Team
    var standard = {};         // Ausgangswerte der Felder
    var stand = 0, letzteEingabe = 0;
    var sendeTimer, anzeigeTimer, anzeige, uebertrag;

    /* ---------- Speicher ---------- */

    function speicher() {
        try {
            localStorage.setItem('__t__', '1');
            localStorage.removeItem('__t__');
            return localStorage;
        } catch (e) { return null; }
    }

    function felder() {
        return [].slice.call(document.querySelectorAll('input[id], select[id], textarea[id]'));
    }

    function lies(el) { return el.type === 'checkbox' ? el.checked : el.value; }

    function schreib(el, wert) {
        if (el.type === 'checkbox') el.checked = !!wert;
        else el.value = wert;
    }

    function formular() {
        var werte = {};
        felder().forEach(function (el) {
            if (el.id === 'teamName') return;          // steckt im Datensatznamen
            werte[el.id] = lies(el);
        });
        werte.__summe = summe();
        return werte;
    }

    function summe() {
        var el = document.getElementById('totalPoints');
        return el ? (parseInt(el.textContent, 10) || 0) : 0;
    }

    /* ---------- Datei im Browser ---------- */

    function laden() {
        var s = speicher();
        if (!s) return {};
        var roh = s.getItem(SCHLUESSEL);
        if (!roh) return {};
        var obj;
        try { obj = JSON.parse(roh); } catch (e) { return {}; }

        if (obj && obj.teams) { stand = obj.updatedAt || 0; return obj.teams; }

        // Ältere Fassungen: ein einziger Datensatz ohne Teamtrennung.
        var alt = obj && obj.data ? obj.data : obj;
        stand = (obj && obj.updatedAt) || 0;
        if (!alt || typeof alt !== 'object') return {};
        var name = alt.teamName || '';
        if (!name) return {};
        var kopie = {};
        Object.keys(alt).forEach(function (k) { if (k !== 'teamName') kopie[k] = alt[k]; });
        var raus = {};
        raus[name] = kopie;
        return raus;
    }

    function sichern() {
        var s = speicher();
        if (!s) return false;
        try {
            s.setItem(SCHLUESSEL, JSON.stringify({ v: 2, teams: datensaetze, updatedAt: stand }));
            return true;
        } catch (e) { return false; }
    }

    /* ---------- Formular füllen ---------- */

    function merkeStandard() {
        felder().forEach(function (el) { standard[el.id] = lies(el); });
    }

    function aufStandard() {
        felder().forEach(function (el) {
            if (el.id === 'teamName') return;
            if (Object.prototype.hasOwnProperty.call(standard, el.id)) schreib(el, standard[el.id]);
        });
    }

    function teamVorgaben(name) {
        var liste = window.RALLYE_TEAMS || [];
        var t = liste.filter(function (x) { return x.name === name; })[0];
        if (!t) return;
        var m = document.getElementById('multiplier');
        if (m) m.value = t.multiplier.toFixed(2);
        var sp = document.getElementById('startPoints');
        if (sp && typeof t.startPoints === 'number') sp.value = t.startPoints;
    }

    function datensatzEinsetzen(rec) {
        felder().forEach(function (el) {
            if (el.id === 'teamName') return;
            if (Object.prototype.hasOwnProperty.call(rec, el.id)) schreib(el, rec[el.id]);
        });
    }

    // Tachostand vom Vortag desselben Teams, nur wenn das Feld noch leer ist.
    function tachoUebernehmen(name) {
        if (TAG_NR < 1) return;
        var start = document.getElementById('tachoStart');
        if (!start || String(start.value).trim() !== '') return;
        var s = speicher();
        if (!s) return;
        var roh = s.getItem('rallye:' + TAGE[TAG_NR - 1]);
        if (!roh) return;
        var obj;
        try { obj = JSON.parse(roh); } catch (e) { return; }
        var rec = obj && obj.teams ? obj.teams[name] : null;
        if (rec && String(rec.tachoEnd || '').trim() !== '') start.value = rec.tachoEnd;
    }

    // Punkte aller Vortage desselben Teams.
    function vortagePunkte(name) {
        if (TAG_NR < 1) return 0;
        var s = speicher();
        if (!s) return 0;
        var gesamt = 0;
        for (var i = 0; i < TAG_NR; i++) {
            var roh = s.getItem('rallye:' + TAGE[i]);
            if (!roh) continue;
            var obj;
            try { obj = JSON.parse(roh); } catch (e) { continue; }
            var rec = obj && obj.teams ? obj.teams[name] : null;
            if (rec && typeof rec.__summe === 'number') gesamt += rec.__summe;
        }
        return gesamt;
    }

    function neuRechnen() {
        felder().forEach(function (el) {
            if (el.id === 'teamName') return;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    function uebertragZeigen() {
        if (!uebertrag) return;
        if (!team) { uebertrag.style.display = 'none'; return; }
        var vor = vortagePunkte(team);
        var heute = summe();
        uebertrag.style.display = '';
        uebertrag.innerHTML = TAG_NR < 1
            ? 'Erster Tag, noch keine Vortage.'
            : 'Punkte aus den Vortagen: <b>' + vor + '</b>' +
              ' &nbsp;·&nbsp; heute: <b>' + heute + '</b>' +
              ' &nbsp;·&nbsp; Gesamtstand: <b>' + (vor + heute) + '</b>';
    }

    function teamLaden(name) {
        aufStandard();
        teamVorgaben(name);
        var rec = datensaetze[name];
        if (rec) datensatzEinsetzen(rec);
        tachoUebernehmen(name);
        neuRechnen();
        uebertragZeigen();
    }

    /* ---------- Server ---------- */

    function serverBereit() { return sync && sync.enabled() && sync.hasCode(); }

    function senden() {
        if (!serverBereit()) return;
        sync.save(SEITE, { v: 2, teams: datensaetze }).then(function (res) {
            stand = res.updatedAt;
            sichern();
            melde('✓ geteilt ' + uhr(stand));
        }).catch(function (err) {
            melde(err.status === 401 ? '⚠️ Code falsch' : '⚠️ offline, nur lokal', true);
        });
    }

    function holen(erstmals) {
        if (!serverBereit()) return;
        if (!erstmals && Date.now() - letzteEingabe < SCHONFRIST) return;
        sync.load(SEITE).then(function (res) {
            if (!res.data || !res.data.teams || res.updatedAt <= stand) return;
            if (!erstmals && Date.now() - letzteEingabe < SCHONFRIST) return;
            stand = res.updatedAt;
            datensaetze = res.data.teams;
            sichern();
            if (team) teamLaden(team);
            melde('✓ Stand vom Server ' + uhr(stand));
        }).catch(function (err) {
            melde(err.status === 401 ? '⚠️ Code falsch' : '⚠️ offline, nur lokal', true);
        });
    }

    var taktLaeuft = false;
    function taktStarten() {
        if (taktLaeuft || !serverBereit()) return;
        taktLaeuft = true;
        setInterval(function () { holen(false); }, TAKT);
        window.addEventListener('focus', function () { holen(false); });
    }

    function verbinden() {
        if (!sync || !sync.enabled()) {
            alert('Der Abgleich ist noch nicht eingerichtet. Die Worker-Adresse fehlt in sync.js.');
            return;
        }
        if (!sync.askForCode()) return;
        stand = 0;
        holen(true);
        senden();
        taktStarten();
    }

    /* ---------- Leiste ---------- */

    function uhr(ms) {
        var d = new Date(ms);
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function melde(text, bleibt) {
        if (!anzeige) return;
        anzeige.textContent = text;
        anzeige.style.opacity = '1';
        clearTimeout(anzeigeTimer);
        if (!bleibt) anzeigeTimer = setTimeout(function () { anzeige.style.opacity = '.5'; }, 2500);
    }

    function teamLoeschen() {
        if (!team) { alert('Erst ein Team auswählen.'); return; }
        if (!confirm('Die Eingaben von "' + team + '" für diesen Tag löschen?')) return;
        delete datensaetze[team];
        stand = Date.now();
        sichern();
        teamLaden(team);
        senden();
        melde('✓ ' + team + ' geleert');
    }

    function leisteBauen() {
        var bar = document.createElement('div');
        bar.id = 'autosaveBar';
        bar.innerHTML = '<span id="autosaveBadge">✓ wird automatisch gespeichert</span>' +
                        '<button type="button" id="autosaveCode">Code</button>' +
                        '<button type="button" id="autosaveClear">Team leeren</button>';
        document.body.appendChild(bar);
        anzeige = document.getElementById('autosaveBadge');
        document.getElementById('autosaveClear').addEventListener('click', teamLoeschen);
        document.getElementById('autosaveCode').addEventListener('click', verbinden);
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
            '#uebertragBox{margin:14px auto 0;max-width:640px;background:rgba(255,255,255,.85);' +
            'color:#212529;border-radius:12px;padding:10px 14px;font:600 15px/1.5 system-ui,sans-serif}' +
            '@media(max-width:480px){#autosaveBar{left:12px;right:12px;justify-content:space-between}}' +
            '@media print{#autosaveBar{display:none}}';
        document.head.appendChild(css);
    }

    function uebertragBauen() {
        var total = document.getElementById('totalPoints');
        if (!total) return;
        uebertrag = document.createElement('div');
        uebertrag.id = 'uebertragBox';
        uebertrag.style.display = 'none';
        total.parentNode.insertBefore(uebertrag, total.nextSibling);
    }

    /* ---------- Start ---------- */

    document.addEventListener('DOMContentLoaded', function () {
        var auswahl = document.getElementById('teamName');
        if (!felder().length || !auswahl) return;

        merkeStandard();
        leisteBauen();
        uebertragBauen();
        if (!speicher()) melde('⚠️ Browser speichert nicht', true);

        datensaetze = laden();

        // Zuletzt bearbeitetes Team wiederherstellen
        var s = speicher();
        var zuletzt = s ? s.getItem(SCHLUESSEL + ':team') : '';
        if (zuletzt && [].slice.call(auswahl.options).some(function (o) { return o.value === zuletzt; })) {
            auswahl.value = zuletzt;
            team = zuletzt;
            teamLaden(team);
            melde('✓ ' + team + ' geladen');
        }

        function merken() {
            if (!team) return;
            datensaetze[team] = formular();
            stand = Date.now();
            sichern();
        }

        function teamWechsel() {
            // Läuft vor dem eingebauten onchange der Seite, der Multiplikator
            // im Formular gehört also noch zum bisherigen Team.
            if (team) merken();
            team = auswahl.value;
            if (s) s.setItem(SCHLUESSEL + ':team', team);
            setTimeout(function () {
                if (!team) { aufStandard(); neuRechnen(); uebertragZeigen(); return; }
                teamLaden(team);
                melde('✓ ' + team + ' geladen');
            }, 0);
        }

        function beiEingabe(e) {
            if (!e.target || !e.target.id) return;
            if (e.target.id.indexOf('autosave') === 0) return;
            if (e.target.id === 'teamName') {
                if (e.type === 'change') teamWechsel();
                return;
            }
            if (!team) { melde('⚠️ zuerst Team auswählen', true); return; }
            letzteEingabe = Date.now();
            // Erst rechnet die Seite selbst, dann merken wir uns die Summe.
            setTimeout(function () {
                merken();
                uebertragZeigen();
                melde('✓ gespeichert ' + uhr(stand));
                clearTimeout(sendeTimer);
                sendeTimer = setTimeout(senden, SENDE_VERZUG);
            }, 0);
        }
        document.addEventListener('input', beiEingabe, true);
        document.addEventListener('change', beiEingabe, true);

        if (sync && sync.enabled()) {
            if (!sync.hasCode()) melde('Code eingeben, dann teilen alle Geräte den Stand', true);
            else { holen(true); taktStarten(); }
        }
    });
}());
