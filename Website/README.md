# Auralis Website

Öffentliche Website für **https://auralisdev.github.io/Auralis/**. Sie wird aus diesem Ordner durch `.github/workflows/pages.yml` gebaut und mit GitHub Pages veröffentlicht.

## Dateien und Einstellungen

Bearbeite `config.js` für öffentliche, nicht geheime Optionen:

- `siteUrl`: `https://auralisdev.github.io/Auralis/`
- `apiBase`: die tatsächliche HTTPS-URL des Node.js-Backend-Hosts; vor dessen Einrichtung leer lassen.
- `clientId`: Discord Application ID.
- `discordInstall.integrationType`: `0` für Guild Install.
- `discordInstall.scopes`: `bot` und `applications.commands`.
- `discordInstall.permissions`: Bot-Permissions-Bitmaske.
- `publicServerLimit`, `defaultSort`: Anzahl und Sortierung der öffentlichen Serverkarten.
- `statisticsAnimation`: Animation ein-/ausschalten und Dauer/Verzögerung/ausklingende Bewegung einstellen.
- `numberLocale`: optionales Format, z. B. `de-DE`; leer nutzt die Browser-Locale.
- `statsRefreshMs`: Intervall für Live-Statistiken, wenn ein Backend konfiguriert ist.

`config.js` wird öffentlich ausgeliefert. Niemals `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, OAuth-Tokens oder andere Geheimnisse dort eintragen.

## Pages und Unterseiten

GitHub Pages muss unter **Settings → Pages → Build and deployment → Source** auf **GitHub Actions** stehen. Der Workflow validiert vor der Veröffentlichung erforderliche Seiten und lokale Links, baut nach `dist/` und veröffentlicht das Build-Verzeichnis. Die Website wird unter anderem mit `commands.html`, `features.html`, `faq.html`, `status.html` und `docs/index.html` veröffentlicht.

Lokal prüfen und bauen (Node.js 22+):

```bash
node build.mjs --check
node build.mjs
```

Die fertige statische Ausgabe steht in `dist/`. Du lädst `dist/` bei diesem Workflow nicht manuell hoch; GitHub Actions baut sie selbst.

## Live-Daten, Serverzähler und Dashboard

Der echte **Server Count** stammt aus dem Bot-Backend und zählt Server, mit denen der Bot verbunden ist. Das öffentliche `data/servers.json` ist nur ein statischer Fallback für die freiwillige öffentliche Serverliste und kann deshalb nicht die Gesamtzahl aller installierten Server belegen. Ohne Backend zeigt die Website beim Gesamtserverzähler bewusst `—` statt eine erfundene Zahl.

Discord-Login, geschütztes Dashboard, OAuth-Callback und Speichern von Servereinstellungen laufen auf dem Node.js-Backend unter `../DiscordBot/`; GitHub Pages kann diese Serverfunktionen nicht selbst ausführen. Nach dem Deployment: `apiBase` auf die echte Backend-URL setzen und im Repository unter **Settings → Secrets and variables → Actions → Variables** dieselbe URL als `AURALIS_API_BASE` eintragen. Die OAuth-Callback-URL muss exakt mit der privaten Backend-Umgebungsvariable `DISCORD_REDIRECT_URI` übereinstimmen.

Weitere Einrichtungsdetails: `../docs/GITHUB-PAGES-UND-SYNC.md` und `../DiscordBot/docs/DASHBOARD-OAUTH.md`.
