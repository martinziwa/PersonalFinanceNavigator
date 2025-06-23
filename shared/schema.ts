import { pgTable, text, serial, integer, boolean, decimal, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(), // 'income', 'expense', 'savings_deposit', 'savings_withdrawal', 'loan_repayment'
  date: timestamp("date").defaultNow().notNull(),
  time: text("time"), // Optional time field for precise transaction timing
  savingsGoalId: integer("savings_goal_id").references(() => savingsGoals.id),
  loanId: integer("loan_id").references(() => loans.id), // Reference to loan for loan_repayment transactions

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

export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  principal: decimal("principal", { precision: 12, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).default("0.00").notNull(),
  interestType: text("interest_type").default("compound").notNull(), // "simple", "compound"
  termMonths: integer("term_months").notNull(), // loan term in months for amortization calculation
  compoundFrequency: text("compound_frequency"), // "daily", "weekly", "biweekly", "monthly", "quarterly", "semiannually", "annually" - only for compound loans
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  monthlyPayment: decimal("monthly_payment", { precision: 12, scale: 2 }), // calculated automatically for compound loans only
  loanType: text("loan_type").notNull(), // "personal", "mortgage", "auto", "student", "business", "credit_card", "other"
  lender: text("lender"),
  description: text("description"),
  status: text("status").default("active").notNull(), // "active", "paid_off", "defaulted"
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



export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
}).extend({
  date: z.string().transform((val) => new Date(val)),
  savingsGoalId: z.number().optional(),
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
  monthlyPayment: true, // calculated automatically for compound loans
}).extend({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().nullable().optional().transform((val) => val ? new Date(val) : null),
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
