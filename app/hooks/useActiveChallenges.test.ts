import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("~/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
}));

import { onSnapshot } from "firebase/firestore";
import { useActiveChallenges } from "./useActiveChallenges";

describe("useActiveChallenges", () => {
  beforeEach(() => {
    vi.mocked(onSnapshot).mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls onSnapshot once on mount", () => {
    renderHook(() => useActiveChallenges());
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it("calls the unsubscribe function exactly once on unmount", () => {
    const unsubSpy = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(unsubSpy);

    const { unmount } = renderHook(() => useActiveChallenges());
    expect(unsubSpy).not.toHaveBeenCalled();

    unmount();
    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });
});
