import json
import logging
import re
import time

from config import ANTHROPIC_API_KEY, GROQ_API_KEY

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-opus-4-20250514"
GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """\
Je bent een strenge compliance officer voor Voltera, een Nederlands energiebedrijf \
dat zonnepanelen, warmtepompen en thuisbatterijen verkoopt aan consumenten via \
telefonische verkoop (closers).

Je taak: analyseer het transcript van een verkoopgesprek en controleer of de closer \
voldoet aan alle wettelijke en interne regels.

Controleer op de volgende punten:

1. **productcombinatie** — Is de juiste productcombinatie verkocht en correct benoemd? \
Zijn de producten duidelijk uitgelegd?

2. **prijs_en_voorwaarden** — Zijn de prijs, maandelijkse kosten, looptijd, \
opzegtermijn, bedenktijd en eventuele subsidies correct en eerlijk gecommuniceerd?

3. **akkoord_klant** — Heeft de klant expliciet mondeling toestemming gegeven voor \
de aankoop? Een vaag "ja" op een algemene vraag is NIET voldoende. De klant moet \
begrijpen wat hij/zij koopt en daar duidelijk mee akkoord gaan.

4. **verboden_claims** — Zoek naar verboden of misleidende uitspraken, waaronder:
   - "Wij werken samen met de gemeente"
   - "Dit is een overheidsproject"
   - "De overheid betaalt dit"
   - Misleidende subsidie-claims
   - Valse verwijzingen naar autoriteiten of overheidsinstellingen
   - Elke claim die suggereert dat Voltera een overheidsinstantie is of \
     namens de overheid handelt

5. **rode_vlaggen** — Andere zorgwekkende zaken: druk uitoefenen, \
kwetsbare personen, onduidelijke communicatie, ontwijkende antwoorden \
op directe vragen, of het gesprek voeren met iemand die duidelijk \
de inhoud niet begrijpt.

Beoordeling (algemeen_oordeel):
- **AFGEKEURD** — als er een verboden claim is gevonden OF als de klant \
  GEEN expliciet akkoord heeft gegeven.
- **RISICO** — als iets onduidelijk of grensgevallen is, maar geen \
  harde overtreding.
- **GOEDGEKEURD** — alleen als ALLE controles positief zijn.

Antwoord UITSLUITEND met geldige JSON. Geen markdown, geen toelichting buiten \
de JSON. Gebruik exact dit formaat:

{
  "productcombinatie": {
    "voldaan": true/false,
    "toelichting": "..."
  },
  "prijs_en_voorwaarden": {
    "voldaan": true/false,
    "toelichting": "..."
  },
  "akkoord_klant": {
    "voldaan": true/false,
    "toelichting": "..."
  },
  "verboden_claims": {
    "gevonden": true/false,
    "claims": ["..."]
  },
  "rode_vlaggen": {
    "gevonden": true/false,
    "details": ["..."]
  },
  "algemeen_oordeel": "GOEDGEKEURD | RISICO | AFGEKEURD",
  "samenvatting": "Korte samenvatting van het gesprek en de beoordeling."
}
"""

VALID_OORDELEN = {"GOEDGEKEURD", "RISICO", "AFGEKEURD"}


def _parse_response(raw: str) -> dict:
    """Strip markdown fences and parse JSON."""
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().strip("`")
    return json.loads(cleaned)


def _call_claude(transcript: str) -> dict:
    import anthropic

    logger.info("Calling Claude (%s)...", CLAUDE_MODEL)
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": transcript}],
    )

    raw = response.content[0].text
    return _parse_response(raw)


def _call_groq(transcript: str) -> dict:
    from openai import OpenAI

    # Groq on-demand TPM limit is 12000. System prompt is ~600 tokens,
    # response needs ~2048. Cap transcript at ~7500 words ≈ 9000 tokens.
    MAX_WORDS = 7500
    words = transcript.split()
    if len(words) > MAX_WORDS:
        half = MAX_WORDS // 2
        transcript = (
            " ".join(words[:half])
            + "\n\n[... transcript ingekort vanwege lengte ...]\n\n"
            + " ".join(words[-half:])
        )
        logger.info("Transcript ingekort naar %d woorden voor Groq API", MAX_WORDS)

    logger.info("Calling Groq (%s)...", GROQ_MODEL)
    client = OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=2048,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript},
        ],
    )

    raw = response.choices[0].message.content
    return _parse_response(raw)


def check_compliance(transcript: str) -> dict:
    """Run compliance check on a transcript. Returns structured report dict.
    Retries up to 3 times with exponential backoff on transient failures."""

    if ANTHROPIC_API_KEY:
        call_fn = _call_claude
        provider = "Claude"
    elif GROQ_API_KEY:
        call_fn = _call_groq
        provider = "Groq"
    else:
        logger.error("No AI API key configured (ANTHROPIC_API_KEY or GROQ_API_KEY)")
        return {"error": "No AI API key configured", "algemeen_oordeel": "FOUT"}

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            report = call_fn(transcript)

            oordeel = report.get("algemeen_oordeel")
            if oordeel not in VALID_OORDELEN:
                logger.warning("Unexpected oordeel '%s', treating as RISICO", oordeel)
                report["algemeen_oordeel"] = "RISICO"

            logger.info("Compliance check (%s) → %s", provider, report["algemeen_oordeel"])
            return report

        except json.JSONDecodeError as e:
            logger.warning(
                "Attempt %d/%d: JSON parse error from %s: %s",
                attempt, max_attempts, provider, e,
            )
            # JSON failures are unlikely to improve on retry — bail immediately
            return {"error": f"JSON parse error: {e}", "algemeen_oordeel": "FOUT"}

        except Exception as e:
            logger.warning(
                "Attempt %d/%d: %s API error: %s",
                attempt, max_attempts, provider, e,
            )
            if attempt < max_attempts:
                wait = 2 ** attempt  # 2s, 4s
                logger.info("Retrying in %ds...", wait)
                time.sleep(wait)

    logger.error("Compliance check failed after %d attempts (%s)", max_attempts, provider)
    return {"error": f"Failed after {max_attempts} attempts", "algemeen_oordeel": "FOUT"}
