import { pgTable, text, serial, integer, boolean, decimal, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(), // 'income', 'expense', 'savings_deposit', 'savings_withdrawal', 'loan_received', 'loan_payment'
  date: timestamp("date").defaultNow().notNull(),
  time: text("time"), // Optional time field for precise transaction timing
  savingsGoalId: integer("savings_goal_id").references(() => savingsGoals.id),
  loanId: integer("loan_id").references(() => loans.id),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 10, scale: 2 }).default("0").notNull(),
  period: text("period").default("monthly").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  icon: text("icon").notNull(),
  description: text("description"),
});

export const savingsGoals = pgTable("savings_goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  startingSavings: decimal("starting_savings", { precision: 10, scale: 2 }).default("0").notNull(),
  startDate: timestamp("start_date").defaultNow().notNull(),
  deadline: timestamp("deadline"),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
});

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  principalAmount: decimal("principal_amount", { precision: 10, scale: 2 }),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(),
  currentRepayment: decimal("current_repayment", { precision: 10, scale: 2 }), // for simple interest loans
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  interestType: text("interest_type"), // "simple" or "compound"
  interestPeriod: text("interest_period"), // frequency of interest calculation
  isAmortized: boolean("is_amortized").default(false).notNull(),
  repaymentFrequency: text("repayment_frequency"), // frequency of payments
  loanTermMonths: integer("loan_term_months"), // total loan term in months
  calculatedPayment: decimal("calculated_payment", { precision: 10, scale: 2 }), // calculated monthly payment for amortized loans
  nextPaymentDate: timestamp("next_payment_date"),
  startDate: timestamp("start_date").defaultNow().notNull(), // When the loan began
  icon: text("icon").notNull(),
  color: text("color").notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
}).extend({
  date: z.string().transform((val) => new Date(val)),
  savingsGoalId: z.number().optional(),
  loanId: z.number().optional(),
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  spent: true,
}).extend({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
});

export const insertSavingsGoalSchema = createInsertSchema(savingsGoals).omit({
  id: true,
  currentAmount: true,
}).extend({
  startDate: z.string().transform((val) => new Date(val)),
  deadline: z.string().nullable().optional().transform((val) => val ? new Date(val) : null),
  startingSavings: z.string().optional().transform((val) => val ? val : "0"),
});

export const insertLoanSchema = createInsertSchema(loans).omit({
  id: true,
}).extend({
  nextPaymentDate: z.string().transform((val) => new Date(val)),
  startDate: z.string().transform((val) => new Date(val)),
  loanTermMonths: z.number().optional(),
  calculatedPayment: z.string().optional(),
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type SavingsGoal = typeof savingsGoals.$inferSelect;

export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loans.$inferSelect;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
