import React, { useState } from "react";
import { useAuthSession } from "./hooks/useAuthSession";
import { PlanCycleDetailServerScreen } from "./screens/PlanCycleDetailScreen";
import { PlanCycleQueueServerScreen } from "./screens/PlanCycleQueueScreen";
import { SignInScreen } from "./screens/SignInScreen";

export function App(): React.ReactElement {
  const auth = useAuthSession();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  if (!auth.authenticated) {
    return <SignInScreen auth={auth} />;
  }

  const activeRole = auth.user?.role === "Firm Admin" ? "Firm Admin View" : "Advisor View";

  if (selectedCycleId) {
    return (
      <PlanCycleDetailServerScreen
        auth={auth}
        caseId={selectedCycleId}
        onBack={() => setSelectedCycleId(null)}
        onLogout={auth.logout}
      />
    );
  }

  return (
    <PlanCycleQueueServerScreen
      activeRole={activeRole}
      auth={auth}
      onLogout={auth.logout}
      onSelectCycle={setSelectedCycleId}
    />
  );
}

export default App;
