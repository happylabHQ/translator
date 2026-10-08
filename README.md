# Live Translation

Lokale App für englische Live-Untertitel bei Vorträgen und Veranstaltungen. Sie nimmt Audio von einem Mikrofon oder USB-Audiointerface entgegen und übersetzt es mit OpenAI Realtime Translation (`gpt-realtime-translate`).

Zwei Ansichten stehen zur Verfügung:

- **Desktop-Overlay:** Zwei Untertitelzeilen über einer Präsentation, mit separatem Steuerfenster und Auswahl des Ausgabebildschirms. Für macOS und Windows.
- **Browser-Ansicht:** Eine eigene Vollbildansicht mit bis zu drei Untertitelzeilen.

Die App verwendet Vanilla JavaScript, Express und Electron. Es gibt keine Datenbank und keine lokale Speicherung von Audio oder Transkripten.

## Einrichtung

Voraussetzungen: Node.js ab Version 22.6, ein Audioeingang und ein OpenAI-API-Key mit Zugriff auf `gpt-realtime-translate`.

```bash
npm ci
cp .env.example .env
```

Unter Windows kann `.env.example` auch im Explorer kopiert und in `.env` umbenannt werden. Den API-Key in `.env` eintragen:

```dotenv
OPENAI_API_KEY=dein_api_key
PORT=3000
```

Audio wird während der Übersetzung zur Verarbeitung an OpenAI übertragen. Der permanente API-Key bleibt im lokalen Backend; der Browser erhält nur ein kurzlebiges Verbindungs-Secret. `.env` und `env` sind von Git ausgeschlossen.

## Desktop-Overlay

```bash
npm run desktop
```

1. **Load microphones** klicken, Mikrofonzugriff erlauben und den Audioeingang auswählen. **Refresh microphones** aktualisiert die Geräteliste.
2. Unter **Overlay display** den Bildschirm oder Beamer auswählen.
3. Schriftgröße und unteren Abstand einstellen. **Test overlay** zeigt Beispieltext ohne Mikrofonaufnahme oder API-Aufruf.
4. **Start** klicken, um die Übersetzung einzuschalten.

Die obere Zeile zeigt den zuletzt abgeschlossenen Textblock, die untere den laufenden Text. Bei Satzende oder voller Zeile rückt ein Textblock nach oben. Nach acht Sekunden ohne neuen Text verschwinden die Untertitel; neuer Text blendet sie wieder ein.

Das transparente Overlay nimmt keinen Tastaturfokus und reicht Mausklicks durch. **Hide overlay** blendet nur die Anzeige aus; die Übersetzung läuft weiter. **Stop** beendet Mikrofonaufnahme und Übersetzung. **Reconnect** baut die Verbindung neu auf.

Das Steuerfenster kann minimiert werden. Schließen beendet die App. Ein erweiterter Desktop hält die Steuerung vom Beamer fern. Die Darstellung über der verwendeten Vollbild-App sollte vor dem Einsatz mit **Test overlay** geprüft werden.

| Aktion | Windows | macOS |
| --- | --- | --- |
| Verbindung neu aufbauen | Strg+Alt+R | Cmd+Option+R |
| Overlay ein-/ausblenden | Strg+Alt+U | Cmd+Option+U |
| Steuerfenster anzeigen | Strg+Alt+C | Cmd+Option+C |

## Browser-Ansicht

```bash
npm start
```

[http://localhost:3000](http://localhost:3000) öffnen, Audioeingang auswählen und **Start** klicken. Der Port lässt sich über `PORT` in `.env` ändern. Die App bindet ausschließlich an `127.0.0.1`; Mikrofonzugriff benötigt localhost oder HTTPS.

Mit **Fullscreen** oder **F** wird die Untertitelansicht bildschirmfüllend, **Esc** beendet Vollbild. **Reconnect** oder **R** baut die Verbindung neu auf. Das Schließen der Seite beendet die Mikrofonaufnahme.

## Namen und Begriffe anpassen

In [`public/glossary.js`](public/glossary.js) sind veranstaltungsspezifische Schreibweisen fest hinterlegt, etwa **Happy Lab → Happylab**, **Laila → Leyla** und **Andy → Andi**. Für andere Veranstaltungen die Zuordnungen in `aliases` anpassen oder entfernen.

Die Korrekturen werden lokal auf den angezeigten Text angewendet. Sie werden nicht als Wörterbuch an das Modell geschickt und verändern nicht dessen Audioerkennung. Übersetztes Audio wird von der App nicht abgespielt.

## Windows-Build

```bash
npm run build:windows
```

Das Windows-x64-ZIP wird unter `dist/` erzeugt. Es ist unsigniert und benötigt keine separate Node.js-Installation auf dem Zielrechner.

1. Das **gesamte ZIP** entpacken.
2. `.env.example` neben `Live Translation.exe` in `.env` kopieren und den eigenen API-Key eintragen.
3. `Live Translation.exe` starten und Audioeingang sowie Ausgabebildschirm auswählen.

Der API-Key ist nicht im Build enthalten. Für Startprobleme schreibt die Desktop-App eine begrenzte `startup.log` im Projektordner bzw. neben der EXE; darin stehen keine API-Keys oder Untertitel.

## Tests

```bash
npm test
```

Die Tests prüfen unter anderem Untertitelverarbeitung, Namenskorrekturen, Audioberechtigungen, Fenster-Lebenszyklus und Backend-Fehlerfälle. Audiointerface, Vollbilddarstellung und Netzwerkverbindung sollten zusätzlich auf dem vorgesehenen Veranstaltungsrechner geprüft werden.
