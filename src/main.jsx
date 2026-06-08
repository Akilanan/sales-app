import React from "react";
import ReactDOM from "react-dom/client";
import { IconContext } from "@phosphor-icons/react";
import { MotionConfig } from "framer-motion";
import App from "./App.jsx";
import Cursor from "./lib/Cursor.jsx";
import "./index.css";

// One global icon style — bold Phosphor marks (distinct from default Lucide).
// MotionConfig reducedMotion="user" makes EVERY framer-motion animation honor the
// OS "reduce motion" setting (count-ups, meters, page/tab transitions, hovers).
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: "bold", mirrored: false }}>
      <MotionConfig reducedMotion="user">
        <App />
        <Cursor />
      </MotionConfig>
    </IconContext.Provider>
  </React.StrictMode>
);
