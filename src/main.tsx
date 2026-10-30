import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Prevent generic Edge / browser right-click context menu throughout the app
window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
