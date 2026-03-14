export const API_BASE =
  import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8001'

export interface Summary {
  total_income: number
  total_expenses: number
  balance: number
}

export interface Transaction {
  id: number
  category: string
  amount: number
  type: 'income' | 'expense'
  description: string
  created_at?: string
}

export interface NewTransactionInput {
  category: string
  amount: number
  type: 'income' | 'expense'
  description?: string
}

export interface User {
  id: number
  name: string
  email: string
  role: string
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (body && typeof body.detail === 'string') {
        message = body.detail
      }
    } catch {
      // ignore JSON parse errors; fall back to default message
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function fetchSummary(): Promise<Summary> {
  return request<Summary>('/summary')
}

export async function fetchTransactions(): Promise<Transaction[]> {
  return request<Transaction[]>('/transactions')
}

export async function addTransaction(
  data: NewTransactionInput,
): Promise<Transaction> {
  return request<Transaction>('/transaction', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteTransaction(
  id: number,
): Promise<void> {
  await request<void>(`/transaction/${id}`, {
    method: 'DELETE',
  })
}

export async function fetchAiAdvice(): Promise<string> {
  const result = await request<{ advice: string }>('/ai-advice')
  return result.advice
}

export async function fetchUser(): Promise<User> {
  return request<User>('/user')
}

export async function updateUser(data: Omit<User, 'id'>): Promise<User> {
  return request<User>('/user', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

