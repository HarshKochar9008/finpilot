"""
FinPilot AI – FastAPI backend.
Serves transactions, summary, and AI advice. Uses SQLite and Groq.
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import get_db, init_db
from backend.schemas import (
    TransactionCreate,
    TransactionResponse,
    SummaryResponse,
    AIAdviceResponse,
    UserResponse,
    UserUpdate,
)
from backend import crud, ai_service

app = FastAPI(
    title="FinPilot AI",
    description="AI-powered personal finance API",
    version="1.0.0",
)

# Allow Streamlit (and other frontends) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    """Create database tables on startup."""
    init_db()
    if not ai_service.GEMINI_API_KEY:
        import logging
        logging.getLogger("uvicorn.error").warning(
            "GEMINI_API_KEY is not set. /ai-advice will return 500 until you add it to .env"
        )


@app.post("/transaction", response_model=TransactionResponse)
def add_transaction(
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
) -> TransactionResponse:
    """Add a new income or expense transaction."""
    return crud.create_transaction(db, transaction)


@app.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(db: Session = Depends(get_db)) -> list[TransactionResponse]:
    """Return all transactions."""
    return crud.get_transactions(db)


@app.get("/summary", response_model=SummaryResponse)
def get_summary(db: Session = Depends(get_db)) -> SummaryResponse:
    """Return total income, total expenses, and balance."""
    data = crud.get_summary(db)
    return SummaryResponse(**data)


@app.delete("/transaction/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a transaction by ID."""
    deleted = crud.delete_transaction(db, transaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return None


@app.get("/ai-advice", response_model=AIAdviceResponse)
def generate_ai_advice(db: Session = Depends(get_db)) -> AIAdviceResponse:
    """
    Build a spending summary from transactions, send to Groq LLM,
    and return AI-generated financial advice.
    """
    summary_data = crud.get_summary(db)
    transactions = crud.get_transactions(db)

    # Build a text summary for the AI (e.g. last 100 transactions)
    lines = [
        f"Total income: ₹{summary_data['total_income']:.2f}",
        f"Total expenses: ₹{summary_data['total_expenses']:.2f}",
        f"Balance: ₹{summary_data['balance']:.2f}",
        "",
        "Recent transactions (category, amount, type, description):",
    ]
    for t in transactions[:100]:
        lines.append(f"  - {t.category}: ₹{t.amount} ({t.type}) - {t.description or '-'}")

    transaction_summary = "\n".join(lines)

    try:
        advice = ai_service.get_ai_advice(transaction_summary)
        return AIAdviceResponse(advice=advice)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {type(e).__name__}: {str(e)}",
        )


@app.get("/health")
def health() -> dict[str, str]:
    """Health check for deployment/monitoring."""
    return {"status": "ok"}


@app.get("/user", response_model=UserResponse)
def get_user(db: Session = Depends(get_db)) -> UserResponse:
    """
    Return the current dashboard user.

    If no user exists yet, a default one is created.
    """
    user = crud.ensure_default_user(db)
    return UserResponse.model_validate(user)


@app.put("/user", response_model=UserResponse)
def update_user(payload: UserUpdate, db: Session = Depends(get_db)) -> UserResponse:
    """Create or update the current dashboard user."""
    user = crud.upsert_user(db, payload)
    return UserResponse.model_validate(user)
