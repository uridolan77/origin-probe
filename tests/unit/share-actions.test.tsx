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

import {
  resetShareActionSessionForTests,
  ShareActions,
} from "@/components/ShareActions";
import {
  createSignedShare,
  measurementEnabled,
  reportShareArrival,
} from "@/lib/measurement";
import { copyLink, nativeShare } from "@/lib/share";

const SLUG = "culture-eats-strategy-for-breakfast";
const TEST_SIGNATURE = Buffer.alloc(32, 0x73).toString("base64url");
const testToken = (label: string, seed = false) =>
  `${Buffer.from(
    JSON.stringify({ v: 2, runId: "G2R-TEST", label, seed }),
    "utf8",
  ).toString("base64url")}.${TEST_SIGNATURE}`;
const INBOUND_TOKEN = testToken("operator-seed", true);
const OUTBOUND_TOKEN = testToken("ordinary-outbound", false);

function maximumLengthToken(): string {
  const payload = {
    v: 2,
    runId: "ORIGIN-G2-PUBLIC-PROBE-AUTH-002",
    slug: SLUG,
    creatorHash: "c".repeat(64),
    seed: false,
    iat: 1_788_091_200,
    exp: 1_789_300_800,
    nonce: "",
  };
  const targetPayloadBytes = 3039;
  payload.nonce = "n".repeat(
    targetPayloadBytes - Buffer.byteLength(JSON.stringify(payload), "utf8"),
  );
  return `${Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  )}.${TEST_SIGNATURE}`;
}

describe("ShareActions token lineage", () => {
  beforeEach(() => {
    resetShareActionSessionForTests();
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
    const remounted = render(
      <ShareActions slug={SLUG} phrase="Culture eats strategy for breakfast" />,
    );
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

    remounted.unmount();
    render(<ShareActions slug={SLUG} phrase="Culture eats strategy for breakfast" />);
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
      resolveFirst(testToken("first"));
    });
    expect(copyLink).not.toHaveBeenCalled();

    await act(async () => {
      resolveSecond(testToken("second"));
    });
    await waitFor(() => {
      expect(copyLink).toHaveBeenCalledTimes(1);
    });
    const secondUrl = vi.mocked(copyLink).mock.calls[0]?.[0];
    expect(new URL(secondUrl as string).searchParams.get("s")).toBe(
      testToken("second"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => {
      expect(nativeShare).toHaveBeenCalledTimes(1);
    });
    expect(createSignedShare).toHaveBeenCalledTimes(2);
    expect(vi.mocked(nativeShare).mock.calls[0]?.[0].url).toBe(secondUrl);
  });

  it("consumes an inbound token once across many arrivals and slug rerenders", () => {
    const baseToken = testToken("base");
    const mountArrival = (token: string, slug = SLUG) => {
      window.history.replaceState(
        {},
        "",
        `/g/${slug}/?s=${encodeURIComponent(token)}`,
      );
      const mounted = render(
        <ShareActions slug={slug} phrase="Culture eats strategy for breakfast" />,
      );
      mounted.unmount();
    };

    mountArrival(baseToken);
    for (let index = 0; index < 129; index += 1) {
      mountArrival(testToken(`arrival-${index}`));
    }
    mountArrival(baseToken, "another-slug");

    const baseReports = vi
      .mocked(reportShareArrival)
      .mock.calls.filter(([, token]) => token === baseToken);
    expect(baseReports).toHaveLength(1);
  });

  it("fails closed when measurement is unavailable", async () => {
    vi.mocked(measurementEnabled).mockReturnValue(false);
    window.history.replaceState({}, "", `/g/${SLUG}/`);
    render(<ShareActions slug={SLUG} phrase="Culture eats strategy for breakfast" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "Sharing is unavailable while measurement is offline.",
      );
    });
    expect(createSignedShare).not.toHaveBeenCalled();
    expect(copyLink).not.toHaveBeenCalled();
    expect(nativeShare).not.toHaveBeenCalled();
  });

  it("coalesces concurrent Copy and Share into one issuance", async () => {
    let resolveToken!: (token: string | null) => void;
    vi.mocked(createSignedShare).mockImplementation(
      () => new Promise((resolve) => (resolveToken = resolve)),
    );
    window.history.replaceState({}, "", `/g/${SLUG}/`);
    render(<ShareActions slug={SLUG} phrase="Culture eats strategy for breakfast" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(createSignedShare).toHaveBeenCalledTimes(1));

    await act(async () => resolveToken(OUTBOUND_TOKEN));
    await waitFor(() => {
      expect(copyLink).toHaveBeenCalledTimes(1);
      expect(nativeShare).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(nativeShare).mock.calls[0]?.[0].url).toBe(
      vi.mocked(copyLink).mock.calls[0]?.[0],
    );
  });

  it("preserves a complete 4096-character API token through Copy", async () => {
    const token = maximumLengthToken();
    expect(token).toHaveLength(4096);
    vi.mocked(createSignedShare).mockResolvedValue(token);
    window.history.replaceState({}, "", `/g/${SLUG}/`);
    render(<ShareActions slug={SLUG} phrase="Culture eats strategy for breakfast" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(copyLink).toHaveBeenCalledTimes(1));
    const copiedUrl = vi.mocked(copyLink).mock.calls[0]?.[0];
    expect(new URL(copiedUrl as string).searchParams.get("s")).toBe(token);
  });

  it("rejects a malformed API token before Copy or Share", async () => {
    vi.mocked(createSignedShare).mockResolvedValue("AB.AA");
    window.history.replaceState({}, "", `/g/${SLUG}/`);
    render(<ShareActions slug={SLUG} phrase="Culture eats strategy for breakfast" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "Could not create share token.",
      );
    });
    expect(copyLink).not.toHaveBeenCalled();
    expect(nativeShare).not.toHaveBeenCalled();
  });
});
