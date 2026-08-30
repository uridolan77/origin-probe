import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

vi.mock("@/lib/measurement", () => ({
  createSignedShare: vi.fn(),
  measurementEnabled: vi.fn(),
  reportShareArrival: vi.fn(),
}));

vi.mock("@/lib/share", async () => {
  const actual = await vi.importActual<typeof import("@/lib/share")>(
    "@/lib/share",
  );
  return {
    ...actual,
    copyLink: vi.fn(),
    nativeShare: vi.fn(),
  };
});

import { ShareActions } from "@/components/ShareActions";
import {
  createSignedShare,
  measurementEnabled,
  reportShareArrival,
} from "@/lib/measurement";
import { copyLink, nativeShare } from "@/lib/share";

const SLUG = "culture-eats-strategy-for-breakfast";
const INBOUND_TOKEN =
  "eyJ2IjoyLCJydW5JZCI6IkdSVC1JTkJPVU5EIn0.inbound_signature_x";
const OUTBOUND_TOKEN = `eyJ2IjoyLCJydW5JZCI6IkdSVC1PVVRCT1VORCJ9.${"s".repeat(512)}`;

describe("ShareActions token lineage", () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      "",
      `/g/${SLUG}/?s=${encodeURIComponent(INBOUND_TOKEN)}`,
    );
    vi.mocked(measurementEnabled).mockReset().mockReturnValue(true);
    vi.mocked(createSignedShare).mockReset().mockResolvedValue(OUTBOUND_TOKEN);
    vi.mocked(reportShareArrival).mockReset().mockResolvedValue(undefined);
    vi.mocked(copyLink).mockReset().mockResolvedValue(true);
    vi.mocked(nativeShare).mockReset().mockResolvedValue("shared");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("consumes the inbound token once and caches a fresh outbound token", async () => {
    const firstMount = render(
      <StrictMode>
        <ShareActions slug={SLUG} phrase="Culture eats strategy for breakfast" />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(reportShareArrival).toHaveBeenCalledTimes(1);
    });
    expect(reportShareArrival).toHaveBeenCalledWith(SLUG, INBOUND_TOKEN);

    firstMount.unmount();
    render(<ShareActions slug={SLUG} phrase="Culture eats strategy for breakfast" />);
    expect(reportShareArrival).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Link copied.");
    });

    expect(createSignedShare).toHaveBeenCalledTimes(1);
    expect(createSignedShare).toHaveBeenCalledWith(SLUG, false);
    expect(copyLink).toHaveBeenCalledTimes(1);
    const copiedUrl = vi.mocked(copyLink).mock.calls[0]?.[0];
    expect(copiedUrl).toBeDefined();
    expect(new URL(copiedUrl as string).searchParams.get("s")).toBe(
      OUTBOUND_TOKEN,
    );
    expect(copiedUrl).not.toContain(INBOUND_TOKEN);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Shared.");
    });

    expect(createSignedShare).toHaveBeenCalledTimes(1);
    expect(nativeShare).toHaveBeenCalledTimes(1);
    expect(vi.mocked(nativeShare).mock.calls[0]?.[0].url).toBe(copiedUrl);
    expect(reportShareArrival).toHaveBeenCalledTimes(1);
  });

  it("does not let a stale in-flight mint poison the next slug cache", async () => {
    let resolveFirst!: (token: string | null) => void;
    let resolveSecond!: (token: string | null) => void;
    vi.mocked(createSignedShare).mockImplementation(
      (requestedSlug) =>
        new Promise((resolve) => {
          if (requestedSlug === "first-slug") resolveFirst = resolve;
          else resolveSecond = resolve;
        }),
    );
    window.history.replaceState({}, "", "/g/first-slug/");

    const { rerender } = render(
      <ShareActions slug="first-slug" phrase="First phrase" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => {
      expect(createSignedShare).toHaveBeenCalledWith("first-slug", false);
    });

    rerender(<ShareActions slug="second-slug" phrase="Second phrase" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => {
      expect(createSignedShare).toHaveBeenCalledWith("second-slug", false);
    });

    await act(async () => {
      resolveFirst("first_payload_x.first_signature");
    });
    expect(copyLink).not.toHaveBeenCalled();

    await act(async () => {
      resolveSecond("second_payload.second_signature");
    });
    await waitFor(() => {
      expect(copyLink).toHaveBeenCalledTimes(1);
    });
    const secondUrl = vi.mocked(copyLink).mock.calls[0]?.[0];
    expect(new URL(secondUrl as string).searchParams.get("s")).toBe(
      "second_payload.second_signature",
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => {
      expect(nativeShare).toHaveBeenCalledTimes(1);
    });
    expect(createSignedShare).toHaveBeenCalledTimes(2);
    expect(vi.mocked(nativeShare).mock.calls[0]?.[0].url).toBe(secondUrl);
  });

  it("bounds remembered inbound arrivals while still deduplicating remounts", () => {
    const baseToken = "base.sig_base";
    const mountArrival = (token: string) => {
      window.history.replaceState(
        {},
        "",
        `/g/${SLUG}/?s=${encodeURIComponent(token)}`,
      );
      const mounted = render(
        <ShareActions slug={SLUG} phrase="Culture eats strategy for breakfast" />,
      );
      mounted.unmount();
    };

    mountArrival(baseToken);
    for (let index = 0; index < 129; index += 1) {
      const body = index.toString(36).padStart(4, "0");
      mountArrival(`${body}.sig00000`);
    }
    mountArrival(baseToken);

    const baseReports = vi
      .mocked(reportShareArrival)
      .mock.calls.filter(([, token]) => token === baseToken);
    expect(baseReports).toHaveLength(2);
  });
});
