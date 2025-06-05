import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, PieChart, BarChart3, Calendar, Download } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import StatCard from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactions } from "@/hooks/use-transactions";
import { useGoals } from "@/hooks/use-goals";
import { useLoans } from "@/hooks/use-loans";
import { useBudgets } from "@/hooks/use-budgets";
import { formatCurrency } from "@/lib/currency";
import jsPDF from "jspdf";
import type { Transaction } from "@shared/schema";

interface FinancialSummary {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  totalSavings: number;
  totalDebt: number;
}

export default function Reports() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  const [reportPeriod, setReportPeriod] = useState("custom");

  const { data: financialSummary } = useQuery<FinancialSummary>({
    queryKey: ["/api/financial-summary"],
  });

  const { data: allTransactions = [] } = useTransactions();
  const { data: goals = [] } = useGoals();
  const { data: loans = [] } = useLoans();
  const { data: budgets = [] } = useBudgets();

  // Handle preset period selection
  const handlePeriodChange = (period: string) => {
    setReportPeriod(period);
    const today = new Date();
    const start = new Date();
    
    switch (period) {
      case "week":
        start.setDate(today.getDate() - 7);
        break;
      case "month":
        start.setMonth(today.getMonth() - 1);
        break;
      case "quarter":
        start.setMonth(today.getMonth() - 3);
        break;
      case "year":
        start.setFullYear(today.getFullYear() - 1);
        break;
      case "custom":
        return; // Don't change dates for custom
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  // Filter transactions based on selected date range
  const transactions = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the entire end date
    
    return allTransactions.filter((transaction: Transaction) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= start && transactionDate <= end;
    });
  }, [allTransactions, startDate, endDate]);

  // Calculate aggregate amounts
  const totalIncome = transactions
    .filter(t => t.type === "income" || t.type === "savings_withdrawal" || t.type === "loan_received")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type === "expense" || t.type === "savings_deposit" || t.type === "loan_payment")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const netAmount = totalIncome - totalExpenses;

  // Calculate spending alerts summary for the period
  const spendingAlertsSummary = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Loan payment analysis
    let currentLoanPayments = 0;
    let missedLoanPayments = 0;
    
    loans.forEach((loan: any) => {
      if (loan.nextPaymentDate) {
        const paymentDate = new Date(loan.nextPaymentDate);
        if (paymentDate >= start && paymentDate <= end) {
          const loanPayments = transactions.filter(t => 
            t.type === "loan_payment" && 
            t.loanId === loan.id &&
            new Date(t.date) >= start && 
            new Date(t.date) <= end
          );
          
          if (loanPayments.length > 0) {
            currentLoanPayments++;
          } else if (paymentDate < new Date()) {
            missedLoanPayments++;
          }
        }
      }
    });

    // Savings goals analysis
    let achievedGoals = 0;
    let goalsAbove80Percent = 0;
    
    goals.forEach((goal: any) => {
      const goalTransactions = transactions.filter(t => 
        t.savingsGoalId === goal.id &&
        new Date(t.date) >= start && 
        new Date(t.date) <= end
      );
      
      const transactionTotal = goalTransactions.reduce((total, transaction) => {
        if (transaction.type === 'savings_deposit') {
          return total + parseFloat(transaction.amount);
        } else if (transaction.type === 'savings_withdrawal') {
          return total - parseFloat(transaction.amount);
        }
        return total;
      }, 0);
      
      const currentAmount = parseFloat(goal.currentAmount || "0") + transactionTotal;
      const targetAmount = parseFloat(goal.targetAmount);
      const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
      
      if (progress >= 100) {
        achievedGoals++;
      } else if (progress >= 80) {
        goalsAbove80Percent++;
      }
    });

    // Budget analysis for the period
    let exceededBudgets = 0;
    let budgetsNearLimit = 0;
    
    budgets.forEach((budget: any) => {
      const budgetStart = new Date(budget.startDate);
      const budgetEnd = new Date(budget.endDate);
      
      // Check if budget period overlaps with report period
      if (budgetStart <= end && budgetEnd >= start) {
        const periodStart = new Date(Math.max(start.getTime(), budgetStart.getTime()));
        const periodEnd = new Date(Math.min(end.getTime(), budgetEnd.getTime()));
        
        const categoryTransactions = transactions.filter(t => {
          const transactionDate = new Date(t.date);
          return t.category === budget.category && 
                 t.type === "expense" &&
                 transactionDate >= periodStart &&
                 transactionDate <= periodEnd;
        });

        const totalSpent = categoryTransactions.reduce((total, transaction) => {
          return total + parseFloat(transaction.amount);
        }, 0);

        const budgetAmount = parseFloat(budget.amount);
        const percentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

        if (percentage > 100) {
          exceededBudgets++;
        } else if (percentage >= 80) {
          budgetsNearLimit++;
        }
      }
    });

    return {
      loanPayments: {
        current: currentLoanPayments,
        missed: missedLoanPayments,
        total: currentLoanPayments + missedLoanPayments
      },
      goals: {
        achieved: achievedGoals,
        above80Percent: goalsAbove80Percent,
        total: goals.length
      },
      budgets: {
        exceeded: exceededBudgets,
        nearLimit: budgetsNearLimit,
        total: budgets.length
      }
    };
  }, [transactions, loans, goals, budgets, startDate, endDate]);

  // Calculate category spending
  const categorySpending = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, transaction) => {
      const category = transaction.category;
      acc[category] = (acc[category] || 0) + parseFloat(transaction.amount);
      return acc;
    }, {} as Record<string, number>);

  const topCategories = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Calculate monthly trends
  const monthlyData = transactions.reduce((acc, transaction) => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = { income: 0, expenses: 0 };
    }
    
    if (transaction.type === "income") {
      acc[monthKey].income += parseFloat(transaction.amount);
    } else {
      acc[monthKey].expenses += parseFloat(transaction.amount);
    }
    
    return acc;
  }, {} as Record<string, { income: number; expenses: number }>);

  const monthlyTrends = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6); // Last 6 months

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      food: "🍽️",
      transportation: "🚗",
      shopping: "🛍️",
      entertainment: "🎬",
      bills: "📄",
      healthcare: "🏥",
      education: "📚",
      other: "📝",
    };
    return icons[category] || "📝";
  };

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Generate PDF report
  const generateReport = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPosition = 20;

    // Helper function to add text with wrapping
    const addText = (text: string, x: number, y: number, options: any = {}) => {
      pdf.text(text, x, y, options);
      return y + (options.lineHeight || 7);
    };

    // Title
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    yPosition = addText("Financial Report", 20, yPosition);
    
    // Period
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    yPosition = addText(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, 20, yPosition + 5);
    yPosition += 10;

    // Summary Section
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    yPosition = addText("Summary", 20, yPosition);
    yPosition += 5;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    yPosition = addText(`Total Income: ${formatCurrency(totalIncome)}`, 20, yPosition);
    yPosition = addText(`Total Expenses: ${formatCurrency(totalExpenses)}`, 20, yPosition);
    yPosition = addText(`Net Amount: ${formatCurrency(netAmount)}`, 20, yPosition);
    yPosition = addText(`Transaction Count: ${transactions.length}`, 20, yPosition);
    yPosition += 10;

    // Spending Alerts Summary
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    yPosition = addText("Spending Alerts Summary", 20, yPosition);
    yPosition += 5;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    yPosition = addText(`Loan Payments: ${spendingAlertsSummary.loanPayments.current} current, ${spendingAlertsSummary.loanPayments.missed} missed`, 20, yPosition);
    yPosition = addText(`Savings Goals: ${spendingAlertsSummary.goals.achieved} achieved, ${spendingAlertsSummary.goals.above80Percent} above 80%`, 20, yPosition);
    yPosition = addText(`Budget Performance: ${spendingAlertsSummary.budgets.exceeded} exceeded, ${spendingAlertsSummary.budgets.nearLimit} near limit`, 20, yPosition);
    yPosition += 10;

    // Category Breakdown
    if (topCategories.length > 0) {
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      yPosition = addText("Top Spending Categories", 20, yPosition);
      yPosition += 5;

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      topCategories.forEach(([category, amount]) => {
        const totalExpenses = Object.values(categorySpending).reduce((sum, val) => sum + val, 0);
        const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
        yPosition = addText(`${category.replace('_', ' ')}: ${formatCurrency(amount)} (${percentage.toFixed(1)}%)`, 20, yPosition);
      });
      yPosition += 10;
    }

    // Monthly Trends
    if (monthlyTrends.length > 0) {
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      yPosition = addText("Monthly Trends", 20, yPosition);
      yPosition += 5;

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      monthlyTrends.forEach(([monthKey, data]) => {
        const netIncome = data.income - data.expenses;
        yPosition = addText(`${getMonthName(monthKey)}:`, 20, yPosition);
        yPosition = addText(`  Income: ${formatCurrency(data.income)}`, 25, yPosition);
        yPosition = addText(`  Expenses: ${formatCurrency(data.expenses)}`, 25, yPosition);
        yPosition = addText(`  Net: ${formatCurrency(netIncome)}`, 25, yPosition);
        yPosition += 3;
      });
      yPosition += 10;
    }

    // Goals Progress
    if (goals.length > 0) {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      yPosition = addText("Savings Goals Progress", 20, yPosition);
      yPosition += 5;

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      goals.forEach(goal => {
        const current = parseFloat(goal.currentAmount || "0");
        const target = parseFloat(goal.targetAmount);
        const progress = target > 0 ? (current / target) * 100 : 0;
        yPosition = addText(`${goal.name}: ${formatCurrency(current)} / ${formatCurrency(target)} (${progress.toFixed(1)}%)`, 20, yPosition);
      });
      yPosition += 10;
    }

    // Loans Summary
    if (loans.length > 0) {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      yPosition = addText("Loans Summary", 20, yPosition);
      yPosition += 5;

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      loans.forEach(loan => {
        yPosition = addText(`${loan.name}: Balance ${formatCurrency(parseFloat(loan.balance))}`, 20, yPosition);
        if (loan.nextPaymentDate) {
          yPosition = addText(`  Next Payment: ${new Date(loan.nextPaymentDate).toLocaleDateString()}`, 25, yPosition);
        }
      });
    }

    // Generate timestamp
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.text(`Generated on ${new Date().toLocaleString()}`, 20, pdf.internal.pageSize.getHeight() - 10);

    // Save the PDF
    pdf.save(`financial-report-${startDate}-to-${endDate}.pdf`);
  };

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative">
      <Header title="Financial Reports" subtitle="Analyze your finances" />
      
      <main className="pb-20 px-4 space-y-6 pt-4">
        {/* Date Range Selector */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Report Period</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={generateReport}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </Button>
          </div>
          
          <div className="space-y-4">
            <Select value={reportPeriod} onValueChange={handlePeriodChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="quarter">Last 3 months</SelectItem>
                <SelectItem value="year">Last year</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            
            {reportPeriod === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
            
            <div className="text-xs text-gray-500 text-center">
              {transactions.length} transactions found in selected period
            </div>
          </div>
        </div>

        {/* Spending Alerts Summary */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Spending Alerts Summary</h3>
          <div className="grid grid-cols-1 gap-4">
            {/* Loan Payments */}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-sm">🏛️</span>
                </div>
                <div>
                  <div className="font-medium text-blue-900">Loan Payments</div>
                  <div className="text-sm text-blue-700">
                    {spendingAlertsSummary.loanPayments.current} current, {spendingAlertsSummary.loanPayments.missed} missed
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-blue-900">
                  {spendingAlertsSummary.loanPayments.total}
                </div>
                <div className="text-xs text-blue-600">total due</div>
              </div>
            </div>

            {/* Savings Goals */}
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-sm">🎯</span>
                </div>
                <div>
                  <div className="font-medium text-green-900">Savings Goals</div>
                  <div className="text-sm text-green-700">
                    {spendingAlertsSummary.goals.achieved} achieved, {spendingAlertsSummary.goals.above80Percent} above 80%
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-green-900">
                  {spendingAlertsSummary.goals.total}
                </div>
                <div className="text-xs text-green-600">total goals</div>
              </div>
            </div>

            {/* Budget Performance */}
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <span className="text-amber-600 text-sm">📊</span>
                </div>
                <div>
                  <div className="font-medium text-amber-900">Budget Performance</div>
                  <div className="text-sm text-amber-700">
                    {spendingAlertsSummary.budgets.exceeded} exceeded, {spendingAlertsSummary.budgets.nearLimit} near limit
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-amber-900">
                  {spendingAlertsSummary.budgets.total}
                </div>
                <div className="text-xs text-amber-600">total budgets</div>
              </div>
            </div>
          </div>
        </div>

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

        {/* Financial Summary */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Financial Overview</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              title="Net Worth"
              value={financialSummary ? formatCurrency(financialSummary.netWorth) : "$0"}
              icon={<TrendingUp className="h-4 w-4 text-green-600" />}
              iconBg="bg-green-100"
            />
            <StatCard
              title="Total Savings"
              value={financialSummary ? formatCurrency(financialSummary.totalSavings) : "$0"}
              icon={<PieChart className="h-4 w-4 text-blue-600" />}
              iconBg="bg-blue-100"
            />
            <StatCard
              title="Monthly Income"
              value={financialSummary ? formatCurrency(financialSummary.monthlyIncome) : "$0"}
              icon={<TrendingUp className="h-4 w-4 text-green-600" />}
              iconBg="bg-green-100"
            />
            <StatCard
              title="Monthly Expenses"
              value={financialSummary ? formatCurrency(financialSummary.monthlyExpenses) : "$0"}
              icon={<TrendingDown className="h-4 w-4 text-red-600" />}
              iconBg="bg-red-100"
            />
          </div>
        </section>

        {/* Spending by Category */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Top Spending Categories</h2>
          
          {topCategories.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No spending data available</p>
              <p className="text-sm text-gray-400 mt-1">Add some transactions to see category breakdown</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
              {topCategories.map(([category, amount], index) => {
                const totalExpenses = Object.values(categorySpending).reduce((sum, val) => sum + val, 0);
                const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                
                return (
                  <div key={category} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm">{getCategoryIcon(category)}</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 capitalize">
                          {category.replace('_', ' ')}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {percentage.toFixed(1)}% of total spending
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(amount)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Monthly Trends */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Monthly Trends</h2>
          
          {monthlyTrends.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No trend data available</p>
              <p className="text-sm text-gray-400 mt-1">Add transactions over multiple months to see trends</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
              {monthlyTrends.map(([monthKey, data]) => {
                const netIncome = data.income - data.expenses;
                
                return (
                  <div key={monthKey} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">
                        {getMonthName(monthKey)}
                      </h3>
                      <div className={`text-sm font-semibold ${
                        netIncome >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {netIncome >= 0 ? "+" : ""}{formatCurrency(netIncome)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Income</p>
                        <p className="font-medium text-green-600">
                          {formatCurrency(data.income)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Expenses</p>
                        <p className="font-medium text-red-600">
                          {formatCurrency(data.expenses)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Insights */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Quick Insights</h2>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="space-y-3">
              {financialSummary && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Savings Rate</span>
                    <span className="font-medium text-gray-900">
                      {financialSummary.monthlyIncome > 0 ? 
                        `${(((financialSummary.monthlyIncome - financialSummary.monthlyExpenses) / financialSummary.monthlyIncome) * 100).toFixed(1)}%` :
                        "0%"
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Debt-to-Assets Ratio</span>
                    <span className="font-medium text-gray-900">
                      {financialSummary.totalSavings > 0 ? 
                        `${((financialSummary.totalDebt / (financialSummary.totalSavings + financialSummary.totalDebt)) * 100).toFixed(1)}%` :
                        "0%"
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Monthly Cash Flow</span>
                    <span className={`font-medium ${
                      (financialSummary.monthlyIncome - financialSummary.monthlyExpenses) >= 0 ? 
                      "text-green-600" : "text-red-600"
                    }`}>
                      {formatCurrency(financialSummary.monthlyIncome - financialSummary.monthlyExpenses)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <BottomNavigation />
    </div>
  );
}
