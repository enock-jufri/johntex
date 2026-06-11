import json
import logging
import os

import httpx
from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")


def _format_alert(alert: dict, status: str) -> str:
    labels = alert.get("labels", {})
    annotations = alert.get("annotations", {})
    severity = labels.get("severity", "warning")
    emoji = {"critical": "🔴", "warning": "🟡", "info": "🔵"}.get(severity, "⚪")

    lines = [
        f"{emoji} <b>[{status.upper()}] {annotations.get('summary', alert.get('alertname', 'Alert'))}</b>",
        f"<i>{annotations.get('description', '')}</i>",
        "",
        f"<b>Severity:</b> {severity}",
        f"<b>Alert:</b> {alert.get('alertname', '')}",
    ]

    if labels:
        extras = {k: v for k, v in labels.items() if k not in ("severity", "alertname")}
        if extras:
            lines.append(f"<b>Labels:</b> {json.dumps(extras)}")

    return "\n".join(lines)


@router.post("/telegram")
async def alertmanager_telegram(request: Request):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram not configured — skipping alert delivery")
        return {"status": "skipped", "reason": "Telegram not configured"}

    body = await request.json()
    logger.info("Alertmanager webhook received", extra={"alert_count": len(body.get("alerts", []))})

    for alert in body.get("alerts", []):
        status = alert.get("status", "firing")
        message = _format_alert(alert, status)

        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML",
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code != 200:
                    logger.error(
                        "Telegram send failed",
                        extra={"status": resp.status_code, "body": resp.text[:200]},
                    )
                else:
                    logger.info(
                        "Alert sent to Telegram",
                        extra={"alertname": alert.get("labels", {}).get("alertname", "unknown"), "status": status},
                    )
        except Exception:
            logger.error("Telegram send error", exc_info=True)

    return {"status": "ok", "sent": len(body.get("alerts", []))}
