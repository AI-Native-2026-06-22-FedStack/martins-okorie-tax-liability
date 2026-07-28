import { QueryClient } from "@tanstack/react-query";
import React from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useRouteError,
} from "react-router";
import { QueueError } from "../atoms/QueueStates";
import { AppShell } from "../components/AppShell";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import { Dashboard } from "../screens/Dashboard";
import { PlanCycleDetailServerContent } from "../screens/PlanCycleDetailScreen";
import { PlanCycleQueueServerContent } from "../screens/PlanCycleQueueScreen";
import { ScenarioPlannerForm } from "../screens/ScenarioPlannerForm";
import { ScenarioResultsTable } from "../screens/ScenarioResultsTable";
import { SignInScreen } from "../screens/SignInScreen";
import { RequireAuth } from "./RequireAuth";

export type AppRouter = ReturnType<typeof createBrowserRouter>;

type WorkspaceLayoutProps = {
  auth: AuthSessionReturn;
  queryClient: QueryClient;
};

function activeRole(auth: AuthSessionReturn): "Advisor View" | "Firm Admin View" {
  return auth.user?.role === "Firm Admin" ? "Firm Admin View" : "Advisor View";
}

function routeTitle(pathname: string, caseId?: string): string {
  if (pathname.startsWith("/dashboard")) {
    return "Dashboard";
  }

  if (pathname.startsWith("/cycles/")) {
    if (pathname === "/cycles/results") {
      return "Scenario Results";
    }

    if (pathname === "/cycles/new") {
      return "New Plan Cycle";
    }

    return `Case Detail: ${caseId ?? "Loading"}`;
  }

  return "Plan Cycle Queue";
}

function activeItemId(pathname: string): string {
  if (pathname.startsWith("/dashboard")) {
    return "dashboard";
  }

  return "queue";
}

export function WorkspaceLayout({
  auth,
  queryClient,
}: WorkspaceLayoutProps): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  const handleLogout = () => {
    queryClient.clear();
    auth.logout();
  };

  const handleSelectNav = (id: string) => {
    if (id === "dashboard") {
      navigate("/dashboard");
      return;
    }

    if (id === "queue") {
      navigate("/cycles");
    }
  };

  return (
    <AppShell
      activeItemId={activeItemId(location.pathname)}
      activeRole={activeRole(auth)}
      onLogout={handleLogout}
      onSelectNav={handleSelectNav}
      title={routeTitle(location.pathname, params.caseId)}
    >
      <Outlet />
    </AppShell>
  );
}

export function WorkspaceRouteError({
  auth,
  queryClient,
}: WorkspaceLayoutProps): React.ReactElement {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : "The workspace could not load this route.";

  const handleLogout = () => {
    queryClient.clear();
    auth.logout();
  };

  return (
    <AppShell
      activeRole={activeRole(auth)}
      onLogout={handleLogout}
      title="Workspace Error"
    >
      <QueueError message={message} />
    </AppShell>
  );
}

function LoginRoute({ auth }: { auth: AuthSessionReturn }): React.ReactElement {
  if (auth.authenticated) {
    return <Navigate to="/cycles" replace />;
  }

  return <SignInScreen auth={auth} />;
}

function RootRedirect({ auth }: { auth: AuthSessionReturn }): React.ReactElement {
  return <Navigate to={auth.authenticated ? "/cycles" : "/login"} replace />;
}

function PlanCycleQueueRoute({ auth }: { auth: AuthSessionReturn }): React.ReactElement {
  const navigate = useNavigate();

  return (
    <PlanCycleQueueServerContent
      auth={auth}
      onCreateCycle={() => navigate("/cycles/new")}
      onSelectCycle={(cycleId) => navigate(`/cycles/${cycleId}`)}
    />
  );
}

function PlanCycleDetailRoute({ auth }: { auth: AuthSessionReturn }): React.ReactElement {
  const navigate = useNavigate();
  const { caseId } = useParams();

  return (
    <PlanCycleDetailServerContent
      auth={auth}
      caseId={caseId ?? null}
      onBack={() => navigate("/cycles")}
    />
  );
}

function ScenarioPlannerRoute({ auth }: { auth: AuthSessionReturn }): React.ReactElement {
  const navigate = useNavigate();

  return <ScenarioPlannerForm auth={auth} onCreated={(cycleId) => navigate(`/cycles/${cycleId}`)} />;
}

function ScenarioResultsRoute({ auth }: { auth: AuthSessionReturn }): React.ReactElement {
  const navigate = useNavigate();

  return (
    <ScenarioResultsTable
      auth={auth}
      onEditRow={(cycleId) => navigate(`/cycles/${cycleId}`)}
      onOpenRow={(cycleId) => navigate(`/cycles/${cycleId}`)}
      onRemoveRow={() => undefined}
    />
  );
}

export function createAppRouter(
  auth: AuthSessionReturn,
  queryClient: QueryClient
): AppRouter {
  return createBrowserRouter([
    {
      element: <RootRedirect auth={auth} />,
      path: "/",
    },
    {
      element: <LoginRoute auth={auth} />,
      path: "/login",
    },
    {
      element: <RequireAuth auth={auth} />,
      children: [
        {
          element: <WorkspaceLayout auth={auth} queryClient={queryClient} />,
          errorElement: <WorkspaceRouteError auth={auth} queryClient={queryClient} />,
          children: [
            {
              element: <Dashboard auth={auth} />,
              path: "/dashboard",
            },
            {
              element: <PlanCycleQueueRoute auth={auth} />,
              path: "/cycles",
            },
            {
              element: <ScenarioPlannerRoute auth={auth} />,
              path: "/cycles/new",
            },
            {
              element: <ScenarioResultsRoute auth={auth} />,
              path: "/cycles/results",
            },
            {
              element: <PlanCycleDetailRoute auth={auth} />,
              path: "/cycles/:caseId",
            },
          ],
        },
      ],
    },
  ]);
}
