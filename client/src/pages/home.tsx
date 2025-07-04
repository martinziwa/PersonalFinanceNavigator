import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { TrendingUp, ArrowDown, ArrowUp, Plus, AlertTriangle, Clock, Target } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import StatCard from "@/components/ui/stat-card";
import ProgressBar from "@/components/ui/progress-bar";
import TransactionModal from "@/components/modals/transaction-modal";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/hooks/use-transactions";
import { useBudgets } from "@/hooks/use-budgets";
import { useGoals } from "@/hooks/use-goals";

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


  const recentTransactions = transactions.slice(0, 4);

  // Calculate actual savings for a goal based on starting savings plus transactions
  const calculateGoalProgress = (goalId: number, startingSavings: string = "0") => {
    const goalTransactions = transactions.filter((transaction: Transaction) => 
      transaction.savingsGoalId === goalId
    );
    
    const transactionTotal = goalTransactions.reduce((total: number, transaction: Transaction) => {
      if (transaction.type === 'savings_deposit') {
        return total + parseFloat(transaction.amount);
      } else if (transaction.type === 'savings_withdrawal') {
        return total - parseFloat(transaction.amount);
      }
      return total;
    }, 0);
    
    return parseFloat(startingSavings) + transactionTotal;
  };

  // Generate spending alerts
  const spendingAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      type: 'budget_exceeded' | 'goal_deadline' | 'loan_payment';
      title: string;
      message: string;
      severity: 'high' | 'medium' | 'low';
      icon: React.ReactNode;
      actionText?: string;
      actionLink?: string;
    }> = [];

    // Check for budget overruns
    budgets.forEach((budget: any) => {
      const categoryTransactions = transactions.filter((transaction: Transaction) => {
        return transaction.category === budget.category && 
               transaction.type === "expense" &&
               new Date(transaction.date) >= new Date(budget.startDate) &&
               new Date(transaction.date) <= new Date(budget.endDate);
      });

      const totalSpent = categoryTransactions.reduce((total: number, transaction: Transaction) => {
        return total + parseFloat(transaction.amount);
      }, 0);

      const budgetAmount = parseFloat(budget.amount);
      const percentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

      if (percentage > 100) {
        alerts.push({
          id: `budget-${budget.id}`,
          type: 'budget_exceeded',
          title: 'Budget Exceeded',
          message: `You've spent ${formatCurrency(totalSpent)} on ${budget.category.replace('_', ' ')}, which is ${(percentage - 100).toFixed(1)}% over your ${formatCurrency(budgetAmount)} budget.`,
          severity: 'high',
          icon: <AlertTriangle className="h-4 w-4" />,
          actionText: 'View Budget',
          actionLink: '/budgets'
        });
      } else if (percentage > 80) {
        alerts.push({
          id: `budget-warning-${budget.id}`,
          type: 'budget_exceeded',
          title: 'Budget Warning',
          message: `You've used ${percentage.toFixed(1)}% of your ${budget.category.replace('_', ' ')} budget (${formatCurrency(totalSpent)} of ${formatCurrency(budgetAmount)}).`,
          severity: 'medium',
          icon: <AlertTriangle className="h-4 w-4" />,
          actionText: 'View Budget',
          actionLink: '/budgets'
        });
      }
    });



    // Check for goal deadlines
    goals.forEach((goal: any) => {
      if (goal.deadline) {
        const deadline = new Date(goal.deadline);
        const today = new Date();
        const daysUntilDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        const currentAmount = calculateGoalProgress(goal.id, goal.currentAmount);
        const targetAmount = parseFloat(goal.targetAmount);
        const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

        if (daysUntilDeadline <= 30 && daysUntilDeadline >= 0 && progress < 80) {
          alerts.push({
            id: `goal-deadline-${goal.id}`,
            type: 'goal_deadline',
            title: 'Goal Deadline Approaching',
            message: `${goal.name} is ${progress.toFixed(1)}% complete with ${daysUntilDeadline} days remaining until your ${deadline.toLocaleDateString()} deadline.`,
            severity: daysUntilDeadline <= 7 ? 'high' : 'medium',
            icon: <Target className="h-4 w-4" />,
            actionText: 'View Goals',
            actionLink: '/goals'
          });
        }
      }
    });

    // Sort by severity (high first)
    return alerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    }).slice(0, 3); // Show max 3 alerts
  }, [budgets, goals, transactions]);

  // Calculate aggregate amounts
  const totalIncome = transactions
    .filter(t => t.type === "income" || t.type === "savings_withdrawal")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type === "expense" || t.type === "savings_deposit")
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
    // Loan functionality has been removed from the application
    
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
                <div className="text-sm text-gray-500">Total Revenue</div>
                <div className="font-semibold text-green-600">
                  {formatCurrency(totalIncome)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Total Expenditure</div>
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

        {/* Spending Alerts */}
        {spendingAlerts.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
            <div className="space-y-3">
              {spendingAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-xl p-4 border ${
                    alert.severity === 'high' 
                      ? 'bg-red-50 border-red-200' 
                      : alert.severity === 'medium'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={`p-2 rounded-lg ${
                        alert.severity === 'high' 
                          ? 'bg-red-100 text-red-600' 
                          : alert.severity === 'medium'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {alert.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium ${
                          alert.severity === 'high' 
                            ? 'text-red-900' 
                            : alert.severity === 'medium'
                            ? 'text-amber-900'
                            : 'text-blue-900'
                        }`}>
                          {alert.title}
                        </h3>
                        <p className={`text-sm mt-1 ${
                          alert.severity === 'high' 
                            ? 'text-red-700' 
                            : alert.severity === 'medium'
                            ? 'text-amber-700'
                            : 'text-blue-700'
                        }`}>
                          {alert.message}
                        </p>
                      </div>
                    </div>
                    {alert.actionText && alert.actionLink && (
                      <Link href={alert.actionLink}>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`ml-3 ${
                            alert.severity === 'high' 
                              ? 'border-red-300 text-red-700 hover:bg-red-100' 
                              : alert.severity === 'medium'
                              ? 'border-amber-300 text-amber-700 hover:bg-amber-100'
                              : 'border-blue-300 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {alert.actionText}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
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
              const actualSavings = calculateGoalProgress(goal.id, goal.startingSavings);
              const targetAmount = parseFloat(goal.targetAmount);
              const percentage = (actualSavings / targetAmount) * 100;
              const remaining = targetAmount - actualSavings;
              
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
                      <span className="text-gray-600">{formatCurrency(actualSavings)}</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(targetAmount)}</span>
                    </div>
                    <ProgressBar percentage={percentage} color={goal.color} />
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
                        {transaction.category.replace('_', ' ')} • {transaction.time || "12:00 AM"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${
                      transaction.type === "income" || transaction.type === "savings_withdrawal" 
                        ? "text-green-600" : "text-red-600"
                    }`}>
                      {(transaction.type === "income" || transaction.type === "savings_withdrawal") ? "+" : "-"}
                      {formatCurrency(parseFloat(transaction.amount))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
