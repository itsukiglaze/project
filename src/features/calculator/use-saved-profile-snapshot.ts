"use client";

import { useEffect, useRef, useState } from "react";
import type { BannerFamily } from "@/config/gacha";
import {
  fetchAllBannerStates,
  fetchResourceSnapshot,
  type VersionedBannerStateSnapshot,
  type VersionedResourceSnapshot,
} from "@/features/profile/api";

/**
 * Read-only fetch of the user's saved resource/pity values, purely for
 * DISPLAY in the calculator's "saved data" summaries (requirement: show
 * the actual saved values being used, and never silently treat
 * "unavailable" as zero). This is entirely separate from
 * `useCalculatorForm`'s own submission flow — it never calls
 * `POST /api/calculator` and has no bearing on what that hook sends; it
 * only reads the same `GET /api/resources` / `GET /api/banner-states`
 * endpoints the Settings page already uses (`features/profile/api.ts`,
 * unmodified). No new API routes, no new DTOs.
 *
 * `version === 0` is this API's own existing signal for "no real row
 * exists yet" (see EMPTY_VERSIONED_SNAPSHOT / DEFAULT_STATE server-side)
 * — used here to distinguish "genuinely saved as zero" from "never saved
 * at all", so the UI can show the honest fallback instead of a
 * zero-filled summary that looks like real data.
 */

export type SavedResourceState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "unavailable" }
  | { status: "available"; snapshot: VersionedResourceSnapshot };

export type SavedPityState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "unavailable" }
  | { status: "available"; snapshot: VersionedBannerStateSnapshot };

export interface SavedProfileSnapshot {
  resources: SavedResourceState;
  getPity: (family: BannerFamily) => SavedPityState;
}

/**
 * `enabled` gates the actual fetches — pass `useAuth().status === "authenticated"`.
 * The bottom nav (and so a route change to /calculator) is reachable
 * while AuthProvider's own bootstrap is still in flight (it's rendered
 * as a sibling of the page content, not blocked by the home page's own
 * loading skeleton), so firing these requests unconditionally on mount
 * can race the session cookie being set and come back 401 — which, with
 * no distinct handling, would look identical to "genuinely unavailable"
 * and show the wrong fallback. Staying in "loading" until the caller
 * confirms auth is ready avoids that false negative entirely, rather
 * than working around it with a retry.
 */
export function useSavedProfileSnapshot(enabled: boolean): SavedProfileSnapshot {
  const [resources, setResources] = useState<SavedResourceState>({ status: "loading" });
  const [bannerStates, setBannerStates] = useState<
    Map<BannerFamily, VersionedBannerStateSnapshot> | "loading" | "error"
  >("loading");
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    cancelledRef.current = false;

    fetchResourceSnapshot().then((result) => {
      if (cancelledRef.current) return;
      if (result.status !== "success") {
        setResources({ status: "error" });
        return;
      }
      setResources(
        result.data.version === 0
          ? { status: "unavailable" }
          : { status: "available", snapshot: result.data },
      );
    });

    fetchAllBannerStates().then((result) => {
      if (cancelledRef.current) return;
      if (result.status !== "success") {
        setBannerStates("error");
        return;
      }
      const map = new Map<BannerFamily, VersionedBannerStateSnapshot>();
      for (const entry of result.data.bannerStates) {
        map.set(entry.family, entry);
      }
      setBannerStates(map);
    });

    return () => {
      cancelledRef.current = true;
    };
  }, [enabled]);

  const getPity = (family: BannerFamily): SavedPityState => {
    if (bannerStates === "loading") return { status: "loading" };
    if (bannerStates === "error") return { status: "error" };
    const entry = bannerStates.get(family);
    if (!entry || entry.version === 0) return { status: "unavailable" };
    return { status: "available", snapshot: entry };
  };

  return { resources, getPity };
}
