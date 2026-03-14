"""
FinPilot AI – Streamlit dashboard.
Calls FastAPI backend for data and AI advice.
"""

import streamlit as st
import requests
import pandas as pd
import os

# Backend API base URL (default: port 8001 to avoid conflict with other apps on 8000)
API_BASE = os.getenv("FINPILOT_API_URL", "http://127.0.0.1:8001")


def fetch_transactions() -> list:
    """Fetch all transactions from the API."""
    try:
        r = requests.get(f"{API_BASE}/transactions", timeout=5)
        r.raise_for_status()
        return r.json()
    except requests.ConnectionError:
        st.error(
            "Could not connect to the API. Start the backend: `uvicorn backend.main:app --reload --port 8001`"
        )
        return []
    except requests.RequestException as e:
        st.error(f"Could not load transactions: {e}")
        return []


def fetch_summary() -> dict | None:
    """Fetch income, expenses, and balance from the API."""
    try:
        r = requests.get(f"{API_BASE}/summary", timeout=5)
        r.raise_for_status()
        return r.json()
    except requests.ConnectionError:
        st.error(
            "Could not connect to the API. Start the backend: `uvicorn backend.main:app --reload --port 8001`"
        )
        return None
    except requests.RequestException as e:
        st.error(f"Could not load summary: {e}")
        return None


def add_transaction(category: str, amount: float, type_: str, description: str) -> bool:
    """POST a new transaction. Returns True on success."""
    try:
        r = requests.post(
            f"{API_BASE}/transaction",
            json={
                "category": category,
                "amount": amount,
                "type": type_,
                "description": description or "",
            },
            timeout=5,
        )
        r.raise_for_status()
        return True
    except requests.RequestException as e:
        st.error(f"Failed to add transaction: {e}")
        return False


def delete_transaction(transaction_id: int) -> bool:
    """Delete a transaction by ID via the API."""
    try:
        r = requests.delete(
            f"{API_BASE}/transaction/{transaction_id}",
            timeout=5,
        )
        if r.status_code == 204:
            return True
        if r.status_code == 404:
            # Treat "not found" as a successful no-op: the transaction
            # is already gone (e.g. deleted in a previous run).
            st.info("That transaction was already deleted.")
            return True
        st.error(f"Failed to delete transaction (status {r.status_code}).")
        return False
    except requests.ConnectionError:
        st.error(
            "Could not connect to the API. Start the backend: `uvicorn backend.main:app --reload --port 8001`"
        )
        return False
    except requests.RequestException as e:
        st.error(f"Failed to delete transaction: {e}")
        return False


def fetch_ai_advice() -> str | None:
    """GET AI financial advice from the API."""
    try:
        r = requests.get(f"{API_BASE}/ai-advice", timeout=30)
        r.raise_for_status()
        return r.json().get("advice", "")
    except requests.ConnectionError as e:
        st.error(
            "Could not connect to the API. Make sure the backend is running from the project root: "
            "`uvicorn backend.main:app --reload --port 8001`"
        )
        return None
    except requests.RequestException as e:
        msg = str(e)
        if hasattr(e, "response") and e.response is not None:
            try:
                detail = e.response.json().get("detail", e.response.text or msg)
                msg = detail if isinstance(detail, str) else str(detail)
            except Exception:
                msg = e.response.text or msg
        st.error(f"Could not get AI advice: {msg}")
        return None


# --- Page config and title ---
st.set_page_config(
    page_title="FinPilot AI",
    page_icon="📊",
    layout="wide",
)
st.title("📊 FinPilot AI – Personal Finance Assistant")
st.markdown(
    "Track transactions, analyze spending, and get **AI-powered insights** into your money."
)

# Use tabs to create a more "dashboard-like" layout
overview_tab, analytics_tab, ai_tab = st.tabs(
    ["🏠 Overview", "📈 Analytics & Transactions", "🤖 AI Advisor"]
)

with overview_tab:
    # --- Summary cards ---
    summary = fetch_summary()
    if summary:
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric(
                "Total Income",
                f"₹{summary['total_income']:,.2f}",
                help="All income transactions recorded so far.",
            )
        with col2:
            st.metric(
                "Total Expenses",
                f"₹{summary['total_expenses']:,.2f}",
                help="All expense transactions recorded so far.",
            )
        with col3:
            balance = summary["balance"]
            st.metric(
                "Balance",
                f"₹{balance:,.2f}",
                help="Income minus expenses.",
            )

    st.divider()

    # --- Add Transaction Form ---
    st.subheader("Quick Add Transaction")
    with st.form("add_transaction_form"):
        col_a, col_b = st.columns(2)
        with col_a:
            category = st.text_input(
                "Category",
                placeholder="e.g. Food, Salary, Rent",
            )
            amount = st.number_input(
                "Amount (₹)",
                min_value=0.01,
                value=100.0,
                step=10.0,
            )
        with col_b:
            type_ = st.selectbox("Type", ["income", "expense"])
            description = st.text_input(
                "Description",
                placeholder="Optional notes",
            )
        submitted = st.form_submit_button("Add Transaction")
        if submitted:
            if not (category and category.strip()):
                st.warning("Please enter a category.")
            else:
                if add_transaction(
                    category.strip(),
                    amount,
                    type_,
                    description or "",
                ):
                    st.success("Transaction added.")
                    st.rerun()

with analytics_tab:
    st.subheader("Transactions & Analytics")
    transactions = fetch_transactions()

    # --- Transaction Table with delete control ---
    st.markdown("#### Transactions")
    if transactions:
        df = pd.DataFrame(transactions)
        if "created_at" in df.columns:
            df["created_at"] = pd.to_datetime(df["created_at"])
            df["created_at_display"] = df["created_at"].dt.strftime("%Y-%m-%d %H:%M")

        display_cols = [
            c
            for c in [
                "id",
                "category",
                "amount",
                "type",
                "description",
                "created_at_display",
            ]
            if c in df.columns
        ]
        st.dataframe(
            df[display_cols],
            use_container_width=True,
            hide_index=True,
        )

        # Delete transaction control
        with st.expander("Delete a transaction"):
            options = {
                f"#{row['id']} – {row['category']} ₹{row['amount']} ({row['type']})": int(
                    row["id"]
                )
                for _, row in df.iterrows()
            }
            if options:
                selected_label = st.selectbox(
                    "Select a transaction to delete",
                    list(options.keys()),
                )
                if st.button("Delete selected transaction", type="secondary"):
                    tx_id = options[selected_label]
                    if delete_transaction(tx_id):
                        st.success(f"Transaction #{tx_id} deleted.")
                        st.rerun()
            else:
                st.info("No deletable transactions available.")
    else:
        st.info("No transactions yet. Add one in the Overview tab.")

    st.divider()

    # --- Income vs Expenses Over Time (line chart) ---
    st.subheader("Income vs Expenses Over Time")
    if transactions:
        df_time = pd.DataFrame(transactions)
        if "created_at" in df_time.columns:
            df_time["created_at"] = pd.to_datetime(df_time["created_at"])
            df_time["date"] = df_time["created_at"].dt.date
        else:
            df_time["date"] = range(1, len(df_time) + 1)

        line_data = (
            df_time.groupby(["date", "type"])["amount"]
            .sum()
            .reset_index()
            .sort_values("date")
        )

        if not line_data.empty:
            st.line_chart(
                line_data,
                x="date",
                y="amount",
                color="type",
                x_label="Date",
                y_label="Amount",
            )
        else:
            st.info("No data available for line chart yet.")
    else:
        st.info("Add some transactions to see the income/expense trend.")

    st.divider()

    # --- Spending Chart (by category) ---
    st.subheader("Spending by Category")
    if transactions:
        df_exp = pd.DataFrame(transactions)
        expenses = df_exp[df_exp["type"] == "expense"]
        if not expenses.empty:
            by_category = (
                expenses.groupby("category")["amount"]
                .sum()
                .sort_values(ascending=False)
                .reset_index()
            )
            by_category.columns = ["category", "amount"]
            st.line_chart(
                by_category,
                x="category",
                y="amount",
                x_label="Category",
                y_label="Amount",
            )
        else:
            st.info("No expenses to show yet.")
    else:
        st.info("Add some expenses to see the chart.")

with ai_tab:
    st.subheader("AI Financial Advisor")
    st.markdown(
        "Let the AI analyze your transactions and highlight **insights, savings tips, and risks**."
    )
    if st.button("Generate AI Advice", type="primary"):
        with st.spinner("Analyzing your finances..."):
            advice = fetch_ai_advice()
        if advice:
            st.markdown("#### 💡 Your personalized advice")
            st.markdown(advice)
