import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./utils/leafletSetup";
import App from "./App";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { hydrateCache } from "./utils/storage";

const root = ReactDOM.createRoot(document.getElementById("root"));

async function init() {
  try {
    await hydrateCache();
  } catch (err) {
    console.error("Failed to hydrate cache on startup:", err);
  }
  root.render(
    <React.StrictMode>
      <GoogleOAuthProvider clientId="562251581550-be0h2rg21ahk8e45vc93hpsvaub0ptlb.apps.googleusercontent.com">
        <App />
      </GoogleOAuthProvider>
    </React.StrictMode>
  );
}

init();

