import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <p className="mt-4 text-muted-foreground">This page does not exist.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl">Something broke</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tritone — AI Stock & Chart Analyzer" },
      { name: "description", content: "Multi-asset analyzer with 40+ technical patterns and three layers of AI confirmation." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function NavBar() {
  const { user } = useAuth();
  return (
    <header className="border-b border-border/60 backdrop-blur sticky top-0 z-50 bg-background/80">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        <Link to="/" className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary inline-block" /> Tritone
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link to="/analyze" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Analyze</Link>
              <Link to="/history" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>History</Link>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                className="text-muted-foreground hover:text-foreground"
              >Sign out</button>
            </>
          ) : (
            <Link to="/login" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground font-medium">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavBar />
        <Outlet />
        <Toaster theme="dark" position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
