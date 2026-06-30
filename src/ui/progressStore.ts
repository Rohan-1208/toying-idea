// Minimal external store to share scroll progress between the R3F canvas and
// the fixed HTML chrome, without re-rendering the 3D tree.

let offset = 0;
const listeners = new Set<() => void>();

export const progressStore = {
  set(next: number) {
    // Throttle notifications to meaningful changes to limit React re-renders.
    if (Math.abs(next - offset) < 0.004) return;
    offset = next;
    listeners.forEach((l) => l());
  },
  get() {
    return offset;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
