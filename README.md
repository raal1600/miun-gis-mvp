# Ungas framtidsplaner – Gränslös kompetens

[Öppna visualiseringen](https://raal1600.github.io/miun-gis-mvp/)

Här finns det byggda webbpaketet. Utveckling och fullständiga datatester finns i `raal1600/miun-gis-architecture-demo`, grenen `feature/gis-mvp-demo`, under `mvp/`.

Forskargruppens enkät: fem ämnesområden, 162 mått och kommungrupper per variabel. Alla 18 yrken, könsuppdelning för egna mål/förmågor och boende, svenska/norska, tangentbord och texttabell. 51 kommuner finns i källfilen; Røyrvik och Leka visas som utan deltagare.

Detta är en arbetsversion för forskargranskning. Norska resultat och vissa metadata behöver slutligt besked. 50 tvetydiga kommunvärden har undantagits. Kohortdata har inte levererats. Inga saknade resultat har uppskattats.

[Metod och hela dokumentationen](https://raal1600.github.io/miun-gis-mvp/method.html)

UI behåller den ursprungliga navigationen, yrkesprofilen och båda jämförelsekolumnerna. Gränssnittet följer forskarnas bildkommentarer, med kommunjämförelsen förenklad enligt Ramis önskemål. Extra tolknings- och granskningsblock har tagits bort; datauppdateringen är oförändrad. E2E 10 kontrollerar denna avgränsning.

Kommunjämförelsen förenklades på Ramis önskemål den 11 oktober: öppna **Jämför kommuner**, sök och kryssa i de kommuner som ska jämföras. Flera kommuner visas samtidigt med separata värden i jämförelsen och yrkesprofilen. Ett kartklick väljer kommunen; nästa klick på samma kommun avmarkerar den. Enter och mellanslag fungerar likadant. Sökningen och tabellen kan också lägga till kommuner. Avmarkera en kommun eller välj **Rensa val** i väljaren. Valen bevaras när ämne, kön eller område ändras och ingår i delningslänken. Äldre länkar fungerar fortfarande. E2E 11–13 kontrollerar flerval, värden, delning, val/avval med kartklick, tangentbord och mobil.

## Publicering och tester
Workflow **Publicera GIS – kravtester och verifierad liveversion** innehåller:
1. **01 · Kravtester före publicering** – alla 162 mått och kommunvärden i webbläsaren, grupper, skalor, tangentbord, laptop/mobil, EU-logotyp samt axe WCAG A/AA.
2. **02 · Publicera verifierad visualisering** – publicering sker endast om testerna lyckas.
3. **03 · E2E på publicerad version** – samma tester körs på den riktiga adressen. Release-id och hash för varje fil kontrolleras.

Skärmbilder och rapporter finns som Actions-artefakter. Automatisk tillgänglighetskontroll ersätter inte manuell skärmläsargranskning eller en beslutad tillgänglighetsredogörelse.

16 runtimefiler publiceras. Testverktygen under `.github/` kopieras aldrig till webbservern. Originalarbetsbok och intern testfixtur finns inte i detta repo. `release.json` beskriver exakt version och filhashar.

## Hosting
Statisk HTTPS-hosting på Linux eller Windows. Ingen databas, GIS-server, Node-server eller CMS behövs i drift. Hela webbpaketet är cirka 0,84 MB okomprimerat. Kartdata och Leaflet levereras lokalt.

Geografi: SCB CC0; Kartverket CC BY 4.0. Leaflet BSD-2-Clause, licens under `vendor/`. Ingen individdata, extern baskarta eller spårningskod. Offentligt visade aggregerade data går tekniskt att läsa även utan nedladdningsknapp.

Tillgänglighetsgranskningen den 11 oktober kompletterar befintliga funktioner: kartinformation kan hovras och stängas med Escape, enkätens deltagartext döljs i kohortläget, och radbrytning fungerar vid större textavstånd på små skärmar. E2E 14–15 bevakar detta; totalt körs 16 E2E-grupper.
