"""Explicit empty-database bootstrap. Prints one invitation for secure manual delivery."""

import argparse, asyncio, secrets
from sqlalchemy import select, func
from app.database import AsyncSessionLocal, engine
from app.models import User
from app.security.passwords import hash_password
from app.modules.security.service import issue_invitation


async def main(email, name):
    async with AsyncSessionLocal() as db:
        if await db.scalar(select(func.count()).select_from(User)):
            raise SystemExit(
                "Existing users found. A director must invite employees through the authenticated API."
            )
        user = User(
            email=email.lower().strip(),
            full_name=name,
            role="director",
            is_active=False,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
        )
        db.add(user)
        await db.flush()
        token = await issue_invitation(db, user)
        print("Deliver this one-time invitation privately; valid for 24 hours:")
        print(token)
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()
    asyncio.run(main(args.email, args.name))
