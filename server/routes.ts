import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertTransactionSchema,
  insertBudgetSchema,
  insertSavingsGoalSchema,

} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Guest login route
  app.get('/api/guest-login', (req: any, res) => {
    // Create a guest session
    const guestUser = {
      claims: {
        sub: `guest-${Date.now()}`,
        email: null,
        first_name: "Guest",
        last_name: "User",
        profile_image_url: null
      },
      access_token: "guest-token",
      refresh_token: null,
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };
    
    req.login(guestUser, (err: any) => {
      if (err) {
        return res.status(500).json({ message: "Failed to create guest session" });
      }
      res.redirect('/');
    });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user && userId.startsWith('guest-')) {
        // Create guest user on first access
        const guestUser = await storage.upsertUser({
          id: userId,
          email: null,
          firstName: "Guest",
          lastName: "User",
          profileImageUrl: null
        });
        return res.json(guestUser);
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Transactions
  app.get("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transaction = insertTransactionSchema.parse(req.body);
      const created = await storage.createTransaction(userId, transaction);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Invalid transaction data" });
    }
  });

  app.put("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const updates = req.body;
      console.log("Update request:", { userId, id, updates });
      
      // Validate the update data
      const validatedUpdates = insertTransactionSchema.partial().parse(updates);
      console.log("Validated updates:", validatedUpdates);
      
      const updated = await storage.updateTransaction(userId, id, validatedUpdates);
      res.json(updated);
    } catch (error) {
      console.error("Transaction update error:", error);
      res.status(400).json({ message: "Failed to update transaction", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteTransaction(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Budgets
  app.get("/api/budgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Fetching budgets for user:", userId);
      const budgets = await storage.getBudgets(userId);
      console.log("Fetched budgets:", budgets);
      res.json(budgets);
    } catch (error) {
      console.error("Budget fetch error:", error);
      res.status(500).json({ message: "Failed to fetch budgets", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/budgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Budget creation request body:", req.body);
      const budget = insertBudgetSchema.parse(req.body);
      console.log("Parsed budget data:", budget);
      
      // Check for existing budgets with same category and overlapping time periods
      const existingBudgets = await storage.getBudgets(userId);
      const newStartDate = new Date(budget.startDate);
      const newEndDate = new Date(budget.endDate);
      
      const conflictingBudget = existingBudgets.find(existing => {
        if (existing.category !== budget.category) return false;
        
        const existingStartDate = new Date(existing.startDate);
        const existingEndDate = new Date(existing.endDate);
        
        // Check for any overlap in date ranges
        return (newStartDate <= existingEndDate && newEndDate >= existingStartDate);
      });
      
      if (conflictingBudget) {
        return res.status(400).json({
          message: `A budget for ${budget.category} already exists for this time period. Please choose a different category or time period.`
        });
      }
      
      const created = await storage.createBudget(userId, budget);
      res.status(201).json(created);
    } catch (error) {
      console.error("Budget creation error:", error);
      res.status(400).json({ message: "Invalid budget data", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put("/api/budgets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const updates = req.body;
      console.log("Budget update request:", { userId, id, updates });
      
      // Validate the update data
      const validatedUpdates = insertBudgetSchema.partial().parse(updates);
      console.log("Validated budget updates:", validatedUpdates);
      
      // If category, startDate, or endDate are being updated, check for conflicts
      if (validatedUpdates.category || validatedUpdates.startDate || validatedUpdates.endDate) {
        const existingBudgets = await storage.getBudgets(userId);
        const currentBudget = existingBudgets.find(b => b.id === id);
        
        if (currentBudget) {
          // Create the updated budget data
          const updatedBudget = {
            ...currentBudget,
            ...validatedUpdates
          };
          
          const newStartDate = new Date(updatedBudget.startDate);
          const newEndDate = new Date(updatedBudget.endDate);
          
          // Check for conflicts with other budgets (excluding the current one)
          const conflictingBudget = existingBudgets.find(existing => {
            if (existing.id === id) return false; // Skip the current budget
            if (existing.category !== updatedBudget.category) return false;
            
            const existingStartDate = new Date(existing.startDate);
            const existingEndDate = new Date(existing.endDate);
            
            // Check for any overlap in date ranges
            return (newStartDate <= existingEndDate && newEndDate >= existingStartDate);
          });
          
          if (conflictingBudget) {
            return res.status(400).json({
              message: `A budget for ${updatedBudget.category} already exists for this time period. Please choose a different category or time period.`
            });
          }
        }
      }
      
      const updated = await storage.updateBudget(userId, id, validatedUpdates);
      res.json(updated);
    } catch (error) {
      console.error("Budget update error:", error);
      res.status(400).json({ message: "Failed to update budget", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/budgets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteBudget(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // Savings Goals
  app.get("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goals = await storage.getSavingsGoals(userId);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch savings goals" });
    }
  });

  app.post("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goal = insertSavingsGoalSchema.parse(req.body);
      const created = await storage.createSavingsGoal(userId, goal);
      res.status(201).json(created);
    } catch (error) {
      console.error("Goal creation error:", error);
      res.status(400).json({ message: "Invalid savings goal data", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put("/api/goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      // Validate the update data using the same schema
      const validatedData = insertSavingsGoalSchema.parse(req.body);
      const updated = await storage.updateSavingsGoal(userId, id, validatedData);
      res.json(updated);
    } catch (error) {
      console.error("Goal update error:", error);
      res.status(400).json({ message: "Failed to update savings goal", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteSavingsGoal(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete savings goal" });
    }
  });

  // Loans routes
  app.get("/api/loans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const loans = await storage.getLoans(userId);
      res.json(loans);
    } catch (error) {
      console.error("Error fetching loans:", error);
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  app.post("/api/loans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const loan = await storage.createLoan(userId, req.body);
      res.json(loan);
    } catch (error) {
      console.error("Error creating loan:", error);
      res.status(500).json({ message: "Failed to create loan" });
    }
  });

  app.put("/api/loans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const loan = await storage.updateLoan(userId, id, req.body);
      res.json(loan);
    } catch (error) {
      console.error("Error updating loan:", error);
      res.status(500).json({ message: "Failed to update loan" });
    }
  });

  app.delete("/api/loans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteLoan(userId, id);
      res.json({ message: "Loan deleted successfully" });
    } catch (error) {
      console.error("Error deleting loan:", error);
      res.status(500).json({ message: "Failed to delete loan" });
    }
  });

  app.get("/api/loans/:id/interest", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const loan = await storage.getLoan(userId, id);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      const interestData = await storage.calculateLoanInterest(loan);
      res.json(interestData);
    } catch (error) {
      console.error("Error calculating loan interest:", error);
      res.status(500).json({ message: "Failed to calculate loan interest" });
    }
  });

  // Financial Summary
  app.get("/api/financial-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summary = await storage.getFinancialSummary(userId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
