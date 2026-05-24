import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { MockAuthProvider } from "./auth/MockAuthProvider";
import { createQueryClient } from "./lib/queryClient";
import "./index.css";

const queryClient = createQueryClient();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
