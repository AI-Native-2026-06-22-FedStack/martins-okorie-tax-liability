import React from "react";
import { useAuthSession } from "./hooks/useAuthSession";
import { PlanCycleQueueScreen } from "./screens/PlanCycleQueueScreen";
import { SignInScreen } from "./screens/SignInScreen";

export function App(): React.ReactElement {
  const auth = useAuthSession();

  if (!auth.authenticated) {
    return <SignInScreen auth={auth} />;
  }

  return (
    <PlanCycleQueueScreen
      activeRole={auth.user?.role === "Firm Admin" ? "Firm Admin View" : "Advisor View"}
      onLogout={auth.logout}
    />
  );
}

export default App;
