# FinPilot AI

**AI-powered personal finance assistant** — track transactions, analyze spending, and get actionable financial advice powered by Google Gemini.

---

## Features

- **Transaction management** — Add income and expenses with category and description
- **Dashboard** — Total income, total expenses, balance, and full transaction table
- **Spending chart** — Category-wise spending visualization
- **AI financial advisor** — One-click insights and savings suggestions via Google Gemini

---

## Architecture

```
User Browser
    → Streamlit UI (frontend)
    → FastAPI Backend
    → SQLite Database (finance.db)
    → Google Gemini API
```

---

## Tech stack

| Layer    | Technology   |
|----------|-------------|
| Backend  | FastAPI, SQLAlchemy, SQLite |
| Frontend | Streamlit   |
| AI       | Google Gemini API    |
| Language | Python      |

---

## Installation

1. **Clone or download** the project and go to the project root:

   ```bash
   cd finpilot-ai
   ```

2. **Create a virtual environment** (recommended):

   ```bash
   python -m venv venv
   venv\Scripts\activate    # Windows
   # source venv/bin/activate   # macOS/Linux
   ```

3. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**:

   - Copy `.env.example` to `.env`
   - Add your Gemini API key to `.env`:
     ```
     GEMINI_API_KEY=your_gemini_api_key_here
     ```
   - Get a key at [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## Run instructions

Run **both** the backend and the frontend (from the project root `finpilot-ai`).

**Backend (FastAPI):**

```bash
uvicorn backend.main:app --reload --port 8001
```

- API: http://127.0.0.1:8001  
- Docs: http://127.0.0.1:8001/docs  

(Using port 8001 avoids conflict with other apps that may use 8000.)  

**Frontend (Streamlit):**

In a **second terminal**:

```bash
streamlit run frontend/app.py
```

- Dashboard: http://localhost:8501  

---

## API endpoints

| Method | Endpoint        | Description                    |
|--------|-----------------|--------------------------------|
| POST   | `/transaction`  | Add a transaction              |
| GET    | `/transactions` | List all transactions          |
| GET    | `/summary`      | Total income, expenses, balance |
| GET    | `/ai-advice`    | Generate AI financial advice   |
| GET    | `/health`       | Health check                   |

---

## Project structure

```
finpilot-ai/
├── backend/
│   ├── main.py        # FastAPI app and routes
│   ├── database.py    # SQLAlchemy engine and session
│   ├── models.py      # Transaction ORM model
│   ├── schemas.py     # Pydantic request/response schemas
│   ├── crud.py        # Transaction and summary logic
│   └── ai_service.py  # Gemini API integration
├── frontend/
│   └── app.py        # Streamlit dashboard
├── requirements.txt
├── README.md
└── .env.example
```

---

## License

MIT.
