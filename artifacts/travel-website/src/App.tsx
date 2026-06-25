import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import Search from "./pages/search";
import HotelDetail from "./pages/hotel-detail";
import Reservation from "./pages/reservation";
import Login from "./pages/login";
import AdminDashboard from "./pages/admin-dashboard";
import AgentDashboard from "./pages/agent-dashboard";
import { Navbar } from "./components/layout/navbar";
import { Footer } from "./components/layout/footer";
import { AuthProvider } from "./hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/reservation/:id">
        {(params) => <Reservation />}
      </Route>
      <Route>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/login" component={Login} />
              <Route path="/admin/dashboard" component={AdminDashboard} />
              <Route path="/agent/dashboard" component={AgentDashboard} />
              <Route path="/search" component={Search} />
              <Route path="/hotel/:id" component={HotelDetail} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <Footer />
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

