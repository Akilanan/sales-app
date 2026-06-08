// Async-loaded Framer Motion feature set. LazyMotion imports this AFTER first
// paint, so the heavy feature bundle never blocks initial render on a shop-floor
// tablet. domMax (not domAnimation) because we use layoutId layout animations
// (the nav underline + the wordmark fly).
import { domMax } from "framer-motion";

export default domMax;
