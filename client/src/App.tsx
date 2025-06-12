import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StorageProvider, useCombinedAuth } from "@/providers/StorageProvider";
import { StorageToggle } from "@/components/StorageToggle";
import Home from "@/pages/home";
import Transactions from "@/pages/transactions";
import Budgets from "@/pages/budgets";
import Goals from "@/pages/goals";
import Reports from "@/pages/reports";
import Other from "@/pages/other";
import Calendar from "@/pages/calendar";
import Landing from "@/pages/landing";


function Router() {
  const { isAuthenticated, isLoading } = useCombinedAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="*" component={Landing} />
      ) : (
        <>
          <div className="fixed top-4 right-4 z-50">
            <StorageToggle />
          </div>
          <Route path="/" component={Home} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/budgets" component={Budgets} />
          <Route path="/goals" component={Goals} />
          <Route path="/reports" component={Reports} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/other" component={Other} />
          <Route path="*">
            {() => <Home />}
          </Route>
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <StorageProvider>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </StorageProvider>
  );
}

export default App;
