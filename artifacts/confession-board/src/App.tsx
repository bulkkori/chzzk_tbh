import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Select from "@/pages/select";
import Register from "@/pages/register";
import Home from "@/pages/home";
import Write from "@/pages/write";
import Post from "@/pages/post";
import Edit from "@/pages/edit";
import Admin from "@/pages/admin";
import Login from "@/pages/login";
import GlobalLogin from "@/pages/global-login";
import AuthCallback from "@/pages/auth-callback";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Select} />
      <Route path="/register" component={Register} />
      <Route path="/s/:channelId" component={Home} />
      <Route path="/s/:channelId/write" component={Write} />
      <Route path="/s/:channelId/post/:id" component={Post} />
      <Route path="/s/:channelId/post/:id/edit" component={Edit} />
      <Route path="/s/:channelId/admin" component={Admin} />
      <Route path="/s/:channelId/login" component={Login} />
      <Route path="/login" component={GlobalLogin} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="bloom-bg" />
            <SiteHeader />
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
