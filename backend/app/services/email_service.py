"""
ReceiptIQ — E-posta Bildirim Servisi

SendGrid üzerinden kullanıcıya e-posta gönderir.
SENDGRID_API_KEY ayarlanmamışsa sessizce atlar.

Kullanım:
    await send_budget_exceeded_email(user_email, category_label, spent, limit)
    await send_anomaly_email(user_email, merchant, amount, date)
"""

from __future__ import annotations
import logging

log = logging.getLogger(__name__)


def _get_sendgrid():
    """SendGrid client ve ayarları döner. API key yoksa None."""
    try:
        from app.core.config import settings
        if not settings.SENDGRID_API_KEY:
            return None, None
        from sendgrid import SendGridAPIClient
        return SendGridAPIClient(settings.SENDGRID_API_KEY), settings.SENDGRID_FROM_EMAIL
    except Exception as e:
        log.warning("SendGrid başlatılamadı: %s", e)
        return None, None


async def send_budget_exceeded_email(
    to_email: str,
    category_label: str,
    spent: float,
    limit: float,
) -> bool:
    """Bütçe aşımı e-postası gönder."""
    sg, from_email = _get_sendgrid()
    if sg is None:
        return False

    overflow = spent - limit
    subject = f"⚠️ Bütçe Limitini Aştınız — {category_label}"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <div style="background: #008080; border-radius: 12px; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">⚠️ Bütçe Uyarısı</h1>
      </div>
      <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-top: 16px;">
        <p style="font-size: 16px; color: #333;">
          <strong>{category_label}</strong> kategorisinde bu ay belirlediğiniz bütçe limitini aştınız.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <tr>
            <td style="padding: 8px; color: #666;">Bütçe Limiti</td>
            <td style="padding: 8px; font-weight: bold; text-align: right;">₺{limit:,.2f}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 8px; color: #666;">Toplam Harcama</td>
            <td style="padding: 8px; font-weight: bold; text-align: right; color: #e74c3c;">₺{spent:,.2f}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Aşım Miktarı</td>
            <td style="padding: 8px; font-weight: bold; text-align: right; color: #e74c3c;">₺{overflow:,.2f}</td>
          </tr>
        </table>
        <p style="font-size: 13px; color: #888; margin-top: 16px;">
          Harcamalarınızı kontrol etmek için ReceiptIQ uygulamasını açabilirsiniz.
        </p>
      </div>
    </div>
    """

    return _send(sg, from_email, to_email, subject, html_content)


async def send_anomaly_email(
    to_email: str,
    merchant: str,
    amount: float,
    date_str: str,
) -> bool:
    """Anormal harcama e-postası gönder."""
    sg, from_email = _get_sendgrid()
    if sg is None:
        return False

    subject = "🚨 Anormal Harcama Tespit Edildi"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <div style="background: #e74c3c; border-radius: 12px; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🚨 Anormal Harcama</h1>
      </div>
      <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-top: 16px;">
        <p style="font-size: 16px; color: #333;">
          Alışılmadık bir harcama tespit ettik. Bu işlemi siz yapmadıysanız lütfen hesabınızı kontrol edin.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <tr>
            <td style="padding: 8px; color: #666;">İşyeri</td>
            <td style="padding: 8px; font-weight: bold; text-align: right;">{merchant}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 8px; color: #666;">Tutar</td>
            <td style="padding: 8px; font-weight: bold; text-align: right; color: #e74c3c;">₺{amount:,.2f}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Tarih</td>
            <td style="padding: 8px; text-align: right;">{date_str}</td>
          </tr>
        </table>
        <p style="font-size: 13px; color: #888; margin-top: 16px;">
          Detayları görmek için ReceiptIQ uygulamasını açabilirsiniz.
        </p>
      </div>
    </div>
    """

    return _send(sg, from_email, to_email, subject, html_content)


def _send(sg, from_email: str, to_email: str, subject: str, html: str) -> bool:
    """SendGrid üzerinden e-posta gönder."""
    try:
        from sendgrid.helpers.mail import Mail
        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=subject,
            html_content=html,
        )
        response = sg.send(message)
        log.info("E-posta gönderildi: %s → %s (status=%s)", subject, to_email, response.status_code)
        return True
    except Exception as e:
        log.error("E-posta gönderilemedi: %s", e)
        return False
