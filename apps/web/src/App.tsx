import { useQueryClient } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { RouterProvider } from "react-router";
import { useAuthSession } from "./hooks/useAuthSession";
import { createAppRouter } from "./routes/router";

export function App(): React.ReactElement {
  const auth = useAuthSession();
  const queryClient = useQueryClient();
  const router = useMemo(() => createAppRouter(auth, queryClient), [auth, queryClient]);

  return <RouterProvider router={router} />;
}

export default App;
