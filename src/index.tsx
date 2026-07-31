import React from "react";
import ReactDOM from "react-dom/client";
import "./global.css";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ApiKeyProvider } from "./contexts/ApiKeyContext";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <AuthProvider>
    <ApiKeyProvider>
      <App />
    </ApiKeyProvider>
  </AuthProvider>
);
