# Installatie handleiding — Voltera Compliance Checker

**Versie:** 1.0  
**Doelgroep:** IT-beheerder of installateur  
**Tijd:** ±15 minuten per pc

---

## 1. Vereisten

Controleer het volgende voordat je begint:

| Vereiste | Controle |
|---|---|
| Windows 10 of Windows 11 | ✅ |
| Python 3.10 of nieuwer | Zie stap hieronder |
| Jabra headset ingesteld als standaard audio-apparaat | Zie stap hieronder |
| Internetverbinding | ✅ |

### Python controleren

1. Druk op **Windows + R**, typ `cmd` en druk op Enter
2. Typ het volgende en druk op Enter:
   ```
   python --version
   ```
3. Je ziet iets als `Python 3.11.2` — het getal na de punt moet **10 of hoger** zijn
4. Zie je een foutmelding? Download Python via [python.org/downloads](https://python.org/downloads)
   - Kies de nieuwste versie
   - Zet tijdens installatie het vinkje aan bij **"Add Python to PATH"**
   - Kies **niet** de Microsoft Store versie

> ⚠️ **Let op:** Microsoft Store versie van Python werkt **niet** met deze software.

### Jabra als standaard audio instellen

1. Klik rechtsonder op het **luidspreker-icoon** in de taakbalk
2. Klik op de pijl naast het volume
3. Selecteer je **Jabra headset** als uitvoerapparaat
4. Klik rechts op het luidspreker-icoon → **Geluiden** → tabblad **Opnemen**
5. Klik op je Jabra microfoon → **Als standaard instellen**

---

## 2. Installatie stap voor stap

### Stap 1 — Software kopiëren naar de pc

1. Kopieer de map **VolteraCompliance** naar de bureaublad of een USB-stick
2. Zorg dat de volgende bestanden aanwezig zijn in de map:
   - `setup.ps1`
   - `uninstall.ps1`
   - `main.py`
   - `requirements.txt`
   - `.env` *(moet ingevuld zijn — zie sectie 4)*

### Stap 2 — Het .env bestand invullen

Zie **sectie 4** van deze handleiding voor de exacte instructies.  
Doe dit **voordat** je verder gaat met stap 3.

### Stap 3 — Python-pakketten installeren

1. Open de map met de software
2. Klik in de adresbalk bovenaan het verkennervenster, typ `cmd` en druk op Enter  
   *(er opent een zwart venster in de juiste map)*
3. Typ het volgende en druk op Enter:
   ```
   pip install -r requirements.txt
   ```
4. Wacht tot de installatie klaar is. Je ziet aan het einde `Successfully installed ...`

### Stap 4 — Autostart instellen

1. Ga naar de map met de software
2. **Rechtsklik** op `setup.ps1`
3. Klik op **"Uitvoeren met PowerShell"**
4. Als Windows vraagt of je het wilt toestaan, klik op **"Ja"**
5. Je ziet een zwart venster met tekst. Wacht tot je het volgende ziet:
   ```
   ✅ Voltera Compliance Checker installed and running
   ```
6. Het venster sluit zichzelf, of je kunt het zelf sluiten

De software start nu automatisch mee bij elke Windows-aanmelding.

---

## 3. Controleren of het werkt

### Direct na installatie

Na het uitvoeren van `setup.ps1` start de software automatisch.

Controleer of het draait:
1. Druk op **Ctrl + Shift + Esc** om Taakbeheer te openen
2. Ga naar het tabblad **Details**
3. Zoek naar `pythonw.exe` in de lijst
4. Als je het ziet → de software draait ✅

### Logbestand controleren

De software schrijft alles weg naar een logbestand:

1. Ga naar: `C:\Users\[gebruikersnaam]\AppData\Local\VolteraCompliance\`
   - Tip: plak dit pad in de adresbalk van de verkenner:
     `%LOCALAPPDATA%\VolteraCompliance`
2. Open het bestand `compliance.log` met Kladblok
3. Je ziet regels zoals:
   ```
   2026-03-25 09:12:34 [INFO] Compliance recorder started
   2026-03-25 09:12:34 [INFO] Listening for calls...
   ```
4. Als het bestand leeg is of niet bestaat, zie sectie 6 (Problemen oplossen)

### Na herstart van de pc

1. Meld aan op Windows
2. Wacht **1 minuut**
3. Controleer Taakbeheer opnieuw op `pythonw.exe`

---

## 4. Het .env bestand invullen

Het `.env` bestand bevat de verbindingsinstellingen. Dit bestand wordt **niet** meegeleverd via GitHub en moet handmatig worden ingevuld.

### Waar vind je het bestand?

Het bestand heet `.env` en staat in de software-map. Open het met **Kladblok**.

> ⚠️ Windows verbergt bestanden die beginnen met een punt. Als je `.env` niet ziet:  
> Verkenner → **Beeld** → zet vinkje aan bij **"Verborgen items"**

### Wat moet je invullen?

Open het bestand `.env.example` als voorbeeld. Maak een kopie, hernoem naar `.env`, en vul de waarden in:

```
SUPABASE_URL=          ← ontvang je van de projectbeheerder
SUPABASE_SERVICE_KEY=  ← ontvang je van de projectbeheerder
GROQ_API_KEY=          ← ontvang je van de projectbeheerder
GMAIL_USER=            ← het e-mailadres waarvandaan meldingen worden gestuurd
GMAIL_APP_PASSWORD=    ← ontvang je van de projectbeheerder
EMAIL_TO=              ← het e-mailadres dat de meldingen ontvangt
```

**Let op:** zet geen aanhalingstekens of spaties rond de waarden.

✅ Correct: `SUPABASE_URL=https://voorbeeld.supabase.co`  
❌ Fout: `SUPABASE_URL = "https://voorbeeld.supabase.co"`

Sla het bestand op als `.env` (niet als `.env.txt`).

---

## 5. Verwijderen / herinstalleren

### Verwijderen

1. Ga naar de software-map
2. **Rechtsklik** op `uninstall.ps1`
3. Klik op **"Uitvoeren met PowerShell"**
4. Wacht op:
   ```
   ✅ Uninstalled cleanly
   ```

De software stopt, de geplande taak wordt verwijderd en de installatiebestanden worden verwijderd.

### Herinstalleren

1. Verwijder eerst via bovenstaande stappen
2. Doorloop daarna sectie 2 opnieuw vanaf stap 3

---

## 6. Problemen oplossen

### ❌ Probleem: "pythonw.exe not found"

**Oorzaak:** Python is geïnstalleerd via de Microsoft Store, niet via python.org.

**Oplossing:**
1. Verwijder Python via **Instellingen → Apps**
2. Download opnieuw via [python.org/downloads](https://python.org/downloads)
3. Zet tijdens installatie **"Add Python to PATH"** aan
4. Voer `setup.ps1` opnieuw uit

---

### ❌ Probleem: De taak start niet na aanmelden

**Oorzaak:** PowerShell-scripts zijn geblokkeerd door beveiligingsbeleid.

**Oplossing:**
1. Open PowerShell **als beheerder**:
   - Druk op de Windows-toets, typ `PowerShell`
   - Rechtsklik → **Als administrator uitvoeren**
2. Typ het volgende en druk op Enter:
   ```
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```
3. Bevestig met `J` of `Y`
4. Voer `setup.ps1` opnieuw uit

---

### ❌ Probleem: Het logbestand is leeg of bevat foutmeldingen over .env

**Oorzaak:** Het `.env` bestand ontbreekt of is niet correct ingevuld.

**Oplossing:**
1. Ga naar `%LOCALAPPDATA%\VolteraCompliance\`
2. Controleer of het bestand `.env` aanwezig is (niet `.env.txt`)
3. Open het en controleer of alle velden zijn ingevuld (geen lege regels na `=`)
4. Sla op en herstart de taak:
   - Druk op **Windows + R**, typ `taskschd.msc`, druk op Enter
   - Zoek **"Voltera Compliance Checker"** in de lijst
   - Rechtsklik → **Uitvoeren**

---

## Contact

Bij vragen of problemen: neem contact op met de projectbeheerder.  
Stuur het bestand `compliance.log` mee bij je vraag — dit helpt bij het oplossen van problemen.

Locatie logbestand: `%LOCALAPPDATA%\VolteraCompliance\compliance.log`
