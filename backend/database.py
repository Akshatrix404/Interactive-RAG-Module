"""
Iris AI Backend — database.py

What this file does
- Defines SQLAlchemy async engine + session dependency
- Declares ORM models used across the API
- Implements init_db() which creates required tables, triggers, seed admin
  and the customer_360_view view.

Order inside init_db():
  1. ORM tables        (users, chat_sessions, chat_messages)
  2. Supporting tables (customers, addresses, payment_profiles,
                        orders, browsing_history,
                        return_sessions, return_requests)
  3. admins table
  4. trigger function + triggers
  5. admin seed        (safe ON CONFLICT DO NOTHING)
  6. customer_360_view
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy import text
import os, uuid
from dotenv import load_dotenv

load_dotenv()

# ── Connection ────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:password@localhost:5432/helpdesk_db",
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    """FastAPI dependency — yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ── ORM Models ────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    username        = Column(String(100), unique=True, nullable=False)
    full_name       = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active       = Column(Boolean, default=True)
    is_admin        = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    sessions = relationship(
        "ChatSession", back_populates="user", cascade="all, delete-orphan"
    )


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title      = Column(String(255), default="New Chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user     = relationship("User", back_populates="sessions")
    messages = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    role       = Column(String(20), nullable=False)   # 'user' | 'assistant'
    content    = Column(Text, nullable=False)
    sources    = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")


# ── DB Init ───────────────────────────────────────────────────────────────────
async def init_db():
    async with engine.begin() as conn:

        # ── STEP 1: ORM tables (users, chat_sessions, chat_messages) ─────────
        await conn.run_sync(Base.metadata.create_all)

        # ── STEP 2: Supporting tables (must exist before triggers + view) ─────

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS customers (
                customer_id   SERIAL PRIMARY KEY,
                username      VARCHAR(100) UNIQUE NOT NULL,
                first_name    VARCHAR(100) NOT NULL,
                last_name     VARCHAR(100) NOT NULL,
                primary_email VARCHAR(255) UNIQUE NOT NULL,
                alt_email     VARCHAR(255),
                primary_phone VARCHAR(20),
                is_admin      BOOLEAN DEFAULT FALSE,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS addresses (
                address_id            SERIAL PRIMARY KEY,
                customer_id           INTEGER REFERENCES customers(customer_id) ON DELETE CASCADE,
                address_type          VARCHAR(20) DEFAULT 'shipping',
                street                VARCHAR(255),
                city                  VARCHAR(100),
                region                VARCHAR(100),
                postal_code           VARCHAR(20),
                country               VARCHAR(100) DEFAULT 'India',
                is_default            BOOLEAN DEFAULT TRUE,
                delivery_instructions TEXT
            );
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS payment_profiles (
                profile_id        SERIAL PRIMARY KEY,
                customer_id       INTEGER REFERENCES customers(customer_id) ON DELETE CASCADE,
                payment_type      VARCHAR(50),
                card_brand        VARCHAR(50),
                last_four         VARCHAR(4),
                upi_id            VARCHAR(100),
                gift_card_balance NUMERIC(10,2) DEFAULT 0,
                promo_credits     NUMERIC(10,2) DEFAULT 0,
                is_default        BOOLEAN DEFAULT TRUE
            );
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS orders (
                order_id      SERIAL PRIMARY KEY,
                customer_id   INTEGER REFERENCES customers(customer_id) ON DELETE CASCADE,
                status        VARCHAR(30) DEFAULT 'pending',
                total_amount  NUMERIC(10,2),
                currency      VARCHAR(10) DEFAULT 'INR',
                ordered_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                delivered_at  TIMESTAMP,
                product_name  VARCHAR(255),
                category      VARCHAR(100),
                return_reason TEXT
            );
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS browsing_history (
                history_id   SERIAL PRIMARY KEY,
                customer_id  INTEGER REFERENCES customers(customer_id) ON DELETE CASCADE,
                product_name VARCHAR(255),
                category     VARCHAR(100),
                viewed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS return_sessions (
                session_id        VARCHAR(100) PRIMARY KEY,
                user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
                order_id          INTEGER REFERENCES orders(order_id) ON DELETE CASCADE,
                status            VARCHAR(30) DEFAULT 'started',
                selected_reason   TEXT,
                detailed_reason   TEXT,
                confidence_score  NUMERIC(5,4),
                risk_level        VARCHAR(20),
                ai_explanation    TEXT,
                created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS return_requests (
                request_id      SERIAL PRIMARY KEY,
                user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
                order_id        INTEGER REFERENCES orders(order_id) ON DELETE CASCADE,
                reason          TEXT,
                detailed_reason TEXT,
                status          VARCHAR(30) DEFAULT 'pending',
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # ── STEP 3: Admins table ──────────────────────────────────────────────
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS admins (
                admin_id    SERIAL PRIMARY KEY,
                email       VARCHAR(100) UNIQUE NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # ── STEP 4: Trigger function + triggers ───────────────────────────────
        await conn.execute(text("""
            CREATE OR REPLACE FUNCTION sync_customer_admin_status()
            RETURNS TRIGGER AS $$
            BEGIN
                IF (TG_OP = 'INSERT') THEN
                    UPDATE customers
                       SET is_admin = TRUE
                     WHERE primary_email = NEW.email OR alt_email = NEW.email;

                    UPDATE users SET is_admin = TRUE WHERE email = NEW.email;

                ELSIF (TG_OP = 'DELETE') THEN
                    UPDATE customers
                       SET is_admin = FALSE
                     WHERE primary_email = OLD.email OR alt_email = OLD.email;

                    UPDATE users SET is_admin = FALSE WHERE email = OLD.email;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
        """))

        await conn.execute(text("DROP TRIGGER IF EXISTS trg_admin_insert ON admins;"))
        await conn.execute(text("""
            CREATE TRIGGER trg_admin_insert
            AFTER INSERT ON admins
            FOR EACH ROW EXECUTE FUNCTION sync_customer_admin_status();
        """))

        await conn.execute(text("DROP TRIGGER IF EXISTS trg_admin_delete ON admins;"))
        await conn.execute(text("""
            CREATE TRIGGER trg_admin_delete
            AFTER DELETE ON admins
            FOR EACH ROW EXECUTE FUNCTION sync_customer_admin_status();
        """))

        # ── STEP 5: Seed default admin ────────────────────────────────────────
        await conn.execute(text("""
            INSERT INTO admins (email)
            VALUES ('akshatkhandelwalunofficial@gmail.com')
            ON CONFLICT (email) DO NOTHING;
        """))

        # ── STEP 6: customer_360_view ─────────────────────────────────────────
        await conn.execute(text("DROP VIEW IF EXISTS customer_360_view CASCADE;"))
        await conn.execute(text("""
            CREATE OR REPLACE VIEW customer_360_view AS
            SELECT
                c.customer_id,
                c.username,
                c.first_name || ' ' || c.last_name                      AS full_name,
                c.primary_email,
                c.alt_email,
                c.is_admin,
                c.primary_phone                                          AS contact_number,

                a.street || ', ' || a.city || ', ' ||
                COALESCE(a.region, '') || ' ' ||
                COALESCE(a.postal_code, '') || ', ' ||
                a.country                                                AS full_address,
                a.city,
                a.country,
                a.delivery_instructions,

                p.payment_type,
                CASE
                    WHEN p.card_brand IS NOT NULL
                    THEN p.card_brand || ' ending ' || p.last_four
                    ELSE p.payment_type
                END                                                      AS payment_detail,
                COALESCE(p.gift_card_balance, 0)                         AS gift_card_balance,
                COALESCE(p.promo_credits, 0)                             AS promo_credits,

                COUNT(DISTINCT o.order_id)                               AS total_orders,
                COUNT(DISTINCT CASE WHEN o.status='delivered'  THEN o.order_id END) AS orders_delivered,
                COUNT(DISTINCT CASE WHEN o.status='returned'   THEN o.order_id END) AS orders_returned,
                COUNT(DISTINCT CASE WHEN o.status='shipped'    THEN o.order_id END) AS orders_shipped,
                COUNT(DISTINCT CASE WHEN o.status='cancelled'  THEN o.order_id END) AS orders_cancelled,
                COUNT(DISTINCT CASE WHEN o.status='pending'    THEN o.order_id END) AS orders_pending,

                COALESCE(SUM(o.total_amount), 0)                         AS total_spent,
                MAX(o.currency)                                          AS currency,
                STRING_AGG(DISTINCT o.return_reason, ' | ')              AS return_reasons,

                COUNT(DISTINCT b.history_id)                             AS total_browsed,
                STRING_AGG(DISTINCT b.category, ', ')                    AS browsed_categories,

                (
                    SELECT STRING_AGG(
                        ord_row.product_name || ' [' || ord_row.status || ', ' ||
                        ord_row.currency || ' ' || ord_row.total_amount::TEXT || ', ' ||
                        'ordered ' || TO_CHAR(ord_row.ordered_at, 'YYYY-MM-DD') ||
                        CASE WHEN ord_row.delivered_at IS NOT NULL
                             THEN ', delivered ' || TO_CHAR(ord_row.delivered_at, 'YYYY-MM-DD')
                             ELSE '' END ||
                        CASE WHEN ord_row.return_reason IS NOT NULL
                             THEN ', return reason: ' || ord_row.return_reason
                             ELSE '' END || ']',
                        ' | '
                        ORDER BY ord_row.ordered_at DESC
                    )
                    FROM (
                        SELECT
                            o2.order_id, o2.status, o2.total_amount, o2.currency,
                            o2.ordered_at, o2.delivered_at, o2.return_reason,
                            COALESCE((
                                SELECT bh.product_name
                                FROM   browsing_history bh
                                WHERE  bh.customer_id = o2.customer_id
                                  AND  bh.viewed_at BETWEEN o2.ordered_at - INTERVAL '30 days'
                                                        AND o2.ordered_at + INTERVAL '7 days'
                                ORDER BY ABS(EXTRACT(EPOCH FROM (bh.viewed_at - o2.ordered_at)))
                                LIMIT 1
                            ), 'Unknown product') AS product_name
                        FROM orders o2
                        WHERE o2.customer_id = c.customer_id
                        ORDER BY o2.ordered_at DESC
                        LIMIT 10
                    ) ord_row
                ) AS ordered_products,

                (
                    SELECT STRING_AGG(
                        s.status || ': ' || s.currency || ' ' ||
                        s.total_amount::TEXT ||
                        ' (' || TO_CHAR(s.ordered_at, 'YYYY-MM-DD') || ')',
                        ' | '
                        ORDER BY s.ordered_at DESC
                    )
                    FROM (
                        SELECT status, currency, total_amount, ordered_at
                        FROM   orders
                        WHERE  customer_id = c.customer_id
                        ORDER BY ordered_at DESC
                        LIMIT 5
                    ) s
                ) AS recent_orders_summary

            FROM customers c
            LEFT JOIN addresses a
                ON  a.customer_id  = c.customer_id
                AND a.is_default   = TRUE
                AND a.address_type IN ('shipping', 'both')
            LEFT JOIN payment_profiles p
                ON  p.customer_id = c.customer_id
                AND p.is_default  = TRUE
            LEFT JOIN orders o
                ON  o.customer_id = c.customer_id
            LEFT JOIN browsing_history b
                ON  b.customer_id = c.customer_id
            GROUP BY
                c.customer_id, c.username, c.first_name, c.last_name,
                c.primary_email, c.alt_email, c.is_admin, c.primary_phone,
                a.street, a.city, a.region, a.postal_code, a.country, a.delivery_instructions,
                p.payment_type, p.card_brand, p.last_four, p.gift_card_balance, p.promo_credits
            ORDER BY c.username;
        """))

    print("SUCCESS: All tables, triggers, admin seed, and customer_360_view are ready.")
