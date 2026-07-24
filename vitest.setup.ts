import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React 19 + Testing Library requires this flag to be set explicitly;
// without it, state updates during tests emit "not wrapped in act(...)"
// warnings and can be missed by waitFor/act.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Vitest does not auto-unmount React Testing Library renders between
// tests the way some other runners do — without this, DOM nodes from one
// test's render() leak into the next test's queries.
afterEach(() => {
  cleanup();
});
