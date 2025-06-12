import { localStorageManager } from "./localStorage";
import type { InsertTransaction, InsertBudget, InsertSavingsGoal } from "@shared/schema";

// Sample transactions for demonstration
const sampleTransactions: InsertTransaction[] = [
  {
    amount: "50000",
    description: "Grocery shopping",
    category: "food",
    type: "expense",
    date: new Date("2025-06-10"),
    time: "10:30",
  },
  {
    amount: "300000",
    description: "Monthly salary",
    category: "income",
    type: "income",
    date: new Date("2025-06-01"),
    time: "09:00",
  },
  {
    amount: "25000",
    description: "Movie tickets",
    category: "entertainment",
    type: "expense",
    date: new Date("2025-06-08"),
    time: "19:00",
  },
  {
    amount: "15000",
    description: "Bus fare",
    category: "transportation",
    type: "expense",
    date: new Date("2025-06-09"),
    time: "08:00",
  },
  {
    amount: "30000",
    description: "Emergency fund deposit",
    category: "savings",
    type: "savings_deposit",
    date: new Date("2025-06-05"),
    time: "14:00",
    savingsGoalId: 1,
  },
];

// Sample budgets
const sampleBudgets: InsertBudget[] = [
  {
    category: "food",
    amount: "100000",
    period: "monthly",
    startDate: new Date("2025-06-01"),
    endDate: new Date("2025-06-30"),
    icon: "🍽️",
    description: "Monthly food and groceries budget",
  },
  {
    category: "transportation",
    amount: "50000",
    period: "monthly",
    startDate: new Date("2025-06-01"),
    endDate: new Date("2025-06-30"),
    icon: "🚗",
    description: "Transportation and fuel costs",
  },
  {
    category: "entertainment",
    amount: "40000",
    period: "monthly",
    startDate: new Date("2025-06-01"),
    endDate: new Date("2025-06-30"),
    icon: "🎬",
    description: "Movies, games, and entertainment",
  },
];

// Sample savings goals
const sampleSavingsGoals: InsertSavingsGoal[] = [
  {
    name: "Emergency Fund",
    targetAmount: "500000",
    startingSavings: "100000",
    startDate: new Date("2025-06-01"),
    deadline: new Date("2025-12-31"),
    icon: "🚨",
    color: "#EF4444",
  },
  {
    name: "Vacation Fund",
    targetAmount: "200000",
    startingSavings: "0",
    startDate: new Date("2025-06-01"),
    deadline: new Date("2025-08-15"),
    icon: "✈️",
    color: "#3B82F6",
  },
  {
    name: "New Phone",
    targetAmount: "150000",
    startingSavings: "50000",
    startDate: new Date("2025-06-01"),
    deadline: new Date("2025-07-01"),
    icon: "📱",
    color: "#10B981",
  },
];

export function initializeSampleData() {
  // Check if data already exists
  const existingTransactions = localStorageManager.getTransactions();
  const existingBudgets = localStorageManager.getBudgets();
  const existingGoals = localStorageManager.getSavingsGoals();

  // Only add sample data if local storage is empty
  if (existingTransactions.length === 0 && existingBudgets.length === 0 && existingGoals.length === 0) {
    console.log("Initializing sample data for local storage...");

    // Add sample savings goals first (needed for transaction references)
    sampleSavingsGoals.forEach(goal => {
      localStorageManager.createSavingsGoal(goal);
    });

    // Add sample budgets
    sampleBudgets.forEach(budget => {
      localStorageManager.createBudget(budget);
    });

    // Add sample transactions
    sampleTransactions.forEach(transaction => {
      localStorageManager.createTransaction(transaction);
    });

    console.log("Sample data initialized successfully!");
  }
}

export function clearAllLocalData() {
  localStorageManager.clearAllData();
  console.log("All local data cleared!");
}

export function exportLocalData() {
  return localStorageManager.exportData();
}

export function importLocalData(jsonData: string) {
  localStorageManager.importData(jsonData);
  console.log("Data imported successfully!");
}