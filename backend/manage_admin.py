"""
manage_admin.py — Add or remove admins directly from VS Code terminal.

Purpose
- Simple CLI helper to insert/delete an admin email in PostgreSQL.
- Uses psycopg2 (sync) so it can run independently of FastAPI/async.

Usage:
    python manage_admin.py add    akshat@gmail.com
    python manage_admin.py remove akshat@gmail.com
    python manage_admin.py list
"""

import asyncio, sys, os
from dotenv import load_dotenv

load_dotenv()

# Use a plain sync psycopg2 connection so this script runs standalone
# without needing the full FastAPI app to be running.
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse

# ── Parse DATABASE_URL ────────────────────────────────────────────────────────
RAW_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/helpdesk_db")

# Strip asyncpg driver prefix so psycopg2 can parse it
sync_url = RAW_URL.replace("postgresql+asyncpg://", "postgresql://")
parsed   = urlparse(sync_url)

DB_CONFIG = {
    "host":     parsed.hostname,
    "port":     parsed.port or 5432,
    "dbname":   parsed.path.lstrip("/"),
    "user":     parsed.username,
    "password": parsed.password,
}

# ── ANSI colours ──────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

DIVIDER = f"{CYAN}{'─' * 60}{RESET}"


def connect():
    return psycopg2.connect(**DB_CONFIG)


def print_banner():
    print(f"\n{BOLD}{CYAN}╔══════════════════════════════════════════╗")
    print(f"║       Iris AI — Admin Manager            ║")
    print(f"╚══════════════════════════════════════════╝{RESET}\n")


# ── ADD ───────────────────────────────────────────────────────────────────────
def add_admin(email: str):
    print_banner()
    email = email.strip().lower()
    print(f"  Adding admin: {BOLD}{email}{RESET}")
    print(DIVIDER)

    conn = connect()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Insert into admins (trigger will sync users + customers automatically)
    cur.execute(
        "INSERT INTO admins (email) VALUES (%s) ON CONFLICT (email) DO NOTHING RETURNING admin_id",
        (email,)
    )
    row = cur.fetchone()

    if not row:
        print(f"\n  {YELLOW}⚠  {email} is already in the admins table.{RESET}")
    else:
        print(f"\n  {GREEN}✅ Inserted into admins table  (admin_id = {row['admin_id']}){RESET}")

    # 2. Force-update users table in case trigger missed it
    cur.execute("UPDATE users SET is_admin = TRUE WHERE email = %s RETURNING email, username", (email,))
    u = cur.fetchone()
    if u:
        print(f"  {GREEN}✅ users.is_admin → TRUE   ({u['username']}){RESET}")
    else:
        print(f"  {YELLOW}ℹ  No matching row in users table yet (user hasn't registered){RESET}")

    # 3. Sync customers table too
    cur.execute("UPDATE customers SET is_admin = TRUE WHERE primary_email = %s OR alt_email = %s RETURNING username", (email, email))
    c = cur.fetchone()
    if c:
        print(f"  {GREEN}✅ customers.is_admin → TRUE  ({c['username']}){RESET}")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\n  {BOLD}{GREEN}Done! {email} is now an admin.{RESET}\n")


# ── REMOVE ────────────────────────────────────────────────────────────────────
def remove_admin(email: str):
    print_banner()
    email = email.strip().lower()
    print(f"  Removing admin: {BOLD}{email}{RESET}")
    print(DIVIDER)

    conn = connect()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("DELETE FROM admins WHERE email = %s RETURNING admin_id", (email,))
    row = cur.fetchone()

    if not row:
        print(f"\n  {YELLOW}⚠  {email} was not found in the admins table.{RESET}")
    else:
        print(f"\n  {GREEN}✅ Removed from admins table{RESET}")

    # Force-sync users
    cur.execute("UPDATE users SET is_admin = FALSE WHERE email = %s RETURNING username", (email,))
    u = cur.fetchone()
    if u:
        print(f"  {GREEN}✅ users.is_admin → FALSE  ({u['username']}){RESET}")

    # Force-sync customers
    cur.execute("UPDATE customers SET is_admin = FALSE WHERE primary_email = %s OR alt_email = %s RETURNING username", (email, email))
    c = cur.fetchone()
    if c:
        print(f"  {GREEN}✅ customers.is_admin → FALSE  ({c['username']}){RESET}")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\n  {BOLD}{GREEN}Done! {email} is no longer an admin.{RESET}\n")


# ── LIST ──────────────────────────────────────────────────────────────────────
def list_admins():
    print_banner()
    conn = connect()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT a.email, a.assigned_at,
               u.username, u.full_name
        FROM admins a
        LEFT JOIN users u ON u.email = a.email
        ORDER BY a.assigned_at
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        print(f"  {YELLOW}No admins found.{RESET}\n")
        return

    print(f"  {BOLD}Current Admins ({len(rows)}){RESET}")
    print(DIVIDER)
    print(f"  {'#':<4} {'Email':<40} {'Username':<20} {'Full Name':<25} {'Added'}")
    print(f"  {'─'*4} {'─'*40} {'─'*20} {'─'*25} {'─'*20}")
    for i, r in enumerate(rows, 1):
        username  = r["username"]  or "—"
        full_name = r["full_name"] or "(not registered yet)"
        added     = r["assigned_at"].strftime("%Y-%m-%d %H:%M") if r["assigned_at"] else "—"
        print(f"  {i:<4} {r['email']:<40} {username:<20} {full_name:<25} {added}")
    print()


# ── INTERACTIVE MODE (no args) ─────────────────────────────────────────────────
def interactive():
    print_banner()
    print(f"  {BOLD}What do you want to do?{RESET}\n")
    print(f"  {CYAN}1{RESET}  Add an admin")
    print(f"  {CYAN}2{RESET}  Remove an admin")
    print(f"  {CYAN}3{RESET}  List all admins")
    print(f"  {CYAN}4{RESET}  Exit\n")

    choice = input("  Enter choice (1/2/3/4): ").strip()

    if choice == "1":
        email = input("\n  Enter email to add as admin: ").strip()
        if email: add_admin(email)
    elif choice == "2":
        email = input("\n  Enter email to remove from admins: ").strip()
        if email: remove_admin(email)
    elif choice == "3":
        list_admins()
    elif choice == "4":
        print("  Bye!\n")
    else:
        print(f"  {RED}Invalid choice.{RESET}\n")


# ── ENTRYPOINT ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) == 1:
        # No arguments → interactive menu
        interactive()

    elif len(sys.argv) == 3 and sys.argv[1] == "add":
        add_admin(sys.argv[2])

    elif len(sys.argv) == 3 and sys.argv[1] == "remove":
        remove_admin(sys.argv[2])

    elif len(sys.argv) == 2 and sys.argv[1] == "list":
        list_admins()

    else:
        print(f"\n  {BOLD}Usage:{RESET}")
        print("    python manage_admin.py                        ← interactive menu")
        print("    python manage_admin.py add    email@gmail.com")
        print("    python manage_admin.py remove email@gmail.com")
        print("    python manage_admin.py list\n")
