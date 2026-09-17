"""
Tek seferlik bakım script'i: Postgres'teki tüm fişleri okuyup Qdrant'a yeniden indeksler.

Kullanım (backend/ dizininden):
    railway run --service ReceiptIQ -- python3 scripts/reindex_qdrant.py

OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY değerlerini `railway run`
production ortamından otomatik enjekte eder — bu script hiçbirini
ekrana yazdırmaz.
"""
import asyncio
import json
import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg


async def main():
    result = subprocess.run(
        ["railway", "variable", "list", "--service", "Postgres", "--json"],
        capture_output=True, text=True, check=True,
    )
    pg_vars = json.loads(result.stdout)
    db_url = pg_vars["DATABASE_PUBLIC_URL"]

    conn = await asyncpg.connect(db_url)
    try:
        rows = await conn.fetch(
            """
            SELECT id, user_id, merchant_name, category, total_amount,
                   receipt_date, text_content
            FROM receipt
            """
        )
    finally:
        await conn.close()

    print(f"Toplam {len(rows)} fiş bulundu, yeniden indeksleniyor...")

    from app.services.vector_store import index_receipt

    success, failed = 0, 0
    for r in rows:
        text = r["text_content"] or f"{r['merchant_name'] or ''} {r['category'] or ''}"
        ok = index_receipt(
            receipt_id=r["id"],
            user_id=r["user_id"],
            text=text,
            metadata={
                "merchant_name": r["merchant_name"] or "",
                "category": r["category"] or "",
                "amount": str(r["total_amount"]) if r["total_amount"] else "",
                "date": r["receipt_date"].isoformat() if r["receipt_date"] else "",
                "text": text[:500],
            },
        )
        if ok:
            success += 1
        else:
            failed += 1

    print(f"Bitti: {success} başarılı, {failed} başarısız")


if __name__ == "__main__":
    asyncio.run(main())
