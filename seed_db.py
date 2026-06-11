import asyncio
import random
from datetime import date, datetime, timedelta

from sqlmodel import select

from sqlalchemy import delete

from app.database import async_session
from app.crud.wallet import add_advance, add_earning, add_payout, recalculate_wallet
from app.models import (
    Role, User, Worker, Product, ProductionLog,
    Advance, Payroll, Setting, AuditLog, WalletTransaction, WorkerWallet,
)
from app.security import get_password_hash
from app.timezone import eat_now


async def seed():
    async with async_session() as session:
        result = await session.execute(select(Role))
        if result.scalars().first():
            print("Database already seeded, skipping.")
            return

        print("Seeding roles...")
        admin_role = Role(name="admin")
        supervisor_role = Role(name="supervisor")
        clerk_role = Role(name="clerk")
        session.add_all([admin_role, supervisor_role, clerk_role])
        await session.flush()

        print("Seeding users...")
        admin_user = User(
            username="admin",
            hashed_password=get_password_hash("admin123"),
            role_id=admin_role.id,
        )
        supervisor_user = User(
            username="supervisor",
            hashed_password=get_password_hash("supervisor123"),
            role_id=supervisor_role.id,
        )
        clerk_user = User(
            username="clerk",
            hashed_password=get_password_hash("clerk123"),
            role_id=clerk_role.id,
        )
        session.add_all([admin_user, supervisor_user, clerk_user])
        await session.flush()

        print("Seeding workers (10 — 9 active, 1 inactive)...")
        workers_data = [
            ("James Mwangi",   "0712345678", True),
            ("Mary Wambui",    "0723456789", True),
            ("Peter Odhiambo", "0734567890", True),
            ("Grace Akinyi",   "0745678901", True),
            ("David Kimani",   "0756789012", True),
            ("Esther Njeri",   "0767890123", True),
            ("John Kiprotich", "0778901234", True),
            ("Sarah Achieng",  "0789012345", True),
            ("enock koech",    "0790123456", True),
            ("kimani wamatangi", "0701122334", False),  # inactive
        ]
        workers = []
        for name, phone, active in workers_data:
            w = Worker(name=name, phone=phone, active=active, created_by=admin_user.id)
            session.add(w)
            workers.append(w)
        await session.flush()

        print("Seeding products...")
        products_data = [
            ("Dress Shirt", 150.0),
            ("Trousers", 200.0),
            ("School Uniform Shirt", 100.0),
            ("School Uniform Skirt", 120.0),
            ("Blazer / Jacket", 500.0),
            ("Suit (2-Piece)", 1200.0),
            ("African Kitenge Shirt", 250.0),
            ("Ladies' Blouse", 180.0),
        ]
        products = []
        for name, price in products_data:
            p = Product(name=name, unit_price=price, created_by=admin_user.id)
            session.add(p)
            products.append(p)
        await session.flush()

        today = date.today()
        approvers = [supervisor_user.id, admin_user.id]

        # ── Production logs ────────────────────────────────────────────

        print("Seeding production logs (last 30 days)...")
        prod_logs: list[ProductionLog] = []
        for days_ago in range(30):
            day = today - timedelta(days=days_ago)
            if day.weekday() == 6:  # no production Sundays
                continue
            entries_today = random.randint(3, 8)
            used_workers = random.sample(
                [w for w in workers if w.active], min(entries_today, 9)
            )
            for w in used_workers:
                p = random.choice(products)
                qty = random.randint(1, 8)
                approved = random.random() < 0.75
                notes_options = [
                    None, None, None,
                    "Morning batch",
                    "Afternoon batch",
                    "Rush order",
                    "School order - St. Mary's",
                    "Custom measurements",
                ]
                log = ProductionLog(
                    worker_id=w.id,
                    product_id=p.id,
                    production_date=day,
                    quantity=qty,
                    amount=qty * p.unit_price,
                    approved=approved,
                    approved_by=random.choice(approvers) if approved else None,
                    notes=random.choice(notes_options),
                )
                session.add(log)
                prod_logs.append(log)
        await session.flush()

        # ── Advances (with payment statuses) ────────────────────────────

        print("Seeding advances with payment methods and statuses...")
        advance_notes = [
            "School fees", "Medical", "Rent advance", "Transport",
            "Food expenses", "Emergency", "Family support", None, None,
        ]
        advances: list[Advance] = []
        for days_ago in range(0, 30, random.randint(2, 5)):
            day = today - timedelta(days=days_ago)
            w = random.choice(workers)
            amount = random.choice([300, 500, 750, 1000, 1500, 2000])
            approved = random.random() < 0.6
            payment_method = random.choice(["cash", "cash", "cash", "mpesa"])

            # Determine payment status
            if not approved:
                payment_status = "pending"
            else:
                roll = random.random()
                if roll < 0.65:
                    payment_status = "paid"
                elif roll < 0.80:
                    payment_status = "processing"
                elif roll < 0.90:
                    payment_status = "failed"
                else:
                    payment_status = "pending"

            paid_at = eat_now() if payment_status == "paid" else None

            advance = Advance(
                worker_id=w.id,
                advance_date=day,
                amount=amount,
                approved=approved,
                approved_by=random.choice(approvers) if approved else None,
                notes=random.choice(advance_notes),
                payment_method=payment_method,
                payment_status=payment_status,
                paid_at=paid_at,
            )
            session.add(advance)
            advances.append(advance)
        await session.flush()

        # ── Payroll (with payment statuses) ─────────────────────────────

        print("Seeding payrolls (4 weekly runs, varied statuses)...")
        payrolls: list[Payroll] = []
        active_workers = [w for w in workers if w.active]
        for weeks_ago in range(4):
            week_start = today - timedelta(days=today.weekday()) - timedelta(weeks=weeks_ago)
            for w in active_workers:
                gross = round(random.uniform(400, 2500), 2)
                advances_deduction = round(random.uniform(0, gross * 0.4), 2)
                net = round(gross - advances_deduction, 2)
                payment_method = random.choice(["cash", "cash", "mpesa"])

                roll = random.random()
                if roll < 0.60:
                    payment_status = "paid"
                elif roll < 0.75:
                    payment_status = "processing"
                elif roll < 0.88:
                    payment_status = "pending"
                else:
                    payment_status = "failed"

                paid_at = eat_now() if payment_status == "paid" else None

                payroll = Payroll(
                    worker_id=w.id,
                    week_start=week_start,
                    gross_pay=gross,
                    total_advances=advances_deduction,
                    total_deductions=0.0,
                    net_pay=net,
                    payment_method=payment_method,
                    payment_status=payment_status,
                    paid_at=paid_at,
                )
                session.add(payroll)
                payrolls.append(payroll)
        await session.flush()

        # ── Wallet transactions (TXN-level, not just totals) ────────────

        print("Building worker wallets from transactions...")

        # Reset wallets first
        await session.execute(delete(WalletTransaction))
        await session.execute(delete(WorkerWallet))
        await session.flush()

        # Add earnings for approved production
        for log in prod_logs:
            if log.approved:
                await add_earning(
                    session,
                    worker_id=log.worker_id,
                    amount=log.amount,
                    reference_type="production_log",
                    reference_id=log.id,
                    description=f"{log.quantity} pcs — {log.production_date}",
                )

        # Add advances ONLY for paid ones
        for adv in advances:
            if adv.payment_status == "paid":
                await add_advance(
                    session,
                    worker_id=adv.worker_id,
                    amount=adv.amount,
                    reference_type="advance",
                    reference_id=adv.id,
                    description=adv.notes or f"Advance #{adv.id}",
                )

        # Add payouts ONLY for paid payroll
        for pay in payrolls:
            if pay.payment_status == "paid":
                await add_payout(
                    session,
                    worker_id=pay.worker_id,
                    amount=pay.net_pay,
                    reference_type="payroll",
                    reference_id=pay.id,
                    description=f"Payroll — week {pay.week_start}",
                )

        # Cross-check: recalculate wallets and verify consistency
        print("Cross-checking wallets via recalculation...")
        for w in workers:
            await recalculate_wallet(session, w.id)

        # ── Settings ────────────────────────────────────────────────────

        print("Seeding settings...")
        settings_data = [
            Setting(key="company_name", value="Johntex Tailoring"),
            Setting(key="currency", value="KES"),
            Setting(key="payroll_day", value="Friday"),
            Setting(key="mpesa_environment", value="sandbox"),
            Setting(key="mpesa_consumer_key", value=""),
            Setting(key="mpesa_consumer_secret", value=""),
            Setting(key="mpesa_shortcode", value=""),
            Setting(key="mpesa_initiator_name", value=""),
            Setting(key="mpesa_security_credential", value=""),
            Setting(
                key="mpesa_b2c_result_url",
                value="https://yourdomain.com/api/payments/mpesa/callback",
            ),
            Setting(
                key="mpesa_b2c_timeout_url",
                value="https://yourdomain.com/api/payments/mpesa/callback",
            ),
        ]
        session.add_all(settings_data)

        # ── Audit log ───────────────────────────────────────────────────

        print("Seeding audit logs...")
        audit_logs = [
            AuditLog(
                user_id=admin_user.id,
                action="seed",
                details="Database seeded with 30 days of production, advances with payment statuses, and payroll runs",
            ),
        ]
        session.add_all(audit_logs)

        await session.commit()

    # ── Summary ──────────────────────────────────────────────────────

    print()
    paid_advances = sum(1 for a in advances if a.payment_status == "paid")
    paid_payroll = sum(1 for p in payrolls if p.payment_status == "paid")
    print(f"Seeding complete!")
    print(f"  Workers:        {len(workers)} ({sum(1 for w in workers if w.active)} active, {sum(1 for w in workers if not w.active)} inactive)")
    print(f"  Production:     {len(prod_logs)} logs")
    print(f"  Advances:       {len(advances)} ({paid_advances} paid, {sum(1 for a in advances if a.payment_status == 'processing')} processing, {sum(1 for a in advances if a.payment_status == 'pending')} pending, {sum(1 for a in advances if a.payment_status == 'failed')} failed)")
    print(f"  Payroll:        {len(payrolls)} records ({paid_payroll} paid, {sum(1 for p in payrolls if p.payment_status == 'processing')} processing, {sum(1 for p in payrolls if p.payment_status == 'pending')} pending, {sum(1 for p in payrolls if p.payment_status == 'failed')} failed)")
    print(f"  Date range:     {today - timedelta(days=30)} to {today}")


if __name__ == "__main__":
    asyncio.run(seed())
