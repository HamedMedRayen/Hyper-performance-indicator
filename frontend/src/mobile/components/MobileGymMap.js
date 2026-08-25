import React, { useEffect, useRef } from "react";
import L from "../../utils/leafletSetup";

export default function MobileGymMap({
  gyms = [],
  userLoc = { lat: 36.8065, lng: 10.1815 },
  setUserLoc,
  selectedRegion = "all",
  onSelectGym
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const isFirstRender = useRef(true);

  // Initialize Map on mount
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Clean up any stale Leaflet instance on this container
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.stop?.();
        mapInstanceRef.current.off?.();
        mapInstanceRef.current.remove?.();
      } catch (e) {
        console.error("Leaflet remove error:", e);
      }
      mapInstanceRef.current = null;
    }

    if (container._leaflet_id) {
      container._leaflet_id = null;
    }

    // Create Map
    const zoomLevel = selectedRegion === "all" ? 10 : 12;
    const map = L.map(container, {
      center: [userLoc.lat, userLoc.lng],
      zoom: zoomLevel,
      zoomControl: false,
      attributionControl: false
    });
    mapInstanceRef.current = map;

    // Fast, beautiful CartoDB Dark / Voyager tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
      maxZoom: 19,
      subdomains: "abcd",
      crossOrigin: true
    }).addTo(map);

    // Layer for Gym Markers
    const gymGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = gymGroup;

    // User Location Marker
    const userIcon = L.divIcon({
      className: "user-marker-icon",
      html: `<div style="background: #8b5cf6; border: 2.5px solid #ffffff; width: 16px; height: 16px; border-radius: 50%; box-shadow: 0 0 12px #8b5cf6;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const userMarker = L.marker([userLoc.lat, userLoc.lng], {
      icon: userIcon,
      draggable: true
    }).addTo(map);

    userMarker.on("dragend", (e) => {
      const pos = e.target.getLatLng();
      if (setUserLoc) {
        setUserLoc({ lat: pos.lat, lng: pos.lng });
      }
    });
    userMarkerRef.current = userMarker;

    // Force multi-stage invalidateSize to ensure tiles render immediately in mobile WebViews
    map.invalidateSize();
    const t1 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 50);
    const t2 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 200);
    const t3 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop?.();
          mapInstanceRef.current.off?.();
          mapInstanceRef.current.remove?.();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
      if (container && container._leaflet_id) {
        container._leaflet_id = null;
      }
    };
  }, []); // Run once when this component mounts

  // Fly / pan when region or user location changes (skip initial mount to avoid conflict)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (mapInstanceRef.current) {
      const zoom = selectedRegion === "all" ? 10 : 13;
      try {
        mapInstanceRef.current.flyTo([userLoc.lat, userLoc.lng], zoom, {
          duration: 0.6
        });
      } catch (e) {}
    }
    if (userMarkerRef.current) {
      try {
        userMarkerRef.current.setLatLng([userLoc.lat, userLoc.lng]);
      } catch (e) {}
    }
  }, [userLoc.lat, userLoc.lng, selectedRegion]);

  // Update Gym markers reactively
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const group = markersLayerRef.current;
    group.clearLayers();

    gyms.forEach((g) => {
      const gymIcon = L.divIcon({
        className: "gym-marker-icon",
        html: `<div style="background: #06b6d4; border: 2px solid #000000; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(6, 182, 212, 0.8); color: #000000; font-size: 11px; font-weight: 900;">G</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([g.latitude, g.longitude], { icon: gymIcon });
      
      const coachCount = g.coaches?.length || 0;
      marker.bindPopup(`
        <div style="color: #ffffff; font-family: sans-serif; font-size: 12px; padding: 4px; min-width: 140px;">
          <strong style="font-size: 13px; color: #06b6d4; display: block; margin-bottom: 2px;">${g.name}</strong>
          <span style="color: #cbd5e1; font-size: 11px; display: block; margin-bottom: 4px;">${g.address || ""}</span>
          <strong style="color: #8b5cf6; font-size: 11px;">${coachCount} Coaches Available</strong>
        </div>
      `);

      marker.on("click", () => {
        if (setUserLoc) setUserLoc({ lat: g.latitude, lng: g.longitude });
        if (onSelectGym) onSelectGym(g);
      });

      group.addLayer(marker);
    });
  }, [gyms, onSelectGym, setUserLoc]);

  return (
    <div
      ref={mapContainerRef}
      id="mobile-gym-leaflet-map"
      style={{
        height: 340,
        width: "100%",
        borderRadius: 16,
        border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
        background: "#0f172a",
        overflow: "hidden",
        marginBottom: 16,
        position: "relative"
      }}
    />
  );
}
