import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { TrendingUp, ArrowDown, ArrowUp, Plus } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import StatCard from "@/components/ui/stat-card";
import ProgressBar from "@/components/ui/progress-bar";
import TransactionModal from "@/components/modals/transaction-modal";
import { useTransactions } from "@/hooks/use-transactions";
import { useBudgets } from "@/hooks/use-budgets";
import { useGoals } from "@/hooks/use-goals";
import { useLoans } from "@/hooks/use-loans";
import { formatCurrency } from "@/lib/currency";
import type { Transaction } from "@shared/schema";

interface FinancialSummary {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  totalSavings: number;
  totalDebt: number;
}

export default function Home() {
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  const { data: financialSummary } = useQuery<FinancialSummary>({
    queryKey: ["/api/financial-summary"],
  });

  const { data: transactions = [] } = useTransactions();
  const { data: budgets = [] } = useBudgets();
  const { data: goals = [] } = useGoals();
  const { data: loans = [] } = useLoans();

  const recentTransactions = transactions.slice(0, 4);

  // Calculate actual savings for a goal based on transactions
  const calculateGoalProgress = (goalId: number) => {
    const goalTransactions = transactions.filter((transaction: Transaction) => 
      transaction.savingsGoalId === goalId
    );
    
    return goalTransactions.reduce((total: number, transaction: Transaction) => {
      if (transaction.type === 'savings_deposit') {
        return total + parseFloat(transaction.amount);
      } else if (transaction.type === 'savings_withdrawal') {
        return total - parseFloat(transaction.amount);
      }
      return total;
    }, 0);
  };

  // Calculate aggregate amounts
  const totalIncome = transactions
    .filter(t => t.type === "income" || t.type === "savings_withdrawal" || t.type === "loan_received")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type === "expense" || t.type === "savings_deposit" || t.type === "loan_payment")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const netAmount = totalIncome - totalExpenses;

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return d.toLocaleDateString();
  };

  const getCategoryIcon = (category: string, type: string) => {
    // Special icons for different transaction types
    if (type === "income") return "💰";
    if (type === "savings_deposit") return "🏦";
    if (type === "savings_withdrawal") return "🏧";
    if (type === "loan_received") return "📈";
    if (type === "loan_payment") return "📉";
    
    const icons: Record<string, string> = {
      food: "🍽️",
      transportation: "🚗",
      shopping: "🛍️",
      entertainment: "🎬",
      bills: "📄",
      healthcare: "🏥",
      education: "📚",
      savings: "💳",
      loan: "🏛️",
      other: "📝",
    };
    return icons[category] || "📝";
  };

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative">
      <Header />
      
      <main className="pb-20 px-4 space-y-6 pt-4">
        {/* Transaction Summary */}
        {transactions.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <h3 className="font-semibold text-gray-900 mb-3">Transaction Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-sm text-gray-500">Income</div>
                <div className="font-semibold text-green-600">
                  {formatCurrency(totalIncome)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Expenses</div>
                <div className="font-semibold text-red-600">
                  {formatCurrency(totalExpenses)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Net</div>
                <div className={`font-semibold ${netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(netAmount)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Financial Overview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Financial Overview</h2>
            <Link href="/reports">
              <button className="text-primary text-sm font-medium">View Reports</button>
            </Link>
          </div>

          {/* Net Worth Card */}
          <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 text-sm">Net Worth</span>
              <TrendingUp className="h-5 w-5 text-blue-200" />
            </div>
            <div className="text-3xl font-bold mb-1">
              {financialSummary ? formatCurrency(financialSummary.netWorth) : "$0.00"}
            </div>
            <div className="flex items-center text-blue-200 text-sm">
              <ArrowUp className="h-3 w-3 mr-1" />
              <span>+5.2% this month</span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              title="Monthly Income"
              value={financialSummary ? formatCurrency(financialSummary.monthlyIncome) : "$0"}
              change="+2.1% vs last month"
              icon={<ArrowDown className="h-4 w-4 text-green-600" />}
              iconBg="bg-green-100"
              changeColor="text-gray-500"
            />
            <StatCard
              title="Monthly Expenses"
              value={financialSummary ? formatCurrency(financialSummary.monthlyExpenses) : "$0"}
              change="-3.4% vs last month"
              icon={<ArrowUp className="h-4 w-4 text-red-600" />}
              iconBg="bg-red-100"
              changeColor="text-gray-500"
            />
          </div>
        </section>

        {/* Budget Overview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Budget Status</h2>
            <Link href="/budgets">
              <button className="text-primary text-sm font-medium">Manage</button>
            </Link>
          </div>

          {budgets.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-gray-500">No budgets set up yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first budget to start tracking</p>
            </div>
          ) : (
            budgets.slice(0, 2).map((budget) => {
              const percentage = (parseFloat(budget.spent) / parseFloat(budget.amount)) * 100;
              const remaining = parseFloat(budget.amount) - parseFloat(budget.spent);
              
              return (
                <div key={budget.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm">{getCategoryIcon(budget.category, "expense")}</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 capitalize">{budget.category.replace('_', ' ')}</h3>
                        <p className="text-xs text-gray-500">Monthly Budget</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(parseFloat(budget.spent))} / {formatCurrency(parseFloat(budget.amount))}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(remaining)} left
                      </div>
                    </div>
                  </div>
                  <ProgressBar
                    percentage={percentage}
                    color={percentage > 80 ? "bg-red-500" : percentage > 60 ? "bg-yellow-500" : "bg-green-500"}
                  />
                </div>
              );
            })
          )}
        </section>

        {/* Savings Goals */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Savings Goals</h2>
            <Link href="/goals">
              <button className="text-primary text-sm font-medium">Add Goal</button>
            </Link>
          </div>

          {goals.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-gray-500">No savings goals yet</p>
              <p className="text-sm text-gray-400 mt-1">Set your first goal to start saving</p>
            </div>
          ) : (
            goals.slice(0, 2).map((goal) => {
              const percentage = (parseFloat(goal.currentAmount) / parseFloat(goal.targetAmount)) * 100;
              const remaining = parseFloat(goal.targetAmount) - parseFloat(goal.currentAmount);
              
              return (
                <div key={goal.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg`} style={{ backgroundColor: goal.color + '20' }}>
                        <span>{goal.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{goal.name}</h3>
                        <p className="text-xs text-gray-500">
                          {goal.deadline ? `Target: ${new Date(goal.deadline).toLocaleDateString()}` : "No deadline"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold" style={{ color: goal.color }}>
                        {Math.round(percentage)}%
                      </div>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{formatCurrency(parseFloat(goal.currentAmount))}</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(parseFloat(goal.targetAmount))}</span>
                    </div>
                    <ProgressBar percentage={percentage} color={`bg-[${goal.color}]`} />
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency(remaining)} remaining to reach goal
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Recent Transactions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
            <Link href="/transactions">
              <button className="text-primary text-sm font-medium">View All</button>
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-gray-500">No transactions yet</p>
              <p className="text-sm text-gray-400 mt-1">Add your first transaction to get started</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      transaction.type === "income" || transaction.type === "savings_withdrawal" || transaction.type === "loan_received"
                        ? "bg-green-100" : "bg-red-100"
                    }`}>
                      <span className="text-sm">{getCategoryIcon(transaction.category, transaction.type)}</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{transaction.description}</h3>
                      <p className="text-xs text-gray-500 capitalize">
                        {transaction.category.replace('_', ' ')} • {formatDate(transaction.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${
                      transaction.type === "income" || transaction.type === "savings_withdrawal" || transaction.type === "loan_received" 
                        ? "text-green-600" : "text-red-600"
                    }`}>
                      {(transaction.type === "income" || transaction.type === "savings_withdrawal" || transaction.type === "loan_received") ? "+" : "-"}
                      {formatCurrency(parseFloat(transaction.amount))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Loans Overview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Active Loans</h2>
            <Link href="/loans">
              <button className="text-primary text-sm font-medium">Manage</button>
            </Link>
          </div>

          {loans.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-gray-500">No active loans</p>
              <p className="text-sm text-gray-400 mt-1">Great! You're debt-free</p>
            </div>
          ) : (
            loans.slice(0, 2).map((loan) => {
              const daysUntilPayment = Math.ceil(
                (new Date(loan.nextPaymentDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );
              
              return (
                <div key={loan.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: loan.color + '20' }}>
                        <span className="text-lg">{loan.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{loan.name}</h3>
                        <p className="text-xs text-gray-500">
                          Repayment amount: {formatCurrency(parseFloat(loan.minPayment))}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-red-600">
                        {formatCurrency(parseFloat(loan.balance))}
                      </div>
                      <div className="text-xs text-gray-500">
                        {parseFloat(loan.interestRate)}% APR
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    daysUntilPayment <= 7 ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50"
                  }`}>
                    {daysUntilPayment <= 0 ? "Payment overdue" : 
                     daysUntilPayment <= 7 ? `Payment due in ${daysUntilPayment} days` :
                     `Next payment: ${new Date(loan.nextPaymentDate).toLocaleDateString()}`}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsTransactionModalOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center z-20"
      >
        <Plus className="h-6 w-6 text-white" />
      </button>

      <BottomNavigation />
      
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
      />
    </div>
  );
}
