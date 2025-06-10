import { useState, useMemo } from "react";
import { useTransactions } from "./use-transactions";
import { useBudgets } from "./use-budgets";

// Base predefined categories
const baseBudgetCategories = [
  { value: "food", label: "Food & Dining", icon: "🍽️" },
  { value: "transportation", label: "Transportation", icon: "🚗" },
  { value: "shopping", label: "Shopping", icon: "🛍️" },
  { value: "entertainment", label: "Entertainment", icon: "🎬" },
  { value: "bills", label: "Bills & Utilities", icon: "📄" },
  { value: "healthcare", label: "Healthcare", icon: "🏥" },
  { value: "education", label: "Education", icon: "📚" },
  { value: "savings", label: "Savings", icon: "💳" },
  { value: "loan", label: "Loan", icon: "🏛️" },
  { value: "other", label: "Other", icon: "📝" },
];

const baseTransactionCategories = [
  { value: "bills", label: "Bills & Utilities" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "food", label: "Food & Dining" },
  { value: "healthcare", label: "Healthcare" },
  { value: "income", label: "Income" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
  { value: "savings", label: "Savings Account" },
  { value: "shopping", label: "Shopping" },
  { value: "transportation", label: "Transportation" },
];

export function useCategories() {
  const { data: transactions = [] } = useTransactions();
  const { data: budgets = [] } = useBudgets();
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // Get all unique categories from existing transactions and budgets
  const existingCategories = useMemo(() => {
    const uniqueCategories = new Set<string>();
    
    // Add categories from transactions
    transactions.forEach(t => uniqueCategories.add(t.category));
    
    // Add categories from budgets
    budgets.forEach(b => uniqueCategories.add(b.category));
    
    return Array.from(uniqueCategories);
  }, [transactions, budgets]);

  // Combined categories for budgets (with icons)
  const budgetCategories = useMemo(() => {
    return [
      ...baseBudgetCategories,
      // Add existing categories not in base list
      ...existingCategories
        .filter(cat => !baseBudgetCategories.some(base => base.value === cat))
        .map(cat => ({
          value: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' '),
          icon: "📝"
        })),
      // Add custom categories
      ...customCategories
        .filter(cat => 
          !baseBudgetCategories.some(base => base.value === cat) && 
          !existingCategories.includes(cat)
        )
        .map(cat => ({
          value: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' '),
          icon: "📝"
        }))
    ].sort((a, b) => a.label.localeCompare(b.label));
  }, [existingCategories, customCategories]);

  // Combined categories for transactions (without icons)
  const transactionCategories = useMemo(() => {
    return [
      ...baseTransactionCategories,
      // Add existing categories not in base list
      ...existingCategories
        .filter(cat => !baseTransactionCategories.some(base => base.value === cat))
        .map(cat => ({
          value: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')
        })),
      // Add custom categories
      ...customCategories
        .filter(cat => 
          !baseTransactionCategories.some(base => base.value === cat) && 
          !existingCategories.includes(cat)
        )
        .map(cat => ({
          value: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')
        }))
    ].sort((a, b) => a.label.localeCompare(b.label));
  }, [existingCategories, customCategories]);

  const addCustomCategory = (categoryName: string) => {
    const categoryValue = categoryName.toLowerCase().replace(/\s+/g, '_');
    
    // Check if category already exists
    const existsInBase = baseBudgetCategories.some(cat => cat.value === categoryValue) ||
                       baseTransactionCategories.some(cat => cat.value === categoryValue);
    const existsInData = existingCategories.includes(categoryValue);
    const existsInCustom = customCategories.includes(categoryValue);
    
    if (!existsInBase && !existsInData && !existsInCustom) {
      setCustomCategories(prev => [...prev, categoryValue]);
    }
    
    return categoryValue;
  };

  return {
    budgetCategories,
    transactionCategories,
    addCustomCategory,
    existingCategories,
    customCategories
  };
}