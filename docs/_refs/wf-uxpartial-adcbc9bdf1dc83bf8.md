Login screen loaded. Let me test the wrong-PIN path first to check error feedback.

---

Wrong PIN shows "Invalid PIN. Try 1001, 1002 or 1003." and clears the field. Let me screenshot the error state, then do the real login with timing.

---

Still on login after 8s. Let me snapshot to see what state the form is in.

---

PIN has 4 digits entered; the earlier submit fired before state settled. Clicking Enter PIN now with timing.

---

Login took ~1.5s and operators land directly on Shift Entry. Let me screenshot and check the nav.

---

The qty value reads "1" â€” the fill may have been clamped or only partially registered. Let me inspect current state and recent entries.

---

No new entry appeared and no feedback fired. Let me check the console, then retry with a proper React-aware value set.

---

JS .click() produced zero DOM change. Let me check the button state and try a real CDP click.

---

Data layer is local (demo). Let me check localStorage for ground truth on whether the entries saved.
