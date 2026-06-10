// Minimal class-name joiner (stand-in for clsx + tailwind-merge). The pasted
// shadcn components call cn(); we control their class sets, so a filtered join is
// sufficient and avoids adding clsx/tailwind-merge deps.
export function cn(...inputs) {
  return inputs.flat(Infinity).filter(Boolean).join(" ");
}
