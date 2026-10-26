import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
import "../src/theme/tokens/mono.light.css";
import { App } from "./App.js";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
