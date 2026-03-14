import React, { useEffect, useMemo, useState } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { QRCodeSVG } from 'qrcode.react'
import {
  addTransaction,
  deleteTransaction,
  fetchAiAdvice,
  fetchSummary,
  fetchTransactions,
  fetchUser,
  updateUser,
} from './api'
import type { Summary, Transaction, User } from './api'

type TabKey = 'overview' | 'analytics' | 'ai'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)

const formatPercent = (value: number) =>
  `${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [user, setUser] = useState<User | null>(null)
  const [isEditingUser, setIsEditingUser] = useState(false)
  const [userNameInput, setUserNameInput] = useState('')
  const [userEmailInput, setUserEmailInput] = useState('')
  const [userRoleInput, setUserRoleInput] = useState('')
  const [userSaving, setUserSaving] = useState(false)

  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [description, setDescription] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [aiAdvice, setAiAdvice] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [transactionFilterType, setTransactionFilterType] = useState<
    'all' | 'income' | 'expense'
  >('all')
  const [transactionSearch, setTransactionSearch] = useState('')

  const [isQrOpen, setIsQrOpen] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [isQrGeneratorOpen, setIsQrGeneratorOpen] = useState(false)

  const qrInvoiceValue = useMemo(() => {
    const trimmedCategory = category.trim()
    const trimmedDescription = description.trim()

    if (!trimmedCategory || !amount || amount <= 0) {
      return ''
    }

    return JSON.stringify({
      category: trimmedCategory,
      amount: Number(amount),
      type,
      description: trimmedDescription || undefined,
    })
  }, [category, amount, type, description])

  const handleQrResult = (text: string | null) => {
    if (!text) return

    setQrError(null)

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }

    if (parsed && typeof parsed === 'object') {
      const obj = parsed as {
        category?: unknown
        amount?: unknown
        type?: unknown
        description?: unknown
      }

      if (typeof obj.category === 'string') {
        setCategory(obj.category)
      }
      if (typeof obj.amount === 'number') {
        setAmount(obj.amount)
      } else if (typeof obj.amount === 'string' && obj.amount.trim() !== '') {
        const num = Number(obj.amount)
        if (!Number.isNaN(num) && num > 0) {
          setAmount(num)
        }
      }
      if (obj.type === 'income' || obj.type === 'expense') {
        setType(obj.type)
      }
      if (typeof obj.description === 'string') {
        setDescription(obj.description)
      }
    } else {
      setDescription((prev) => (prev ? `${prev} ${text}` : text))
    }

    setIsQrOpen(false)
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [summaryData, txs, userData] = await Promise.all([
          fetchSummary(),
          fetchTransactions(),
          fetchUser(),
        ])
        setSummary(summaryData)
        setTransactions(txs)
        setUser(userData)
        setUserNameInput(userData.name)
        setUserEmailInput(userData.email)
        setUserRoleInput(userData.role)
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Failed to load data. Please try again.',
        )
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const incomeCount = useMemo(
    () => transactions.filter((t) => t.type === 'income').length,
    [transactions],
  )
  const expenseCount = useMemo(
    () => transactions.filter((t) => t.type === 'expense').length,
    [transactions],
  )
  const totalTransactions = transactions.length

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (transactionFilterType !== 'all' && t.type !== transactionFilterType) {
        return false
      }
      if (!transactionSearch.trim()) return true
      const q = transactionSearch.trim().toLowerCase()
      return (
        t.category.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [transactions, transactionFilterType, transactionSearch])

  const revenueToExpensePercent = useMemo(() => {
    if (!summary || summary.total_expenses === 0) return 0
    return (summary.total_income / summary.total_expenses) * 100
  }, [summary])

  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    }
    return Array.from(map.entries())
      .map(([categoryName, total]) => ({ category: categoryName, total }))
      .sort((a, b) => b.total - a.total)
  }, [transactions])

  const totalExpenseForChart = useMemo(
    () => spendByCategory.reduce((sum, item) => sum + item.total, 0),
    [spendByCategory],
  )

  const recentTransactions = useMemo(
    () => transactions.slice(0, 5),
    [transactions],
  )

  const userInitials = useMemo(() => {
    if (!user?.name) return 'FP'
    const parts = user.name.trim().split(/\s+/)
    const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '')
    const joined = letters.join('')
    return joined || 'FP'
  }, [user])

  const handleUserSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userNameInput.trim() || !userEmailInput.trim() || !userRoleInput.trim()) {
      return
    }
    try {
      setUserSaving(true)
      setError(null)
      const updated = await updateUser({
        name: userNameInput.trim(),
        email: userEmailInput.trim(),
        role: userRoleInput.trim(),
      })
      setUser(updated)
      setIsEditingUser(false)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to update user. Please try again.',
      )
    } finally {
      setUserSaving(false)
    }
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category.trim() || !amount || amount <= 0) return
    try {
      setAdding(true)
      setError(null)
      const created = await addTransaction({
        category: category.trim(),
        amount: Number(amount),
        type,
        description: description.trim(),
      })
      setTransactions((prev) => [created, ...prev])
      const updatedSummary = await fetchSummary()
      setSummary(updatedSummary)
      setCategory('')
      setAmount('')
      setDescription('')
      setType('expense')
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to add transaction. Please try again.',
      )
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id)
      setError(null)
      await deleteTransaction(id)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      const updatedSummary = await fetchSummary()
      setSummary(updatedSummary)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to delete transaction. Please try again.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const handleGenerateAdvice = async () => {
    try {
      setAiLoading(true)
      setAiError(null)
      const advice = await fetchAiAdvice()
      setAiAdvice(advice)
    } catch (e) {
      setAiError(
        e instanceof Error
          ? e.message
          : 'Failed to fetch AI advice. Please try again.',
      )
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <h1>FinPilot AI</h1>
            <p className="topbar-subtitle">
              Personal finance dashboard with AI insights
            </p>
          </div>
          <div className="topbar-right">
            <select className="topbar-select" defaultValue="this_month">
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="three_months">Last 3 Months</option>
              <option value="year">This Year</option>
            </select>
            <div className="topbar-user">
              <div className="avatar-circle">{userInitials}</div>
              <div>
                <div className="user-name">
                  {user ? user.name : 'Loading user…'}
                </div>
                <div className="user-role">
                  {user ? `${user.role} · ${user.email}` : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setIsEditingUser((prev) => !prev)}
            >
              {isEditingUser ? 'Cancel' : 'Edit profile'}
            </button>
          </div>
        </header>

        <nav className="tab-nav">
          <button
            type="button"
            className={`tab-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`tab-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button
            type="button"
            className={`tab-nav-item ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Advisor
          </button>
        </nav>

        {isEditingUser && (
          <section className="panel" style={{ margin: '0 1.5rem 1rem' }}>
            <div className="panel-header">
              <h2>Edit profile</h2>
              <p>Update the name, email, and role shown in the header</p>
            </div>
            <form className="form-grid" onSubmit={handleUserSave}>
              <div className="form-field">
                <label htmlFor="user-name">Name</label>
                <input
                  id="user-name"
                  type="text"
                  value={userNameInput}
                  onChange={(e) => setUserNameInput(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="user-email">Email</label>
                <input
                  id="user-email"
                  type="email"
                  value={userEmailInput}
                  onChange={(e) => setUserEmailInput(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="user-role">Role</label>
                <input
                  id="user-role"
                  type="text"
                  value={userRoleInput}
                  onChange={(e) => setUserRoleInput(e.target.value)}
                  required
                />
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={userSaving}
                >
                  {userSaving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </form>
          </section>
        )}

        {error && <div className="banner-error">{error}</div>}

        {loading ? (
          <div className="center-loading">Loading dashboard…</div>
        ) : (
          <>
            <section className="card-row">
              <div className="stat-card">
                <div className="stat-label">Transactions</div>
                <div className="stat-value">{totalTransactions}</div>
                <div className="stat-meta">
                  {incomeCount} income · {expenseCount} expenses
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Income</div>
                <div className="stat-value">
                  {summary ? formatCurrency(summary.total_income) : '₹0.00'}
                </div>
                <div className="stat-meta">All income recorded so far</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Expenses</div>
                <div className="stat-value">
                  {summary ? formatCurrency(summary.total_expenses) : '₹0.00'}
                </div>
                <div className="stat-meta">All expenses recorded so far</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Current Balance</div>
                <div className="stat-value">
                  {summary ? formatCurrency(summary.balance) : '₹0.00'}
                </div>
                <div className="stat-meta">Income minus expenses</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Income vs Expense</div>
                <div className="stat-value">
                  {formatPercent(revenueToExpensePercent || 0)}
                </div>
                <div className="stat-meta">Income as % of expenses</div>
              </div>
            </section>

            <section className="content-grid">
              {activeTab === 'overview' && (
                <>
                  <div className="panel large">
                    <div className="panel-header">
                      <h2>Quick Add Transaction</h2>
                      <p>Add an income or expense in seconds</p>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
                            setIsQrGeneratorOpen((prev) => !prev)
                          }}
                        >
                          {isQrGeneratorOpen ? 'Hide QR for invoice' : 'Generate QR for invoice'}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
                            setQrError(null)
                            setIsQrOpen((prev) => !prev)
                          }}
                        >
                          {isQrOpen ? 'Close QR scanner' : 'Scan from QR'}
                        </button>
                      </div>
                    </div>
                    <form
                      className="form-grid"
                      onSubmit={handleAddTransaction}
                    >
                      <div className="form-field">
                        <label htmlFor="category">Category</label>
                        <input
                          id="category"
                          type="text"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          placeholder="e.g. Food, Salary, Rent"
                          required
                        />
                      </div>
                      <div className="form-field">
                        <label htmlFor="amount">Amount (₹)</label>
                        <input
                          id="amount"
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={amount}
                          onChange={(e) =>
                            setAmount(e.target.value ? Number(e.target.value) : '')
                          }
                          required
                        />
                      </div>
                      <div className="form-field">
                        <label htmlFor="type">Type</label>
                        <select
                          id="type"
                          value={type}
                          onChange={(e) =>
                            setType(e.target.value as 'income' | 'expense')
                          }
                        >
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label htmlFor="description">Description</label>
                        <input
                          id="description"
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Optional notes"
                        />
                      </div>
                      <div className="form-actions">
                        <button
                          type="submit"
                          className="primary-btn"
                          disabled={adding}
                        >
                          {adding ? 'Adding…' : 'Add transaction'}
                        </button>
                      </div>
                    </form>
                    {isQrGeneratorOpen && (
                      <div className="qr-panel">
                        <div className="panel-header" style={{ marginTop: '1rem' }}>
                          <h3>QR invoice for this transaction</h3>
                          <p>
                            This QR includes the category, amount, type (income/expense), and
                            description. Scan it using the &quot;Scan from QR&quot; button (on
                            this or another device) to auto-fill the transaction form.
                          </p>
                        </div>
                        {!qrInvoiceValue ? (
                          <div className="empty-state">
                            Enter a category and a positive amount to generate the QR.
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.75rem',
                              marginTop: '0.75rem',
                            }}
                          >
                            <QRCodeSVG value={qrInvoiceValue} size={196} />
                            <div
                              style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-muted, #6b7280)',
                                textAlign: 'center',
                              }}
                            >
                              Scan this QR in FinPilot&apos;s &quot;Scan from QR&quot; tool to
                              quickly add the same invoice.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {isQrOpen && (
                      <div className="qr-panel">
                        <div className="panel-header" style={{ marginTop: '1rem' }}>
                          <h3>Scan transaction QR</h3>
                          <p>
                            Point your camera at a QR code that contains transaction
                            details. The form above will be auto-filled.
                          </p>
                        </div>
                        {qrError && (
                          <div className="banner-error inline" style={{ marginBottom: '0.5rem' }}>
                            {qrError}
                          </div>
                        )}
                        <div className="qr-scanner-wrapper">
                          <Scanner
                            constraints={{ facingMode: 'environment' }}
                            onScan={(result) => {
                              const [text] =
                                Array.isArray(result) && result.length > 0
                                  ? [result[0]?.rawValue ?? null]
                                  : [null]
                              handleQrResult(text)
                            }}
                            onError={(error) => {
                              if (error instanceof Error) {
                                setQrError(error.message)
                              } else {
                                setQrError('Unable to access camera')
                              }
                            }}
                            styles={{ container: { width: '100%' } }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-header">
                      <h2>Spending by Category</h2>
                      <p>See where your money is going</p>
                    </div>
                    {spendByCategory.length === 0 ? (
                      <div className="empty-state">
                        Add some expense transactions to see this chart.
                      </div>
                    ) : (
                      <ul className="bar-list">
                        {spendByCategory.map((item) => {
                          const percent =
                            totalExpenseForChart > 0
                              ? (item.total / totalExpenseForChart) * 100
                              : 0
                          return (
                            <li key={item.category} className="bar-list-item">
                              <div className="bar-list-label">
                                <span>{item.category}</span>
                                <span>{formatCurrency(item.total)}</span>
                              </div>
                              <div className="bar-track">
                                <div
                                  className="bar-fill"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="panel full-width">
                    <div className="panel-header">
                      <h2>Recent activity</h2>
                      <p>A quick glance at your latest transactions</p>
                    </div>
                    {recentTransactions.length === 0 ? (
                      <div className="empty-state">
                        Once you add transactions, your 5 most recent items will show
                        up here.
                      </div>
                    ) : (
                      <ul className="activity-list">
                        {recentTransactions.map((t) => (
                          <li key={t.id} className="activity-item">
                            <div className="activity-main">
                              <span className="activity-category">{t.category}</span>
                              <span
                                className={`pill pill-${
                                  t.type === 'income' ? 'income' : 'expense'
                                }`}
                              >
                                {t.type}
                              </span>
                            </div>
                            <div className="activity-meta">
                              <span className="activity-amount">
                                {formatCurrency(t.amount)}
                              </span>
                              <span className="activity-date">
                                {t.created_at
                                  ? new Date(t.created_at).toLocaleString('en-IN', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })
                                  : '—'}
                              </span>
                              <span className="activity-description">
                                {t.description || 'No notes'}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'analytics' && (
                <div className="panel full-width">
                  <div className="panel-header">
                    <h2>Transactions & Analytics</h2>
                    <p>Detailed view of all your activity</p>
                  </div>
                  {transactions.length === 0 ? (
                    <div className="empty-state">
                      No transactions yet. Add one in the Overview tab.
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <div className="table-filters">
                        <select
                          value={transactionFilterType}
                          onChange={(e) =>
                            setTransactionFilterType(
                              e.target.value as 'all' | 'income' | 'expense',
                            )
                          }
                        >
                          <option value="all">All types</option>
                          <option value="income">Income only</option>
                          <option value="expense">Expenses only</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Search by category or note"
                          value={transactionSearch}
                          onChange={(e) => setTransactionSearch(e.target.value)}
                        />
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Date</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTransactions.map((t) => (
                            <tr key={t.id}>
                              <td>#{t.id}</td>
                              <td>{t.category}</td>
                              <td>{formatCurrency(t.amount)}</td>
                              <td>
                                <span
                                  className={`pill pill-${
                                    t.type === 'income' ? 'income' : 'expense'
                                  }`}
                                >
                                  {t.type}
                                </span>
                              </td>
                              <td>{t.description || '—'}</td>
                              <td>
                                {t.created_at
                                  ? new Date(t.created_at).toLocaleString(
                                      'en-IN',
                                      {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                      },
                                    )
                                  : '—'}
                              </td>
                              <td className="cell-actions">
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  onClick={() => handleDelete(t.id)}
                                  disabled={deletingId === t.id}
                                >
                                  {deletingId === t.id ? 'Deleting…' : 'Delete'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'ai' && (
                <div className="panel full-width">
                  <div className="panel-header">
                    <h2>AI Financial Advisor</h2>
                    <p>
                      Let the AI analyze your transactions and highlight insights
                      and savings tips.
                    </p>
                  </div>
                  {summary && (
                    <div className="ai-summary-chips">
                      <div className="chip">
                        <span>Income</span>
                        <strong>{formatCurrency(summary.total_income)}</strong>
                      </div>
                      <div className="chip">
                        <span>Expenses</span>
                        <strong>{formatCurrency(summary.total_expenses)}</strong>
                      </div>
                      <div className="chip">
                        <span>Balance</span>
                        <strong>{formatCurrency(summary.balance)}</strong>
                      </div>
                    </div>
                  )}
                  <div className="ai-section">
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={handleGenerateAdvice}
                      disabled={aiLoading}
                    >
                      {aiLoading ? 'Analyzing…' : 'Generate AI advice'}
                    </button>
                    {aiError && (
                      <div className="banner-error inline">{aiError}</div>
                    )}
                    {aiAdvice && (
                      <div className="ai-card">
                        <div className="ai-label">Your personalized advice</div>
                        <div className="ai-content">
                          {aiAdvice.split('\n').map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App

