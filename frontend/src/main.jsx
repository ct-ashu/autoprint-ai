import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App.jsx";
import "./styles.css";
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
    <Toaster position="bottom-right" richColors closeButton />
  </BrowserRouter>,
);
