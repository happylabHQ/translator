# Live Translation

Kleine lokale Beamer-App: Mikrofon/USB-Audiointerface → OpenAI Realtime Translation → englische Untertitel. Vanilla JavaScript, Express, keine Datenbank und keine lokale Audio- oder Transcript-Speicherung.

## Version 2: Desktop-Overlay mit zwei Zeilen

Das Desktop-Programm zeigt ein separates Steuerfenster und ein transparentes, rahmenloses Overlay unten auf dem ausgewählten Bildschirm. Das Overlay bleibt über anderen Fenstern, nimmt keinen Tastaturfokus und reicht Mausklicks durch. Zwei feste Textzeilen auf einem dunklen halbtransparenten Streifen: oben der zuletzt abgeschlossene Textblock, unten der laufende Text. Bei Satzende oder voller Zeile rückt ein ganzer Block nach oben. Der Text bewegt sich nicht seitlich; die Schrift wird nicht automatisch kleiner. In Sprechpausen bleibt der letzte Text stehen. Der Streifen verschwindet bei leerem Text.

### Hier auf macOS testen

Im Projektordner `npm run desktop` starten. **Test overlay** zeigt zwei Zeilen Beispieltext ohne Audioaufnahme; anschließend Mikrofon auswählen und **Start** klicken. Mit **Load microphones** die Geräte laden; **Refresh microphones** aktualisiert die Liste. Audiogeräte werden erst durch diesen Button, die Auswahl oder Start abgefragt. Das Overlay kann auch über macOS-Vollbildfenstern erscheinen; die konkrete Präsentation bitte mit dem Testtext prüfen.

Seit 8. Oktober verwendet das Mac-Overlay den Electron-Fenstertyp `panel`, damit es den separaten Arbeitsbereich einer Vollbild-App wie Safari betreten kann. Nach Änderungen die Desktop-App vollständig neu starten. Start und native Untertiteltests sind geprüft; die Sichtbarkeit über der konkreten Safari-Präsentation muss vor Ort mit **Test overlay** bestätigt werden.

Nach acht Sekunden ohne neuen Text verschwinden die Untertitel automatisch. Neuer Text blendet sie wieder ein und beginnt mit leeren Zeilen. Größenänderungen verlängern die Anzeigezeit nicht.


Prüfung am 6. Oktober 2026: macOS-Mikrofonberechtigung `granted`, echte Mikrofonaufnahme erfolgreich und unmittelbar beendet. Eine künstlich erzeugte deutsche Sprachprobe wurde über die echte OpenAI-WebRTC-Verbindung übertragen; `session.output_transcript.delta` erreichte das einzeilige Overlay. Session-Anfrage HTTP 200, SDP-Anfrage HTTP 201, Stop zurück auf Idle und leeres Overlay. Die Chromium-Meldung `trust_store_mac.cc: Error parsing certificate / Failed parsing extensions` erschien dabei ebenfalls und blockierte diese Verbindung nicht. Dafür wird keine Zertifikatsprüfung deaktiviert. Der Dauerlauf und das tatsächliche Präsentations-/Audiointerface-Setup sind noch offen.

Die Desktop-Berechtigungsprüfung normalisiert die von Electron gelieferte URL auf ihre Origin. Dadurch sind auch benannte und virtuelle Mikrofone sichtbar. Am 6. Oktober 2026 lokal geprüft: MacBook-Mikrofon, iPhone, Microsoft Teams Audio Device und Loopback Audio; die Auswahl enthält zusätzlich den Systemstandard.

### Windows-Testbuild

Das gebaute ZIP liegt in `dist/Live-Translation-Windows-1.0.3-x64.zip`. Windows x64, keine separate Node-Installation erforderlich:

1. **Das gesamte ZIP entpacken**, nicht nur die EXE herauskopieren.
2. `.env.example` neben `Live Translation.exe` in `.env` kopieren und den eigenen API-Key eintragen.
3. `Live Translation.exe` starten. **Load microphones** klicken, danach Mikrofon und Beamer-Bildschirm auswählen.
4. **Test overlay** zeigt zehn Sekunden Beispieltext, ohne Mikrofonaufnahme oder API-Aufruf. Damit zuerst die Vollbildpräsentation ausprobieren.
5. Schriftgröße und unteren Abstand einstellen, dann **Start** klicken.

**Stop** beendet Mikrofon und Übersetzung und leert beide Zeilen. **Hide overlay** blendet nur die Anzeige aus; die Übersetzung läuft weiter. Das Steuerfenster darf minimiert werden, muss aber geöffnet bleiben. Schließen beendet die App. Ein erweiterter Desktop hält die Steuerung vom Beamer fern; bei duplizierten Bildschirmen erscheinen die gleichen Fenster auf beiden.

Globale Tastenkürzel: **Strg+Alt+R** Reconnect, **Strg+Alt+U** Overlay ein/aus, **Strg+Alt+C** Steuerfenster öffnen. Falls ein anderes Programm ein Kürzel belegt, bleiben die Buttons verfügbar.

Entwicklung und Windows-ZIP neu bauen:

```bash
npm install
npm run desktop
npm run build:windows
```

Electron startet das bestehende Backend intern auf einem freien localhost-Port. Die WebRTC-Verbindung bleibt im Steuerfenster aktiv; nur flüchtige Untertitel werden über eine begrenzte IPC-Schnittstelle an das Overlay weitergegeben. Der permanente Key wird im Hauptprozess geladen und ist weder über die IPC-Schnittstelle noch im ZIP enthalten. `.env` wird ausschließlich neben der EXE bzw. während der Entwicklung im Projektordner gelesen.

Die Windows-Datei ist ein unsignierter Testbuild. Always-on-top über PowerPoint, Presenter-Tasten, eingebettete Videos, DPI-Skalierung und das echte Audiointerface müssen am Windows-Veranstaltungsrechner geprüft werden. Diese Windows-Prüfung kann auf dem hier verfügbaren Mac nicht bestätigt werden. Die Browser-Version mit drei Zeilen bleibt unter `npm start` verfügbar.

Lokal mit Electron auf macOS geprüft: zwei native Fenster, Overlay ohne Fokus und ohne Schatten, Testtext, Größe, Ein-/Ausblenden, Mikrofonfreigabe mit Testgerät, Fehler bei fehlendem Key, simulierte Realtime-Deltas, Ein-Zeilen-Grenze, Stop mit Track-Stopp, Reconnect und Disconnect. Keine unbehandelten Renderer-Fehler. Die Windows-Paketierung wurde erfolgreich ausgeführt und das Archiv auf Ausschluss der echten `.env` geprüft. Die OpenAI-Verbindung wurde bei dieser Prüfung simuliert.

Version 1.0.1: Hardwarebeschleunigung vor dem Electron-Start ausgeschaltet; neues Windows-Cacheprofil unter `%LOCALAPPDATA%\LiveTranslationOverlay`, ohne alte Caches zu löschen. Das Steuerfenster wird vor dem Overlay geladen und bei erneutem Start bzw. **Strg+Alt+C** auch aus minimiertem Zustand wiederhergestellt. `startup.log` neben der EXE protokolliert Startschritte und Prozessfehler, keine API-Keys oder Untertitel. Es wird auf ungefähr 128 KB begrenzt und kann zur Fehlerdiagnose weitergegeben werden. In einem schreibgeschützten Programmordner kann das Protokoll nicht erzeugt werden. Die auf dem Foto gemeldeten GPUCache-/Crashpad-Fehler belegen die ursprüngliche Ursache nicht eindeutig; der neue Build vermeidet die GPU-Abhängigkeit und verbessert die Diagnose.

Version 1.0.2: Das Windows-Protokoll von 1.0.1 zeigt einen nativen Absturz des Steuerfenster-Renderers direkt nach dem Laden, mit und ohne API-Key. Der ursprüngliche GPU-Verdacht ist damit keine hinreichende Erklärung. Für diesen Kompatibilitäts-Testbuild ist Electron auf **43.7.7** festgesetzt, aus der [weiterhin unterstützten Version 43](https://releases.electronjs.org/schedule), mit anderem Chromium-Unterbau. Die Audiogeräte werden im Desktop-Modus erst bei Auswahl oder Start abgefragt; es gibt keine automatische Audiogeräte-Abfrage beim Fensterstart. Das Startprotokoll enthält zusätzliche feste Markierungen für JavaScript-Start und Audioinitialisierung. Diese Änderungen sind ein Diagnose-/Kompatibilitätsversuch; eine Behebung auf dem Windows-Rechner ist erst nach erneutem Test bestätigt.

Version 1.0.3 enthält das Zwei-Zeilen-Overlay, die korrigierte Audiogeräte-Berechtigung, das lokale Ereignisglossar und den Schutz gegen verspätete Nachrichten an bereits geschlossene Fenster. Der neue Windows-Build wurde auf dem Mac paketiert und sein Inhalt geprüft; der native Windows-Test bleibt am Veranstaltungsrechner erforderlich.

## Installation

Node.js 22.6 oder neuer.

```bash
npm install
cp .env.example .env
```

In `.env` den `OPENAI_API_KEY` eintragen. Der Key braucht Zugriff auf `gpt-realtime-translate`.

## Start

```bash
npm start
```

[http://localhost:3000](http://localhost:3000) öffnen. Die App bindet ausschließlich an den lokalen Rechner (`127.0.0.1`). Ein anderer Port lässt sich über `PORT` einstellen. Mikrofonzugriff benötigt localhost oder HTTPS.

## Verwendung

1. Audioauswahl öffnen und Mikrofonzugriff erlauben; anschließend erscheinen die Gerätenamen. USB-Interface/Mischpult wählen.
2. **Start** klicken. Erst bei verbundener PeerConnection und offenem Event-Kanal erscheint **Connected** und die Untertitelansicht.
3. Browser auf den Beamer ziehen.
4. **Fullscreen** oder **F** drücken. **Esc** beendet Vollbild.

**Reconnect** bzw. **R** schließt die alte Verbindung, stoppt das Mikrofon und startet mit demselben Gerät eine neue Session. Keine automatischen Wiederholungen. Bei einem Gerätewechsel vor dem Neustart der Session die Seite neu öffnen und das neue Gerät wählen. Mausbewegung blendet die zwei Bedienelemente für drei Sekunden ein; Tastaturfokus hält sie sichtbar. Ein verfügbarer Screen Wake Lock verhindert im Vordergrund den Ruhezustand. Die Seite schließen beendet die Aufnahme.

## Aktuelle API und Abweichungen

Geprüft am 30. September 2026 anhand der offiziellen [Translation-Anleitung](https://developers.openai.com/api/docs/guides/realtime-translation), [Client-Secret-Referenz](https://developers.openai.com/api/reference/resources/realtime/subresources/translations/subresources/client_secrets/methods/create) und [Translation-Events](https://developers.openai.com/api/reference/resources/realtime/translation-server-events).

- Modell `gpt-realtime-translate`; Backend: `POST /v1/realtime/translations/client_secrets`; Browser-SDP: `POST /v1/realtime/translations/calls`. Zielsprache: `session.audio.output.language = "en"`.
- Die dokumentierte Translation-Konfiguration enthält keine feste Quellsprache und keinen Eigennamen-Prompt. Deutsch wird aus dem Eingangsaudio erkannt. Das Ereignisglossar in `public/glossary.js` korrigiert stattdessen lokal die Schreibweise in den angezeigten Untertiteln; es wird nicht als Prompt an das Modell geschickt.
- Das Modell erzeugt übersetztes Audio und Text gemeinsam. Ein reiner Textmodus ist nicht dokumentiert. Die App spielt den Remote-Audiotrack nicht ab; die Audioerzeugung beim Anbieter wird dadurch nicht abgeschaltet.
- Der Text kommt als `session.output_transcript.delta`. Es gibt kein dokumentiertes Sentence-Final-Event. Die App übernimmt deshalb Sätze lokal bei Satzzeichen plus nachfolgendem Leerraum. Das ist eine Anzeigeheuristik, keine Finalitätsgarantie der API; Abkürzungen können Grenzen auslösen.
- Zwei feste Textcontainer zeigen den letzten Satz und den laufenden Text. Die tatsächliche Browser-Layoutmessung begrenzt die Anzeige auf insgesamt drei Zeilen; ältere Wörter werden entfernt. Updates erfolgen gebündelt alle 80 ms. Es gibt keine Transcript-Historie.
- Das kurzlebige Client-Secret ist nur für den Verbindungsaufbau gültig; die Ablaufzeit ist keine Laufzeitgarantie der Session. Bei `session.closed` oder Verbindungsabbruch manuell reconnecten. Eine ununterbrochene Stunde muss mit dem verwendeten Account und Veranstaltungsnetz getestet werden.

Der permanente API-Key bleibt serverseitig. Nur `public/` wird ausgeliefert. Das Backend gibt ausschließlich ein kurzlebiges `ek_…`-Secret zurück und verhindert dessen Caching. Standardlogs enthalten keine Audio- oder Transcript-Inhalte. Audio wird während der Verbindung zur Verarbeitung an OpenAI übertragen.

## Namen und Veranstaltungsbegriffe

`public/glossary.js` enthält die Schreibweisen aus den [Moderationskarten zum 20-Jahre-Jubiläum](https://docs.google.com/document/d/1E4V1rq7d6rUxvtZg_-gFNG6WwQjxBspSFxjXVYLirmU/edit?tab=t.0), gelesen am 6. Oktober 2026. Bekannte bzw. naheliegende Varianten werden lokal in Browser und Overlay korrigiert: beispielsweise **Laila → Leyla**, **Andy → Andi**, **Happy Lab / Happy-Lab → Happylab** und **Karim Jafar Madar → Karim Jafarmadar**. Enthalten sind außerdem die weiteren Namen und Veranstaltungsbegriffe wie Roland Stelzer, Hörtlehner, Gordan Savicic, Dale Dougherty, Lohwasser, Michael Schwantzer, Alexander Nikolai, ESPRIVA und Young Makers Academy/Club. Die Schreibweisen folgen dem Dokument; fehlende Nachnamen werden nicht ergänzt.

Die Zuordnung gilt für diese Veranstaltung. Sie verwendet ausdrücklich aufgeführte Varianten statt unscharfer Ähnlichkeitssuche. Neue Fehlschreibweisen lassen sich in `aliases` ergänzen. Gewöhnliche englische Wörter wie „happy“, „lab“ und „make“ werden nicht allein ersetzt. Großgeschriebene Namensvarianten wie „Andy“ werden im Veranstaltungskontext Andi zugeordnet.

Die Korrektur verbessert nur die Anzeige, nicht die Erkennung des Audios oder die beim Anbieter erzeugte Übersetzung. Nicht aufgeführte oder völlig falsch erkannte Namen können weiterhin falsch erscheinen. Es wird kein zusätzliches Modell aufgerufen und das vollständige Moderationsskript wird nicht in die App übernommen. Die aktuelle Translation-Konfiguration hat kein dokumentiertes Glossar-/Instructions-Feld. Für direkte Vorgaben an ein Modell wäre eine andere Übersetzungsstrecke erforderlich.

Die ursprünglichen Textfragmente bleiben im begrenzten Anzeigepuffer erhalten. Korrekturen werden bei jedem Rendern daraus neu berechnet, einschließlich über mehrere Deltas geteilter Namen. Die Zeilenmessung verwendet den korrigierten Text. Das Desktop-Overlay zeigt seit dem 6. Oktober 2026 zwei feste Zeilen; Satzgrenzen werden lokal anhand der Satzzeichen erkannt, volle Zeilen bilden ebenfalls einen Blockwechsel. Abkürzungen können daher einen vorzeitigen Wechsel auslösen.

## Prüfen

```bash
npm test
```

Automatisierte Tests prüfen Caption-Fragmentierung und Speicherbegrenzung sowie Backend-Konfiguration, Fehlerfälle und Secret-Isolation. Für den Veranstaltungstest: mit echtem Key und ausgewähltem Interface Deutsch sprechen, englische Deltas prüfen, Netzwerk kurz unterbrechen, **R** drücken, **F/Esc** testen und mindestens eine Stunde mit dem tatsächlichen Beamer/Netz laufen lassen. Browserkonsole für Verbindungsstatus und Fehler öffnen; Transcripts werden nicht geloggt.

Lokale Prüfung bei Implementierung: `npm start` und alle drei Node-Tests erfolgreich. Chromium-Browserprüfung mit simuliertem Mikrofon: Gerätefreigabe und Gerätenamen, verständlicher Fehler bei fehlendem Key, simulierte Translation-Deltas, Drei-Zeilen-Grenze bei 1920×1080 / 1024×768 / 390×844, Vollbild ein/aus, Disconnect inklusive Track-Stopp, Reconnect mit neuer Verbindung sowie Ein-/Ausblenden der Buttons. Keine unbehandelten Browserfehler. OpenAI-SDP und Transcript-Events wurden für diesen Test simuliert. Der echte Desktop-WebRTC-/Übersetzungstest wurde inzwischen am 6. Oktober 2026 mit künstlicher deutscher Sprache erfolgreich durchgeführt; der einstündige Dauerlauf bleibt offen.
