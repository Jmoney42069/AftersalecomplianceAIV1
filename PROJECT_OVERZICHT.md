# Voltera Compliance Checker — Project Overzicht

**Laatste update:** 25 maart 2026  
**Repo:** https://github.com/Jmoney42069/AftersalecomplianceAIV1  
**Dashboard:** https://aftersalecomplianceaiv1.vercel.app *(na Vercel deploy)*

---

## Pipeline (hoe het werkt)

```
Jabra microfoon
      │
      ▼
recorder.py  ──── VAD detectie (webrtcvad)
                  Stilte > 30s = gesprek klaar
                  Min. 5 min / Max. 90 min
      │
      ▼  .wav bestand
transcriber.py ── faster-whisper (model: small)
                  Taal: Nederlands
                  Vertrouwen: gelogd
      │
      ▼  Nederlandse tekst
compliance.py ─── Groq API (llama-3.3-70b-versatile)
                  Fallback: Claude (claude-opus-4)
                  3x retry bij fout (2s / 4s wachttijd)
                  Output: JSON met oordeel per check
      │
      ├──▶ storage.py ── Upload .wav → Supabase Storage (bucket: recordings)
      │                  Sla gesprek op → Supabase DB (tabel: calls)
      │                  Sla compliance rapport op → zelfde rij
      │
      └──▶ emailer.py ── Stuur HTML-mail bij RISICO of AFGEKEURD
                         Via Gmail SMTP (port 465 SSL)
                         Ontvanger: EMAIL_TO in .env
```

---

## Bestanden in deze map

### Backend (Python)

| Bestand | Functie |
|---|---|
| `main.py` | Startpunt — verbindt alle modules, `handle_call()` pipeline |
| `config.py` | Alle constanten + env vars, maakt mappen aan |
| `recorder.py` | Microfoon → VAD → .wav bestand |
| `transcriber.py` | .wav → Nederlandse tekst via faster-whisper |
| `compliance.py` | Tekst → AI compliance rapport (Groq / Claude) |
| `storage.py` | Supabase: upload audio, sla gesprek op, update rapport |
| `emailer.py` | HTML alert-mail bij RISICO of AFGEKEURD |

### Installatie

| Bestand | Functie |
|---|---|
| `setup.ps1` | **Hoofdinstaller** — kopieert naar LOCALAPPDATA, registreert taak |
| `uninstall.ps1` | Verwijdert taak + installatiebestanden |
| `setup_autostart.py` | Alternatief: registreert taak via Python (XML methode) |
| `remove_autostart.py` | Verwijdert taak via Python |

### Configuratie

| Bestand | Functie |
|---|---|
| `.env` | ⚠️ Geheime sleutels — nooit committen |
| `.env.example` | Lege template voor .env |
| `.gitignore` | Sluit .env, recordings/, transcripts/ uit van git |
| `supabase_setup.sql` | Eenmalig uitvoeren in Supabase voor tabelstructuur |

### Dashboard (Next.js)

| Bestand | Functie |
|---|---|
| `dashboard/app/page.tsx` | Overzichtspagina — alle gesprekken + statistieken |
| `dashboard/app/calls/[id]/page.tsx` | Detailpagina per gesprek |
| `dashboard/lib/supabase.ts` | Supabase client + TypeScript types |
| `dashboard/next.config.mjs` | Next.js configuratie |

### Documentatie

| Bestand | Functie |
|---|---|
| `INSTALLATIE_HANDLEIDING.md` | Nederlands installatie-handboek voor IT |
| `PROJECT_OVERZICHT.md` | Dit bestand |

### Gegenereerde mappen (niet in git)

| Map | Inhoud |
|---|---|
| `recordings/` | Tijdelijke .wav bestanden (worden verwijderd na upload) |
| `transcripts/` | Lokale transcripties (backup) |
| `compliance.log` | Logbestand van de draaiende applicatie |

---

## Sleutelinstellingen (.env)

| Variabele | Waarde |
|---|---|
| `SUPABASE_URL` | `https://lolvgbvnnkpdqdpihyii.supabase.co` |
| `SUPABASE_SERVICE_KEY` | JWT service key (zie Supabase dashboard) |
| `GROQ_API_KEY` | Groq API key (console.groq.com) |
| `ANTHROPIC_API_KEY` | Leeg = Claude uitgeschakeld, Groq als primair |
| `GMAIL_USER` | Jarvishisownemail@gmail.com |
| `GMAIL_APP_PASSWORD` | App-wachtwoord (niet gewoon Gmail wachtwoord) |
| `EMAIL_TO` | hermanjoaquin44@gmail.com |

---

## Technische instellingen (config.py)

| Instelling | Waarde | Betekenis |
|---|---|---|
| `MIN_CALL_DURATION_SEC` | 300 | Gesprek moet min. 5 minuten duren |
| `MAX_CALL_DURATION_SEC` | 5400 | Maximaal 90 minuten opnemen |
| `SILENCE_TIMEOUT_SEC` | 30 | 30 seconden stilte = gesprek klaar |
| `WHISPER_MODEL` | small | Snelheid vs. nauwkeurigheid balans |
| `WHISPER_LANGUAGE` | nl | Nederlands |
| `FRAME_DURATION_MS` | 30 | VAD gevoeligheid |

---

## Supabase database (tabel: calls)

| Kolom | Type | Inhoud |
|---|---|---|
| `id` | UUID | Unieke ID per gesprek |
| `timestamp` | TIMESTAMPTZ | Tijdstip van gesprek |
| `agent_id` | TEXT | Hostname van de agent-PC |
| `file_url` | TEXT | URL naar .wav in Supabase Storage |
| `duration_sec` | FLOAT | Gespreksduur in seconden |
| `transcript` | TEXT | Volledige transcriptie |
| `risk_level` | TEXT | GOEDGEKEURD / RISICO / AFGEKEURD |
| `compliance_report` | JSONB | Volledig AI rapport per check |
| `created_at` | TIMESTAMPTZ | Aanmaaaktijdstip rij |

---

## Status

| Onderdeel | Status |
|---|---|
| Python backend | ✅ Compleet en getest |
| Supabase DB + Storage | ✅ Live en werkend |
| Email alerts | ✅ Werkend (Gmail SMTP) |
| Windows autostart scripts | ✅ Klaar |
| Next.js dashboard | ✅ Gebouwd |
| Vercel deployment | ⏳ In uitvoering |
| Installatie handleiding | ✅ Klaar |
| Test op echte agent-PC | ⏳ Nog te doen |
