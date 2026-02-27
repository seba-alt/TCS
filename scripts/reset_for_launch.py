#!/usr/bin/env python3
"""
One-time pre-launch data reset.
Deletes all conversations, leads, analytics, feedback, user events, and lead clicks.
Preserves: experts, admin_users, settings.

Usage:
  python scripts/reset_for_launch.py            # dry-run (shows counts, deletes nothing)
  python scripts/reset_for_launch.py --confirm   # actually deletes all transactional data
"""
import sys
import os

# Add project root to path so app.models and app.database can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Conversation, EmailLead, Feedback, NewsletterSubscriber, UserEvent, LeadClick

TABLES_TO_WIPE = [
    Feedback,
    Conversation,
    EmailLead,
    NewsletterSubscriber,
    UserEvent,
    LeadClick,
]

def main():
    confirm = "--confirm" in sys.argv
    db = SessionLocal()

    print("=" * 50)
    print("PRE-LAUNCH DATA RESET")
    print("=" * 50)
    print(f"Mode: {'LIVE DELETE' if confirm else 'DRY RUN (no changes)'}")
    print()

    try:
        total = 0
        for model in TABLES_TO_WIPE:
            count = db.query(model).count()
            total += count
            action = "→ DELETED" if confirm else "(dry run)"
            print(f"  {model.__tablename__:.<30} {count:>6} rows {action}")
            if confirm:
                db.query(model).delete()

        print()
        print(f"  Total: {total} rows {'deleted' if confirm else 'would be deleted'}")

        if confirm:
            db.commit()
            print()
            print("Database cleared for launch.")
            print("Expert data (experts, admin_users, settings) preserved.")
        else:
            print()
            print("This was a dry run. No data was deleted.")
            print("Run with --confirm to actually delete.")
    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
