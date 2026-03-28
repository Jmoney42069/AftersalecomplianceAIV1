import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import GMAIL_APP_PASSWORD, GMAIL_USER, EMAIL_TO

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465


def _subject(oordeel: str, timestamp: str) -> str:
    icons = {"AFGEKEURD": "❌ AFGEKEURD", "RISICO": "⚠️ RISICO", "GOEDGEKEURD": "✅ GOEDGEKEURD"}
    prefix = icons.get(oordeel, oordeel)
    return f"{prefix} — Gesprek {timestamp}"


def _check_row(label: str, voldaan: bool, toelichting: str) -> str:
    icon = "✅" if voldaan else "❌"
    bg = "#f9f9f9" if voldaan else "#fff3f3"
    return (
        f'<tr style="background:{bg}">'
        f"<td style='padding:8px 12px;border:1px solid #ddd'>{label}</td>"
        f"<td style='padding:8px 12px;border:1px solid #ddd;text-align:center'>{icon}</td>"
        f"<td style='padding:8px 12px;border:1px solid #ddd'>{toelichting}</td>"
        f"</tr>"
    )


def _claims_row(report: dict) -> str:
    vc = report.get("verboden_claims", {})
    gevonden = vc.get("gevonden", False)
    claims = vc.get("claims") or []
    toelichting = ", ".join(claims) if gevonden and claims else ("Geen gevonden" if not gevonden else "Zie rapport")
    icon = "❌" if gevonden else "✅"
    bg = "#fff3f3" if gevonden else "#f9f9f9"
    return (
        f'<tr style="background:{bg}">'
        f"<td style='padding:8px 12px;border:1px solid #ddd'>Verboden claims</td>"
        f"<td style='padding:8px 12px;border:1px solid #ddd;text-align:center'>{icon}</td>"
        f"<td style='padding:8px 12px;border:1px solid #ddd'>{toelichting}</td>"
        f"</tr>"
    )


def _rode_vlaggen_row(report: dict) -> str:
    rv = report.get("rode_vlaggen", {})
    gevonden = rv.get("gevonden", False)
    details = rv.get("details") or []
    toelichting = ", ".join(details) if gevonden and details else ("Geen gevonden" if not gevonden else "Zie rapport")
    icon = "⚠️" if gevonden else "✅"
    bg = "#fffbf0" if gevonden else "#f9f9f9"
    return (
        f'<tr style="background:{bg}">'
        f"<td style='padding:8px 12px;border:1px solid #ddd'>Rode vlaggen</td>"
        f"<td style='padding:8px 12px;border:1px solid #ddd;text-align:center'>{icon}</td>"
        f"<td style='padding:8px 12px;border:1px solid #ddd'>{toelichting}</td>"
        f"</tr>"
    )


def _build_html(timestamp: str, transcript: str, report: dict) -> str:
    oordeel = report.get("algemeen_oordeel", "ONBEKEND")
    samenvatting = report.get("samenvatting", "—")

    pc = report.get("productcombinatie", {})
    pv = report.get("prijs_en_voorwaarden", {})
    ak = report.get("akkoord_klant", {})

    colors = {"AFGEKEURD": "#c0392b", "RISICO": "#e67e22", "GOEDGEKEURD": "#27ae60"}
    oordeel_color = colors.get(oordeel, "#333")

    rows = "\n".join([
        _check_row("Productcombinatie", pc.get("voldaan", False), pc.get("toelichting", "—")),
        _check_row("Prijs & Voorwaarden", pv.get("voldaan", False), pv.get("toelichting", "—")),
        _check_row("Akkoord klant", ak.get("voldaan", False), ak.get("toelichting", "—")),
        _claims_row(report),
        _rode_vlaggen_row(report),
    ])

    return f"""\
<!DOCTYPE html>
<html lang="nl">
<body style="font-family:Arial,sans-serif;color:#222;max-width:800px;margin:0 auto;padding:24px">

  <h2 style="color:{oordeel_color}">
    Compliance rapport — {timestamp}
  </h2>

  <p>
    <strong>Oordeel:</strong>
    <span style="color:{oordeel_color};font-weight:bold">{oordeel}</span>
  </p>

  <p><strong>Samenvatting:</strong><br>{samenvatting}</p>

  <h3 style="margin-top:28px">Controlepunten</h3>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <thead>
      <tr style="background:#333;color:#fff">
        <th style="padding:8px 12px;text-align:left">Controle</th>
        <th style="padding:8px 12px;text-align:center">Status</th>
        <th style="padding:8px 12px;text-align:left">Toelichting</th>
      </tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
  </table>

  <h3 style="margin-top:32px">Transcript</h3>
  <pre style="background:#f4f4f4;padding:16px;border-radius:4px;
              font-size:13px;white-space:pre-wrap;word-break:break-word;
              border:1px solid #ddd">{transcript}</pre>

</body>
</html>"""


def send_report(timestamp: str, transcript: str, report: dict) -> None:
    """Send compliance email for all calls (GOEDGEKEURD, RISICO, AFGEKEURD)."""
    oordeel = report.get("algemeen_oordeel")

    if oordeel not in ("GOEDGEKEURD", "RISICO", "AFGEKEURD"):
        logger.warning("Unexpected oordeel '%s' — sending email anyway", oordeel)

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = _subject(oordeel, timestamp)
        msg["From"] = GMAIL_USER
        msg["To"] = EMAIL_TO

        html_part = MIMEText(_build_html(timestamp, transcript, report), "html", "utf-8")
        msg.attach(html_part)

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, EMAIL_TO, msg.as_string())

        logger.info("Email sent → %s (oordeel: %s, gesprek: %s)", EMAIL_TO, oordeel, timestamp)

    except Exception:
        logger.exception("Failed to send compliance email for %s", timestamp)
