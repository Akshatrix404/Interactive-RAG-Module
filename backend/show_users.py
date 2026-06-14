""" 
show_users.py — Print a live table of all registered users in the terminal.

Purpose
- Helpful debugging/ops utility to inspect users, admin status,
  chat sessions, and message counts.

How it works
- Reads DATABASE_URL (asyncpg style) and converts it to a psycopg2-compatible
  connection string.
- Executes a single SQL query that aggregates chat sessions/messages.
- Optionally refreshes every 5 seconds in --watch mode.

Usage:
    python show_users.py           ← show all users
    python show_users.py --watch   ← auto-refresh every 5 seconds
    python show_users.py --admins  ← show only admins
    python show_users.py --normal  ← show only normal users
"""

import os, sys, time
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()

import psycopg2
from psycopg2.extras import RealDictCursor

# ── DB connection ─────────────────────────────────────────────────────────────
RAW_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:password@localhost:5432/helpdesk_db",
)

# Strip asyncpg driver prefix so psycopg2 can parse it.
sync_url = RAW_URL.replace("postgresql+asyncpg://", "postgresql://")
parsed = urlparse(sync_url)

DB_CONFIG = {
    "host": parsed.hostname,
    "port": parsed.port or 5432,
    "dbname": parsed.path.lstrip("/"),
    "user": parsed.username,
    "password": parsed.password,
}

# ── ANSI colours ──────────────────────────────────────────────────────────────
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

ADMIN_BADGE = f"{BOLD}{YELLOW} ADMIN {RESET}"
NORMAL_BADGE = f"{DIM} user  {RESET}"


def connect():
    """Create a psycopg2 connection using DB_CONFIG."""
    return psycopg2.connect(**DB_CONFIG)


def fetch_users(role_filter: str = "all"):
    """Fetch aggregated user stats.

    Aggregates:
    - Number of chat sessions per user
    - Number of chat messages per user

    role_filter:
    - all
    - admins
    - normal
    """
    conn = connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    where = ""
    if role_filter == "admins":
        where = "WHERE u.is_admin = TRUE"
    elif role_filter == "normal":
        where = "WHERE u.is_admin = FALSE"

    cur.execute(
        f"""
        SELECT
            ROW_NUMBER() OVER (ORDER BY u.created_at)   AS "#",
            u.email,
            u.username,
            u.full_name,
            CASE WHEN u.is_admin THEN 'Admin' ELSE 'Normal User' END AS role,
            u.is_active,
            TO_CHAR(u.created_at, 'YYYY-MM-DD HH24:MI') AS registered_at,
            COUNT(DISTINCT cs.id)                        AS sessions,
            COUNT(DISTINCT cm.id)                        AS messages
        FROM users u
        LEFT JOIN chat_sessions cs ON cs.user_id = u.id
        LEFT JOIN chat_messages cm ON cm.session_id = cs.id
        {where}
        GROUP BY u.id, u.email, u.username, u.full_name, u.is_admin, u.is_active, u.created_at
        ORDER BY u.created_at
        """
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def print_table(role_filter: str = "all"):
    """Pretty-print the fetched user stats as a table."""
    rows = fetch_users(role_filter)

    # ── Header ────────────────────────────────────────────────────────────────
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    print(
        f"\n{BOLD}{CYAN}╔══════════════════════════════════════════════════════════════════════════════════════════════╗"
    )
    print(f"║   Iris AI — User Log                                              Refreshed: {now}   ║")
    print(
        f"╚══════════════════════════════════════════════════════════════════════════════════════════════╝{RESET}"
    )

    if not rows:
        print(f"\n  {YELLOW}No users found.{RESET}\n")
        return

    # ── Column widths ─────────────────────────────────────────────────────────
    col = {
        "#": 4,
        "email": 38,
        "username": 18,
        "full_name": 22,
        "role": 13,
        "active": 7,
        "registered": 17,
        "sessions": 9,
        "messages": 9,
    }

    # ── Column headers ───────────────────────────────────────────────────────
    h = (
        f"  {BOLD}"
        f"{'#':<{col['#']}} "
        f"{'Email':<{col['email']}} "
        f"{'Username':<{col['username']}} "
        f"{'Full Name':<{col['full_name']}} "
        f"{'Role':<{col['role']}} "
        f"{'Active':<{col['active']}} "
        f"{'Registered At':<{col['registered']}} "
        f"{'Sessions':>{col['sessions']}} "
        f"{'Messages':>{col['messages']}}"
        f"{RESET}"
    )
    sep = "  " + "─" * (sum(col.values()) + len(col) - 1)

    print(f"\n{h}")
    print(f"{CYAN}{sep}{RESET}")

    # ── Rows ─────────────────────────────────────────────────────────────────
    for r in rows:
        is_admin = r["role"] == "Admin"

        role_str = (
            f"{BOLD}{YELLOW}★ Admin    {RESET}"
            if is_admin
            else f"{DIM}  Normal User{RESET}"
        )
        active_str = (
            f"{GREEN}✓{RESET}     " if r["is_active"] else f"{RED}✗{RESET}     "
        )
        num_str = f"{BOLD}{CYAN}{r['#']}{RESET}"
        email_str = f"{BOLD}{r['email']}{RESET}" if is_admin else r["email"]

        print(
            f"  {num_str:<{col['#'] + 10}} "  # +10 for ANSI codes
            f"{email_str:<{col['email'] + (10 if is_admin else 0)}} "
            f"{r['username']:<{col['username']}} "
            f"{r['full_name']:<{col['full_name']}} "
            f"{role_str:<{col['role'] + 20}} "  # +20 for ANSI codes
            f"{active_str:<{col['active'] + 10}} "
            f"{r['registered_at']:<{col['registered']}} "
            f"{r['sessions']:>{col['sessions']}} "
            f"{r['messages']:>{col['messages']}}"
        )

    # ── Footer ────────────────────────────────────────────────────────────────
    print(f"{CYAN}{sep}{RESET}")
    total = len(rows)
    admins = sum(1 for r in rows if r["role"] == "Admin")
    normal = total - admins
    print(
        f"  {BOLD}Total: {total}{RESET}   "
        f"{YELLOW}★ Admins: {admins}{RESET}   "
        f"{DIM}Normal users: {normal}{RESET}\n"
    )


# ── ENTRYPOINT ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    args = sys.argv[1:]
    watch_mode = "--watch" in args
    admins_only = "--admins" in args
    normal_only = "--normal" in args

    role_filter = "admins" if admins_only else "normal" if normal_only else "all"

    if watch_mode:
        print(f"{CYAN}  Watching for changes... (Ctrl+C to stop){RESET}")
        try:
            while True:
                # Clear terminal on each refresh.
                os.system("cls" if os.name == "nt" else "clear")
                print_table(role_filter)
                print(
                    f"  {DIM}Auto-refreshing every 5 seconds — Ctrl+C to stop{RESET}\n"
                )
                time.sleep(5)
        except KeyboardInterrupt:
            print(f"\n  {CYAN}Stopped watching.{RESET}\n")
    else:
        print_table(role_filter)

