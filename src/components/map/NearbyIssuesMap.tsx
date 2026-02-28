"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapComplaint {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  category: string | null;
  latitude: number;
  longitude: number;
  address_landmark: string;
  created_at: string;
}

export interface NearbyIssuesMapProps {
  /**
   * "citizen" → 500 m radius around the user's geolocation.
   * "admin"   → all department complaints, no radius cap.
   */
  mode: "citizen" | "admin";
  /** Pass the department UUID when mode === "admin". */
  departmentId?: string | null;
  /** CSS height string for the map container. Default "420px". */
  height?: string;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CITIZEN_RADIUS_M = 500;
const RADIUS_SOURCE_ID = "user-radius";
const RADIUS_FILL_LAYER = "radius-fill";
const RADIUS_BORDER_LAYER = "radius-border";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Hex colour keyed on complaint status + priority. */
function markerColor(status: string, priority: string | null): string {
  if (status === "resolved") return "#16a34a";
  if (status === "rejected") return "#6b7280";
  if (priority === "critical") return "#dc2626";
  if (priority === "high") return "#f97316";
  if (status === "in_progress") return "#2563eb";
  return "#ca8a04"; // open / default → amber
}

/**
 * Creates a 20×20 px DOM element containing an inline SVG circle marker.
 * High-priority open/in-progress complaints get an animated pulse ring.
 */
function buildMarkerEl(color: string, pulse: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "width:20px;height:20px;cursor:pointer";

  const ring = pulse
    ? `<circle cx="10" cy="10" r="9" fill="none" stroke="${color}" stroke-width="2" opacity="0.45">
         <animate attributeName="r"       values="9;16;9"      dur="2s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.45;0;0.45" dur="2s" repeatCount="indefinite"/>
       </circle>`
    : "";

  wrap.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
         viewBox="0 0 20 20" style="overflow:visible;display:block">
      ${ring}
      <circle cx="10" cy="10" r="7" fill="${color}" stroke="white" stroke-width="2.5"/>
    </svg>`;

  return wrap;
}

/** HTML string rendered inside a MapTiler Popup. */
function buildPopupHtml(c: MapComplaint): string {
  const color = markerColor(c.status, c.priority);
  const statusLabel = c.status.replace(/_/g, " ");
  const date = new Date(c.created_at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const pill = (bg: string, text: string) =>
    `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:99px;font-size:11px;white-space:nowrap">${text}</span>`;
  const grayPill = (text: string) =>
    `<span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:99px;font-size:11px;white-space:nowrap">${text}</span>`;

  const pills = [
    pill(color, statusLabel),
    c.priority ? grayPill(c.priority) : "",
    c.category ? grayPill(c.category) : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <div style="min-width:190px;max-width:260px;font-family:system-ui,-apple-system,sans-serif;line-height:1.45">
      <p style="font-weight:600;font-size:13px;margin:0 0 3px">${c.title}</p>
      <p style="font-size:11px;color:#6b7280;margin:0 0 8px">${c.address_landmark}</p>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px">${pills}</div>
      <p style="font-size:10px;color:#9ca3af;margin:0">${date}</p>
    </div>`;
}

/**
 * Generates a GeoJSON Polygon that approximates a circle.
 * Coordinates follow GeoJSON convention: [longitude, latitude].
 */
function makeCircleGeoJSON(lat: number, lng: number, radiusM: number) {
  const N = 64;
  const coords: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const angle = (2 * Math.PI * i) / N;
    const dLng =
      (radiusM * Math.cos(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
    const dLat = (radiusM * Math.sin(angle)) / 110_540;
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [coords],
    },
    properties: {},
  };
}

/**
 * Adds (or refreshes) the 500 m radius GeoJSON source + fill + border layers.
 * Safe to call after a style reload — checks for existing source/layer first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyRadiusLayers(map: any, lat: number, lng: number) {
  const data = makeCircleGeoJSON(lat, lng, CITIZEN_RADIUS_M);

  if (map.getSource(RADIUS_SOURCE_ID)) {
    map.getSource(RADIUS_SOURCE_ID).setData(data);
  } else {
    map.addSource(RADIUS_SOURCE_ID, { type: "geojson", data });
  }

  if (!map.getLayer(RADIUS_FILL_LAYER)) {
    map.addLayer({
      id: RADIUS_FILL_LAYER,
      type: "fill",
      source: RADIUS_SOURCE_ID,
      paint: { "fill-color": "#3b82f6", "fill-opacity": 0.06 },
    });
  }

  if (!map.getLayer(RADIUS_BORDER_LAYER)) {
    map.addLayer({
      id: RADIUS_BORDER_LAYER,
      type: "line",
      source: RADIUS_SOURCE_ID,
      paint: {
        "line-color": "#3b82f6",
        "line-width": 1.5,
        "line-dasharray": [4, 3],
      },
    });
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NearbyIssuesMap({
  mode,
  departmentId,
  height = "420px",
  className,
}: NearbyIssuesMapProps) {
  // ── Refs ─────────────────────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null); // maptilersdk.Map instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map()); // complaint id → Marker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const popupsRef = useRef<Map<string, any>>(new Map()); // complaint id → Popup
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);
  // Cached SDK module so marker/style effects don't re-import on every render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdkRef = useRef<any>(null);
  // Synchronous guard: prevents a second async init from starting while the
  // first one is still awaiting the SDK import or the map "load" event.
  // Using a ref (not state) so the check is synchronous and race-free.
  const initializingRef = useRef(false);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const { resolvedTheme } = useTheme();

  // ── Stable Supabase browser client ────────────────────────────────────────
  const supabase = useMemo(() => createClient(), []);

  // ── State ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<
    "locating" | "loading" | "ready" | "error"
  >("locating");
  const [errorMsg, setErrorMsg] = useState("");
  const [complaints, setComplaints] = useState<MapComplaint[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Flipped to true once the map canvas has fired its "load" event and the
  // map instance is fully ready to accept sources, layers and markers.
  const [mapReady, setMapReady] = useState(false);

  // ── Fetch from /api/complaints/nearby ─────────────────────────────────────
  const fetchComplaints = useCallback(async () => {
    const loc = locationRef.current;
    const params = new URLSearchParams();

    if (mode === "admin") {
      params.set("admin", "true");
      if (departmentId) params.set("department_id", departmentId);
      if (loc) {
        params.set("lat", String(loc.lat));
        params.set("lng", String(loc.lng));
      }
    } else {
      if (!loc) return; // citizen mode requires a location
      params.set("lat", String(loc.lat));
      params.set("lng", String(loc.lng));
      params.set("radius", String(CITIZEN_RADIUS_M));
    }

    try {
      const res = await fetch(`/api/complaints/nearby?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { complaints?: MapComplaint[] };
      const data = json.complaints ?? [];
      setComplaints(data);
      setLastUpdated(new Date());
    } catch {
      // Silently swallow transient network errors; next realtime event retries.
    }
  }, [mode, departmentId]);

  // ── Debounced refresh — coalesces bursts of realtime events (≤ 100 ms) ────
  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchComplaints, 100);
  }, [fetchComplaints]);

  // ── Step 1 — Acquire geolocation (citizen) or skip to load (admin) ────────
  useEffect(() => {
    if (mode === "admin") {
      setPhase("loading");
      return;
    }

    if (!("geolocation" in navigator)) {
      setErrorMsg("Geolocation is not supported by your browser.");
      setPhase("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPhase("loading");
      },
      () => {
        setErrorMsg(
          "Location access was denied. Enable it in your browser settings and refresh.",
        );
        setPhase("error");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }, [mode]);

  // ── Step 2 — Initial complaint fetch when location / mode is ready ─────────
  useEffect(() => {
    if (phase !== "loading") return;
    fetchComplaints().then(() => setPhase("ready"));
  }, [phase, fetchComplaints]);

  // ── Step 3 — Initialise MapTiler map (once, after phase === "ready") ───────
  useEffect(() => {
    if (phase !== "ready") return;
    if (!mapContainerRef.current) return;
    // Synchronous guards prevent a second concurrent init (React StrictMode
    // runs effects twice; the async IIFE means mapRef.current is not yet set
    // when the second run starts, so we need an extra flag).
    if (mapRef.current || initializingRef.current) return;

    initializingRef.current = true;
    // cancelled is flipped by the cleanup function so that if the component
    // unmounts while we are awaiting the SDK import or the map "load" event
    // we discard the partially-built map rather than attaching it to a
    // detached DOM node.
    let cancelled = false;

    (async () => {
      // Dynamic import keeps MapLibre GL JS out of the SSR bundle entirely
      const sdk = await import("@maptiler/sdk");
      if (cancelled) return;
      sdkRef.current = sdk;

      const { Map, Marker, Popup, MapStyle, config } = sdk;

      config.apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? "";

      const loc = locationRef.current;
      // MapTiler / GeoJSON convention: [longitude, latitude]
      const centre: [number, number] = loc
        ? [loc.lng, loc.lat]
        : [78.9629, 20.5937]; // geographic centre of India as fallback

      // Snapshot theme at init time; live theme changes are handled by the
      // dedicated theme-switch effect below so we don't re-run this effect.
      const isDark =
        document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;

      const map = new Map({
        container: mapContainerRef.current!,
        style: isDark ? MapStyle.STREETS_V4.DARK : MapStyle.STREETS_V4,
        center: centre,
        zoom: mode === "citizen" ? 15 : 12,
        geolocateControl: false,
      });

      // Wait for the base style to finish loading before adding sources / layers
      await new Promise<void>((resolve) => {
        if (map.loaded()) {
          resolve();
        } else {
          map.once("load", () => resolve());
        }
      });

      // If the component unmounted while we were waiting for the map to load,
      // clean it up immediately and bail out.
      if (cancelled) {
        map.remove();
        return;
      }

      // User location marker (blue dot)
      if (loc) {
        const userEl = document.createElement("div");
        userEl.style.cssText = "width:18px;height:18px;cursor:default";
        userEl.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
               viewBox="0 0 18 18" style="overflow:visible;display:block">
            <circle cx="9" cy="9" r="7" fill="#3b82f6" stroke="white" stroke-width="2.5"/>
            <circle cx="9" cy="9" r="11" fill="none" stroke="#3b82f6"
                    stroke-width="1.5" opacity="0.3"/>
          </svg>`;

        new Marker({ element: userEl, anchor: "center" })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(
            new Popup({ offset: 14 }).setHTML(
              "<strong style='font-size:13px'>Your location</strong>",
            ),
          )
          .addTo(map);

        // 500 m boundary ring (citizen mode only)
        if (mode === "citizen") {
          applyRadiusLayers(map, loc.lat, loc.lng);
        }
      }

      mapRef.current = map;
      initializingRef.current = false;
      // Signal the marker-sync effect that the map is ready to receive markers.
      setMapReady(true);
    })();

    return () => {
      // Flip the cancellation flag so the IIFE discards any in-flight work.
      cancelled = true;
      initializingRef.current = false;
    };
  }, [phase, mode]);

  // ── Theme switching — update map style when the OS/user theme changes ─────
  useEffect(() => {
    const map = mapRef.current;
    const sdk = sdkRef.current;
    if (!map || !sdk) return;

    const { MapStyle } = sdk;
    const isDark = resolvedTheme === "dark";
    const nextStyle = isDark ? MapStyle.STREETS_V4.DARK : MapStyle.STREETS_V4;

    map.setStyle(nextStyle);

    // After a setStyle call all sources and layers are wiped — re-apply the
    // 500 m circle once the new style has finished loading.
    const loc = locationRef.current;
    if (mode === "citizen" && loc) {
      map.once("styledata", () => {
        applyRadiusLayers(map, loc.lat, loc.lng);
      });
    }
  }, [resolvedTheme, mode]);

  // ── Step 4 — Sync complaint markers when `complaints` or `mapReady` changes
  useEffect(() => {
    // Wait until the map has fully initialized before touching markers.
    // By including mapReady in the dep array, this effect re-runs once the
    // async init effect flips setMapReady(true), so markers that arrived via
    // the initial fetch are not silently dropped.
    if (!mapReady) return;
    const map = mapRef.current;
    const sdk = sdkRef.current;
    if (!map || !sdk) return;

    const { Marker, Popup, LngLatBounds } = sdk;
    const liveIds = new Set(complaints.map((c) => c.id));

    // Remove markers (and their popups) that are no longer in the dataset
    markersRef.current.forEach((marker, id) => {
      if (!liveIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        const stalePopup = popupsRef.current.get(id);
        if (stalePopup) {
          stalePopup.remove();
          popupsRef.current.delete(id);
        }
      }
    });

    // Add new markers / refresh icons and popups on changed ones
    for (const c of complaints) {
      const color = markerColor(c.status, c.priority);
      const pulse =
        (c.status === "open" || c.status === "in_progress") &&
        (c.priority === "critical" || c.priority === "high");

      if (markersRef.current.has(c.id)) {
        // Update existing marker's visual + popup content without removing it.
        // We mutate the *existing* DOM element's innerHTML rather than
        // replacing it, so we never need to touch the private `_element` field
        // on the Marker and the original mouseenter/mouseleave listeners
        // (which close over the same existingEl reference) keep working.
        const existing = markersRef.current.get(c.id)!;
        const existingPopup = popupsRef.current.get(c.id);

        // Refresh the SVG inside the marker element
        const existingEl = existing.getElement() as HTMLElement;
        const tempEl = buildMarkerEl(color, pulse);
        existingEl.innerHTML = tempEl.innerHTML;
        existingEl.style.cssText = tempEl.style.cssText;

        // Refresh the popup's HTML content
        if (existingPopup) {
          existingPopup.setHTML(buildPopupHtml(c));
        }
      } else {
        const el = buildMarkerEl(color, pulse);

        // Create popup anchored to the complaint's coordinates.
        // We do NOT call marker.setPopup() — instead we wire hover events
        // manually so the popup opens on mouseenter and closes on mouseleave
        // rather than on click.
        const popup = new Popup({
          offset: 14,
          maxWidth: "280px",
          closeButton: false,
          closeOnClick: false,
        })
          .setLngLat([c.longitude, c.latitude])
          .setHTML(buildPopupHtml(c));

        el.addEventListener("mouseenter", () => {
          if (!popup.isOpen()) popup.addTo(map);
        });
        el.addEventListener("mouseleave", () => {
          if (popup.isOpen()) popup.remove();
        });

        const marker = new Marker({ element: el, anchor: "center" })
          .setLngLat([c.longitude, c.latitude])
          .addTo(map);

        markersRef.current.set(c.id, marker);
        popupsRef.current.set(c.id, popup);
      }
    }

    // Admin: auto-fit the viewport to all visible markers on first load
    if (
      mode === "admin" &&
      complaints.length > 0 &&
      !locationRef.current &&
      markersRef.current.size === complaints.length
    ) {
      const bounds = new LngLatBounds();
      complaints.forEach((c) => bounds.extend([c.longitude, c.latitude]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
    }
  }, [complaints, mode, mapReady]);

  // ── Supabase Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    if (phase !== "ready") return;

    const channel = supabase
      .channel("map:complaints-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints" },
        () => scheduleRefresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [phase, supabase, scheduleRefresh]);

  // ── Cleanup MapTiler map on unmount ────────────────────────────────────────
  useEffect(() => {
    const markers = markersRef.current;
    const popups = popupsRef.current;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      popups.forEach((p) => p.remove());
      popups.clear();
      markers.forEach((m) => m.remove());
      markers.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  // Error state
  if (phase === "error") {
    return (
      <div
        style={{ height }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted px-6 text-center",
          className,
        )}
      >
        <svg
          className="size-10 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <p className="max-w-xs text-sm text-muted-foreground">{errorMsg}</p>
      </div>
    );
  }

  // Loading / locating skeleton
  if (phase === "locating" || phase === "loading") {
    return (
      <div
        style={{ height }}
        className={cn("relative w-full overflow-hidden rounded-xl", className)}
      >
        <Skeleton className="absolute inset-0 h-full w-full rounded-xl" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-2 animate-bounce rounded-full bg-primary/60"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {phase === "locating" ? "Getting your location…" : "Loading map…"}
          </p>
        </div>
      </div>
    );
  }

  // Map ready
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-border shadow-sm",
        className,
      )}
    >
      {/* MapTiler canvas */}
      <div ref={mapContainerRef} style={{ height, width: "100%" }} />

      {/* Live pill — bottom-left (above MapTiler attribution bar) */}
      <div className="absolute bottom-8 left-3 z-10 flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm select-none">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-green-500" />
        </span>
        <span>{complaints.length}</span>
        <span className="font-normal text-muted-foreground">
          {mode === "citizen"
            ? `issue${complaints.length !== 1 ? "s" : ""} within 500 m`
            : `department issue${complaints.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Last-updated timestamp — bottom-right (above attribution) */}
      {lastUpdated && (
        <div className="absolute bottom-8 right-3 z-10 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm select-none">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* Legend — top-right */}
      <div className="absolute top-3 right-3 z-10 space-y-1.5 rounded-xl border border-border bg-background/90 px-3 py-2.5 text-xs shadow-sm backdrop-blur-sm select-none">
        {(
          [
            { color: "#ca8a04", label: "Open" },
            { color: "#2563eb", label: "In Progress" },
            { color: "#dc2626", label: "Critical" },
            { color: "#f97316", label: "High Priority" },
            { color: "#16a34a", label: "Resolved" },
            { color: "#6b7280", label: "Rejected" },
          ] as const
        ).map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="inline-block size-3 shrink-0 rounded-full border-2 border-white shadow-sm"
              style={{ background: color }}
            />
            <span className="text-foreground/80">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
