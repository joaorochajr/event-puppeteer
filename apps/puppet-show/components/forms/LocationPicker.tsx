/**
 * An interactive OpenStreetMap where the person picks the point of the event:
 * a click places the marker, and the marker can be dragged to adjust it.
 *
 * Leaflet touches `window` as soon as it is imported, so it is loaded in an
 * effect (never during server rendering); until then, and if the load fails,
 * the person is told and can still type the coordinates.
 *
 * @module
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordinates } from "@/domain/links";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";

/** Where the map is centred while there is no point yet: the UEFS campus. */
const INITIAL_VIEW: Coordinates = { latitude: -12.2, longitude: -38.97 };

/** Zoom while there is no point yet. */
const INITIAL_ZOOM = 14;

/** Zoom when a point is set from outside (typed coordinates, device position). */
const POINT_ZOOM = 17;

/** Marker drawn by CSS, so no image asset has to be resolved by the bundler. */
const MARKER_HTML =
  '<span class="block h-5 w-5 rounded-full border-[3px] border-white bg-accent shadow-[0_1px_6px_rgb(0_0_0/0.5)]"></span>';

/** Props of {@link LocationPicker}. */
export type LocationPickerProps = {
  /** The point to show, or `null` while none is chosen. */
  value: Coordinates | null;
  /** Called with the point the person clicked or dragged the marker to. */
  onPick: (point: Coordinates) => void;
  /** Blocks picking while the form is busy. */
  disabled: boolean;
  /** Accessible name of the map region. */
  label: string;
};

/** Clamps a longitude Leaflet reports after the world wrapped around into −180..180. */
function WrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/** The map where the event's point is chosen. */
export function LocationPicker({ value, onPick, disabled, label }: LocationPickerProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  /** Latest props, read by Leaflet's handlers without recreating the map. */
  const latest = useRef({ onPick, disabled });
  useEffect(() => {
    latest.current = { onPick, disabled };
  });

  useEffect(() => {
    let cancelled = false;
    const element = container.current;
    if (element === null) return;

    import("leaflet").then(
      (module) => {
        if (cancelled) return;
        const L = module.default;
        leaflet.current = L;

        const instance = L.map(element).setView([INITIAL_VIEW.latitude, INITIAL_VIEW.longitude], INITIAL_ZOOM);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(instance);

        instance.on("click", (event) => {
          if (latest.current.disabled) return;
          latest.current.onPick({ latitude: event.latlng.lat, longitude: WrapLongitude(event.latlng.lng) });
        });

        map.current = instance;
        setReady(true);
      },
      () => {
        if (!cancelled) setLoadError("Não foi possível carregar o mapa. Digite as coordenadas.");
      },
    );

    return () => {
      cancelled = true;
      marker.current = null;
      map.current?.remove();
      map.current = null;
      leaflet.current = null;
    };
  }, []);

  const latitude = value?.latitude;
  const longitude = value?.longitude;

  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    if (!ready || L === null || instance === null) return;

    if (latitude === undefined || longitude === undefined) {
      marker.current?.remove();
      marker.current = null;
      return;
    }

    const position = L.latLng(latitude, longitude);
    if (marker.current === null) {
      const created = L.marker(position, {
        draggable: !disabled,
        keyboard: false,
        icon: L.divIcon({ html: MARKER_HTML, className: "", iconSize: [20, 20], iconAnchor: [10, 10] }),
      }).addTo(instance);
      created.on("dragend", () => {
        const dropped = created.getLatLng();
        latest.current.onPick({ latitude: dropped.lat, longitude: WrapLongitude(dropped.lng) });
      });
      marker.current = created;
    } else {
      marker.current.setLatLng(position);
    }

    if (disabled) marker.current.dragging?.disable();
    else marker.current.dragging?.enable();

    if (!instance.getBounds().contains(position)) instance.setView(position, Math.max(instance.getZoom(), POINT_ZOOM));
  }, [ready, latitude, longitude, disabled]);

  return (
    <div className="column gap-2">
      <div
        ref={container}
        role="region"
        aria-label={label}
        className={`z-0 h-64 w-full overflow-hidden rounded-2xl border border-line sm:h-72 ${disabled ? "opacity-60" : "cursor-crosshair"}`}
      />
      {!ready && loadError === "" && <LoadingMessage>Carregando o mapa...</LoadingMessage>}
      <ErrorAlert>{loadError}</ErrorAlert>
    </div>
  );
}
