import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement ResizeObserver, which recharts (and several Radix
// primitives the dashboard tree pulls in) require.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;

// Recharts' ResponsiveContainer measures via getBoundingClientRect; jsdom
// returns zeros, which suppresses the chart entirely. We don't need pixel-
// perfect charts in unit tests, so providing a non-zero size is enough.
const originalGetBCR = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function () {
  const rect = originalGetBCR.call(this);
  if (rect.width === 0 && rect.height === 0) {
    return { ...rect, width: 800, height: 200, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 200, toJSON: () => ({}) };
  }
  return rect;
};
