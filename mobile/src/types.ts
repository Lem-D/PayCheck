export const ACCOUNT_KINDS = ["Chequing", "Savings", "TFSA", "RRSP", "FHSA", "Cash", "Other"] as const;
export const DEBT_KINDS = ["Credit card", "Line of credit", "Car loan", "Student loan", "Personal loan", "Owed to someone", "Other"] as const;
export const STARTER_CATEGORIES = ["Rent", "Groceries", "Phone", "Transit or gas", "Eating out", "Fun money"];

export type Frequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export const PERIOD_DAYS: Record<Frequency, number> = { weekly: 7, biweekly: 14, semimonthly: 365.25 / 24, monthly: 365.25 / 12 };

export interface Account {
  id: string;
  name: string;
  kind: string;
  balance: number;
  updated?: number;
}

export interface Debt extends Account {
  rate?: number;
  minPayment?: number;
}

export interface AccountsDoc {
  accounts: Account[];
  debts: Debt[];
}

export interface Category {
  id: string;
  name: string;
  limit: number;
}

export interface Goal {
  id: string;
  name: string;
  /** Account the goal is saved in. Empty means chequing. */
  accountId: string;
  target: number;
  saved: number;
  /** "YYYY-MM-DD", or empty for no deadline. */
  date: string;
}

export interface Move {
  accountId: string;
  name: string;
  amount: number;
}

export interface Payday {
  date: number;
  pay: number;
  spend: number;
  saved: number;
  moves: Move[];
  applied: boolean;
  /** The spending limits for the pay period this payday starts. Missing on paydays logged before step 4. */
  limits?: { id: string; name: string; limit: number }[];
  /** What each goal got this payday. Missing on paydays logged before step 4. */
  goals?: { id: string; amount: number }[];
}

export interface Plan {
  frequency: Frequency;
  categories: Category[];
  goals: Goal[];
  /** Where leftover money goes: "goal:<id>", "acct:<id>", or "" to keep it in chequing. */
  extraTo: string;
  paydays: Payday[];
  /** A payday on the schedule ("YYYY-MM-DD"), picked on the Payday tab for reminders. Empty or missing uses the last logged payday. */
  nextPayday?: string;
}

export interface Purchase {
  id: string;
  categoryId: string;
  amount: number;
  note: string;
  /** Millisecond timestamp. */
  at: number;
}

export interface SpendingDoc {
  purchases: Purchase[];
}

export const emptySpending = (): SpendingDoc => ({ purchases: [] });
export const emptyAccounts = (): AccountsDoc => ({ accounts: [], debts: [] });
export const emptyPlan = (): Plan => ({ frequency: "biweekly", categories: [], goals: [], extraTo: "", paydays: [] });
