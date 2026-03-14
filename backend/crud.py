"""
CRUD operations for transactions. Used by FastAPI routes.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import Transaction, User
from backend.schemas import TransactionCreate, UserUpdate


def create_transaction(db: Session, transaction: TransactionCreate) -> Transaction:
    """Insert a new transaction and return it."""
    db_transaction = Transaction(
        category=transaction.category,
        amount=transaction.amount,
        type=transaction.type,
        description=transaction.description or "",
    )
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


def get_transactions(db: Session) -> list[Transaction]:
    """Return all transactions, newest first."""
    return db.query(Transaction).order_by(Transaction.created_at.desc()).all()


def delete_transaction(db: Session, transaction_id: int) -> bool:
    """
    Delete a transaction by ID.
    Returns True if a row was deleted, False if not found.
    """
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if tx is None:
        return False
    db.delete(tx)
    db.commit()
    return True


def get_summary(db: Session) -> dict[str, float]:
    """
    Return total_income, total_expenses, and balance.
    Income and expenses are summed by type.
    """
    income = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.type == "income")
        .scalar()
        or 0
    )
    expenses = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.type == "expense")
        .scalar()
        or 0
    )
    return {
        "total_income": float(income),
        "total_expenses": float(expenses),
        "balance": float(income - expenses),
    }


def get_current_user(db: Session) -> User | None:
    """Return the single current user (first row) or None."""
    return db.query(User).order_by(User.id.asc()).first()


def upsert_user(db: Session, payload: UserUpdate) -> User:
    """
    Create or update the single dashboard user.

    If a user already exists, update it; otherwise create a new one.
    """
    user = get_current_user(db)
    if user is None:
        user = User(
            name=payload.name,
            email=payload.email,
            role=payload.role,
        )
        db.add(user)
    else:
        user.name = payload.name
        user.email = payload.email
        user.role = payload.role

    db.commit()
    db.refresh(user)
    return user


def ensure_default_user(db: Session) -> User:
    """
    Ensure there is at least one user row.

    Used on first access so the frontend always has something to display.
    """
    user = get_current_user(db)
    if user is not None:
        return user

    user = User(
        name="Samantha Joseph",
        email="samantha@example.com",
        role="Investor",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
