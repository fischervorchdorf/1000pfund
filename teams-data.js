/* Zentrale Teamdaten der 1000 Pfund Rallye.
   Wird von allen Tageswertungen eingebunden. Multiplikator hier aendern,
   dann zieht die Aenderung auf allen sieben Tagesseiten mit. */
window.RALLYE_TEAMS = [
    { nr: 1, name: 'Stierwoscha',            multiplier: 1.16 },
    { nr: 2, name: 'Speedy Triumphales',     multiplier: 1.33 },
    { nr: 3, name: 'Crazy Chicken',          multiplier: 1.09 },
    { nr: 4, name: 'Orange Blossom Special', multiplier: 1.25 },
    { nr: 5, name: 'Schnuckiputz 1',         multiplier: 1.86 },
    { nr: 6, name: 'Aristocats',             multiplier: 0.88 }
];

/* Fuellt die Team-Auswahl und setzt den Multiplikator des gewaehlten Teams. */
function applyTeamMultiplier() {
    var select = document.getElementById('teamName');
    var field = document.getElementById('multiplier');
    if (!select || !field) return;
    var team = window.RALLYE_TEAMS.filter(function (t) {
        return t.name === select.value;
    })[0];
    if (!team) return;
    field.value = team.multiplier.toFixed(2);
    // Loest die onchange/oninput-Berechnung der jeweiligen Tagesseite aus.
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
}

document.addEventListener('DOMContentLoaded', function () {
    var select = document.getElementById('teamName');
    if (!select || select.tagName !== 'SELECT') return;
    select.innerHTML = '<option value="">— Team wählen —</option>';
    window.RALLYE_TEAMS.forEach(function (team) {
        var option = document.createElement('option');
        option.value = team.name;
        option.textContent = 'Team ' + team.nr + ' – ' + team.name +
                             ' (× ' + team.multiplier.toFixed(2) + ')';
        select.appendChild(option);
    });
});
