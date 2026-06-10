import React from "react";
import ReactDOM from "react-dom/client";
import { IconContext } from "@phosphor-icons/react";
import { MotionConfig, LazyMotion } from "framer-motion";
import App from "./App.jsx";
import "./index.css";

// Feature set is loaded ASYNC (separate chunk, after first paint) so the heavy
// Framer feature bundle never blocks initial render. See ./lib/motion-features.
const loadMotionFeatures = () => import("./lib/motion-features.js").then((m) => m.default);

// One global icon style — bold Phosphor marks (distinct from default Lucide).
// MotionConfig reducedMotion="user" makes EVERY framer-motion animation honor the
// OS "reduce motion" setting (count-ups, meters, page/tab transitions, hovers).
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: "regular", mirrored: false }}>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={loadMotionFeatures} strict>
          <App />
        </LazyMotion>
      </MotionConfig>
    </IconContext.Provider>
  </React.StrictMode>
);
