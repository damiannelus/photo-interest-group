import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("~/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  getCountFromServer: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
  onSnapshot: vi.fn(),
}));

import { onSnapshot } from "firebase/firestore";
import { useComments } from "./useComments";

describe("useComments", () => {
  beforeEach(() => {
    vi.mocked(onSnapshot).mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not call onSnapshot when commentOpen is false", () => {
    renderHook(() => useComments("sub-1", false));
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("calls onSnapshot when commentOpen is true", () => {
    renderHook(() => useComments("sub-1", true));
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it("calls the unsubscribe function on unmount when hook was open", () => {
    const unsubSpy = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(unsubSpy);

    const { unmount } = renderHook(() => useComments("sub-1", true));
    expect(unsubSpy).not.toHaveBeenCalled();

    unmount();
    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });

  it("calls the unsubscribe function when commentOpen changes from true to false", () => {
    const unsubSpy = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(unsubSpy);

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useComments("sub-1", open),
      { initialProps: { open: true } }
    );
    expect(unsubSpy).not.toHaveBeenCalled();

    rerender({ open: false });
    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });
});
