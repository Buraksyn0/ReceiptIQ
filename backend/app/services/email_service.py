"""
ReceiptIQ — E-posta Bildirim Servisi

Resend (HTTP API) üzerinden kullanıcıya e-posta gönderir.
RESEND_API_KEY ayarlanmamışsa sessizce atlar.

Kullanım:
    await send_budget_exceeded_email(user_email, category_label, spent, limit)
    await send_anomaly_email(user_email, merchant, amount, date)
"""

from __future__ import annotations
import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


RESEND_SEND_URL = "https://api.resend.com/emails"


async def send_budget_exceeded_email(
    to_email: str,
    category_label: str,
    spent: float,
    limit: float,
) -> bool:
    """Bütçe aşımı e-postası gönder."""
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

    return await _send(to_email, subject, html_content)


async def send_anomaly_email(
    to_email: str,
    merchant: str,
    amount: float,
    date_str: str,
) -> bool:
    """Anormal harcama e-postası gönder."""
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

    return await _send(to_email, subject, html_content)


async def _send(to_email: str, subject: str, html: str) -> bool:
    """
    Resend API üzerinden e-posta gönderir. API anahtarı yoksa sessizce False döner.
    Başarıda Resend, HTTP 200 ve {"id": "..."} döner; hata varsa 4xx/5xx.
    """
    if not settings.RESEND_API_KEY:
        return False

    payload = {
        "from": settings.EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                RESEND_SEND_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            )
        body = resp.json()
        if resp.status_code != 200 or not body.get("id"):
            log.error(
                "E-posta gönderilemedi: HTTP %s %s",
                resp.status_code,
                body.get("message") or body.get("name"),
            )
            return False
        log.info("E-posta gönderildi: %s → %s", subject, to_email)
        return True
    except Exception as e:
        log.error("E-posta gönderilemedi: %s", e)
        return False


async def send_verification_code_email(to_email: str, code: str) -> bool:
    """Kayıt sonrası e-posta doğrulama kodunu gönder."""
    subject = "ReceiptIQ - E-posta Doğrulama Kodu"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f7f8ff; border-radius: 16px;">
      <h2 style="color: #008080; margin-bottom: 8px;">ReceiptIQ</h2>
      <p style="color: #1A1D1E; font-size: 16px;">E-posta adresinizi doğrulamak için aşağıdaki kodu uygulamaya girin:</p>
      <div style="background: #fff; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; border: 2px solid #008080;">
        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #008080;">{code}</span>
      </div>
      <p style="color: #6B7280; font-size: 13px;">Bu kod 15 dakika geçerlidir. Bu hesabı siz oluşturmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
    </div>
    """
    return await _send(to_email, subject, html_content)


async def send_password_reset_email(to_email: str, code: str) -> bool:
    """Şifre sıfırlama kodunu gönder."""
    subject = "ReceiptIQ - Şifre Sıfırlama Kodu"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f7f8ff; border-radius: 16px;">
        <h2 style="color: #008080; margin-bottom: 8px;">ReceiptIQ</h2>
        <p style="color: #1A1D1E; font-size: 16px;">Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:</p>
        <div style="background: #fff; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; border: 2px solid #008080;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #008080;">{code}</span>
        </div>
        <p style="color: #6B7280; font-size: 13px;">Bu kod 15 dakika geçerlidir. Eğer bu isteği siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
    </div>
    """
    return await _send(to_email, subject, html_content)
