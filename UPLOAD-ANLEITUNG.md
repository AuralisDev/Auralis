# Auralis – neue Website veröffentlichen

Deine aktuelle Website ist `https://auralisdev.github.io/Auralis/`. Für die Reparatur der kaputten Unterseiten kannst du **AuralisWebsiteUpdate.zip** nutzen; der komplette Bot ist dafür nicht nötig.

## Website-only-Update in dein bestehendes Repository übernehmen

1. Lade `AuralisWebsiteUpdate.zip` herunter und entpacke sie auf deinem PC.
2. Öffne den entpackten Ordner. Darin befinden sich `Website/`, `.github/` und diese Anleitung.
3. Öffne dein Repository `https://github.com/auralisdev/Auralis` und stelle sicher, dass du im Branch `main` bist.
4. Kopiere `Website/` sowie `.github/workflows/pages.yml` in das Repository an genau dieselben Stellen und bestätige das Überschreiben bestehender Dateien.
5. Committe die Änderungen. Du brauchst `Website/dist/` **nicht** hochzuladen; der Workflow erzeugt das Verzeichnis automatisch.
6. Öffne auf GitHub **Actions → Build and deploy Auralis Website** und warte, bis der Lauf grün/erfolgreich abgeschlossen wurde. Anschließend in **Settings → Pages** sicherstellen, dass **Build and deployment → Source = GitHub Actions** eingestellt ist.
7. Öffne danach `https://auralisdev.github.io/Auralis/commands.html`. Falls der Browser noch eine alte 404-Seite zeigt, einmal mit `Ctrl+F5` neu laden und den letzten Deployment-Lauf kontrollieren.

Der Workflow prüft jetzt vor dem Veröffentlichen, ob alle erwarteten HTML-Seiten vorhanden sind und ob interne Links auf echte Dateien zeigen. Das behebt die Quelle von Deployments, in denen `commands.html` oder andere Unterseiten fehlen.

## Kompletten Bot ebenfalls hosten

Die ZIP `AuralisDiscordBot.zip` enthält zusätzlich `DiscordBot/`, also Bot und Backend. Für einen Backend-Host muss dieser Ordner mit hochgeladen und als Root/Arbeitsverzeichnis ausgewählt werden. Die privaten Werte gehören nur in den Secrets-/Environment-Bereich des Hosts – niemals in `Website/config.js` oder öffentliche Commits.

## Wichtig

- Öffentliche Website: `https://auralisdev.github.io/Auralis/`
- Live-Zähler und Discord-Login benötigen ein laufendes Backend. GitHub Pages kann nur statische Dateien hosten.
- In `Website/config.js` bleibt `apiBase` leer, bis die echte HTTPS-URL des Backend-Hosts existiert. Danach Backend-URL dort und als GitHub-Repository-Variable `AURALIS_API_BASE` setzen.
- Bot-Token, OAuth2 Client Secret, `SESSION_SECRET` sowie Datenbankdateien dürfen nicht öffentlich hochgeladen werden.
