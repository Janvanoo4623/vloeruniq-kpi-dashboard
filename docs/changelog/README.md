# Changelog

Het logboek van het Vloeruniq-dashboard: wat er veranderd is, waarom, en wat Jan ervan merkt.
Eén bestand per dag waarop er iets live ging: `YYYY-MM-DD.md`. Juni t/m 17 november 2026 staat
compact in `2026-06-tot-11-archief.md`.

Naar het voorbeeld van de Kovvar-changelog (kaarten per ingreep), maar voor een app in plaats van
een advertentieaccount: geen hypothese en monitoringtabel, wel het effect op de cijfers en wanneer
we iets nakijken.

## Kaart

Elke wijziging die Jan merkt of die de cijfers verandert, krijgt een kaart:

```
Datum:          2026-11-21
Wijziging:      één zin
Onderdeel:      pagina('s) of koppeling (Marge, Instellingen, n8n …)
Soort:          Rekenregel | Nieuw | Verbetering | Fix | Koppeling | Data
Commit:         abc1234
Effect:         cijfers vóór → na (marge geaccepteerd, aantal offertes zonder marge …), of "geen"
Gecontroleerd:  hoe (tests, diff over alle offertes, live nagerekend, screenshot)
```

Daaronder, alleen wat van toepassing is:

- **Waarom.** De aanleiding: feedback van Jan, een fout, een besluit.
- **Wat Jan merkt.** In gewone taal, waar hij het ziet.
- **Bewust niet.** Wat we lieten liggen en waarom.
- **Nakijken.** Wat en wanneer (datum), en wat we dan beslissen.
- **Korte samenvatting.** Eén of twee zinnen die je zo naar Jan kunt sturen.

Kleine dingen zonder kaart (docs, kleine UI-fixes) staan onderaan onder **Notities zonder kaart**.

## Regels

- Bijwerken bij elke push die live gaat, in hetzelfde commit of direct erna.
- Cijfers alleen als ze gemeten zijn (diff of live nagerekend), nooit geschat.
- Rekenregels staan in detail in `docs/DATA-MODEL.md`; de kaart verwijst ernaar, kopieert niet.
- Open punten horen in `docs/ROADMAP.md`, niet hier. Hier staat wat er gebeurd is.
