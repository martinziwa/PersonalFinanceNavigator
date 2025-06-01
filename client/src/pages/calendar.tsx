import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Target, DollarSign, Calendar as CalendarIcon } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTransactions } from "@/hooks/use-transactions";
import { useGoals } from "@/hooks/use-goals";
import { useLoans } from "@/hooks/use-loans";
import { useBudgets } from "@/hooks/use-budgets";
import { formatCurrency } from "@/lib/currency";
import type { Transaction, SavingsGoal, Loan, Budget } from "@shared/schema";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarEvent {
  id: string;
  title: string;
  type: "transaction" | "goal_deadline" | "goal_start" | "loan_payment" | "loan_start" | "budget_start" | "budget_end";
  date: Date;
  amount?: string;
  description?: string;
  status?: "upcoming" | "overdue" | "completed";
  icon: React.ReactNode;
  color: string;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: transactions = [] } = useTransactions();
  const { data: goals = [] } = useGoals();
  const { data: loans = [] } = useLoans();
  const { data: budgets = [] } = useBudgets();

  // Generate calendar events from financial data
  const generateEvents = (): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Add transaction events
    transactions.forEach((transaction: Transaction) => {
      const transactionDate = new Date(transaction.date);
      events.push({
        id: `transaction-${transaction.id}`,
        title: transaction.description,
        type: "transaction",
        date: transactionDate,
        amount: transaction.amount,
        description: `${transaction.type}: ${transaction.category}`,
        status: "completed",
        icon: <DollarSign className="h-4 w-4" />,
        color: transaction.type === "income" ? "#10B981" : "#EF4444"
      });
    });

    // Add savings goal events
    goals.forEach((goal: SavingsGoal) => {
      // Goal creation date (assuming created date exists or use current date)
      events.push({
        id: `goal-start-${goal.id}`,
        title: `Started: ${goal.name}`,
        type: "goal_start",
        date: new Date(), // You might want to add a createdAt field to the schema
        description: `Started savings goal for ${formatCurrency(parseFloat(goal.targetAmount))}`,
        icon: <Target className="h-4 w-4" />,
        color: "#8B5CF6"
      });

      // Goal deadline
      if (goal.deadline) {
        const deadlineDate = new Date(goal.deadline);
        const isOverdue = deadlineDate < today;
        events.push({
          id: `goal-deadline-${goal.id}`,
          title: `Deadline: ${goal.name}`,
          type: "goal_deadline",
          date: deadlineDate,
          amount: goal.targetAmount,
          description: `Savings goal deadline`,
          status: isOverdue ? "overdue" : "upcoming",
          icon: <Target className="h-4 w-4" />,
          color: isOverdue ? "#EF4444" : "#F59E0B"
        });
      }
    });

    // Add loan events
    loans.forEach((loan: Loan) => {
      // Loan start date (you might want to add this field to the schema)
      events.push({
        id: `loan-start-${loan.id}`,
        title: `Loan Started: ${loan.name}`,
        type: "loan_start",
        date: new Date(), // You might want to add a loanStartDate field
        amount: loan.principalAmount || loan.balance,
        description: `Loan of ${formatCurrency(parseFloat(loan.principalAmount || loan.balance))}`,
        icon: <CalendarIcon className="h-4 w-4" />,
        color: "#DC2626"
      });

      // Next payment due date
      const paymentDate = new Date(loan.nextPaymentDate);
      const isOverdue = paymentDate < today;
      events.push({
        id: `loan-payment-${loan.id}`,
        title: `Payment Due: ${loan.name}`,
        type: "loan_payment",
        date: paymentDate,
        amount: loan.minPayment,
        description: `Loan payment due`,
        status: isOverdue ? "overdue" : "upcoming",
        icon: <Clock className="h-4 w-4" />,
        color: isOverdue ? "#EF4444" : "#F59E0B"
      });
    });

    // Add budget events
    budgets.forEach((budget: Budget) => {
      // Budget start date
      const startDate = new Date(budget.startDate);
      events.push({
        id: `budget-start-${budget.id}`,
        title: `Budget Started: ${budget.category}`,
        type: "budget_start",
        date: startDate,
        amount: budget.amount,
        description: `${budget.period} budget for ${budget.category}`,
        icon: <DollarSign className="h-4 w-4" />,
        color: "#3B82F6"
      });

      // Budget end date
      const endDate = new Date(budget.endDate);
      events.push({
        id: `budget-end-${budget.id}`,
        title: `Budget Ends: ${budget.category}`,
        type: "budget_end",
        date: endDate,
        amount: budget.amount,
        description: `${budget.period} budget ends`,
        icon: <DollarSign className="h-4 w-4" />,
        color: "#6366F1"
      });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const events = generateEvents();

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const days = getDaysInMonth(currentDate);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsDialogOpen(true);
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative">
      <Header title="Financial Calendar" subtitle="Track important dates" />
      
      <main className="pb-20 px-4 space-y-6 pt-4">
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('prev')}
            className="p-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-gray-900">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('next')}
            className="p-2"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (!day) {
                return <div key={index} className="h-12" />;
              }

              const dayEvents = getEventsForDate(day);
              const hasEvents = dayEvents.length > 0;
              const hasOverdue = dayEvents.some(event => event.status === "overdue");
              const isToday = day.toDateString() === new Date().toDateString();

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(day)}
                  className={`h-12 text-sm rounded-lg relative transition-colors ${
                    isToday
                      ? 'bg-primary text-white font-semibold'
                      : hasOverdue
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : hasEvents
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {day.getDate()}
                  {hasEvents && (
                    <div className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${
                      hasOverdue ? 'bg-red-500' : isToday ? 'bg-white' : 'bg-blue-500'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3">Upcoming Events</h3>
          <div className="space-y-2">
            {events
              .filter(event => {
                const eventDate = new Date(event.date);
                const today = new Date();
                const nextWeek = new Date();
                nextWeek.setDate(today.getDate() + 7);
                return eventDate >= today && eventDate <= nextWeek;
              })
              .slice(0, 5)
              .map(event => (
                <div key={event.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center`} style={{backgroundColor: event.color + '20'}}>
                    <span style={{color: event.color}}>{event.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{event.title}</p>
                    <p className="text-xs text-gray-500">
                      {event.date.toLocaleDateString()}
                      {event.amount && ` • ${formatCurrency(parseFloat(event.amount))}`}
                    </p>
                  </div>
                  {event.status === "overdue" && (
                    <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full">
                      Overdue
                    </span>
                  )}
                </div>
              ))}
            {events.filter(event => {
              const eventDate = new Date(event.date);
              const today = new Date();
              const nextWeek = new Date();
              nextWeek.setDate(today.getDate() + 7);
              return eventDate >= today && eventDate <= nextWeek;
            }).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No upcoming events in the next 7 days
              </p>
            )}
          </div>
        </div>

        {/* Date Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-sm mx-auto max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedDate?.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedDateEvents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No events on this date
                </p>
              ) : (
                selectedDateEvents.map(event => (
                  <div key={event.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mt-1`} style={{backgroundColor: event.color + '20'}}>
                        <span style={{color: event.color}}>{event.icon}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                        {event.description && (
                          <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                        )}
                        {event.amount && (
                          <p className="text-sm font-medium mt-1" style={{color: event.color}}>
                            {formatCurrency(parseFloat(event.amount))}
                          </p>
                        )}
                        {event.status && (
                          <span className={`inline-block text-xs px-2 py-1 rounded-full mt-2 ${
                            event.status === 'overdue' ? 'bg-red-100 text-red-700' :
                            event.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {event.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>

      <BottomNavigation />
    </div>
  );
}