import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Monkey-patch Leaflet DomUtil methods to be 100% resilient against unmounted container / transition races in React
if (typeof window !== "undefined" && L && L.DomUtil && !L.DomUtil._safePatched) {
  const origGetPos = L.DomUtil.getPosition;
  L.DomUtil.getPosition = function (el) {
    if (!el) return new L.Point(0, 0);
    try {
      return origGetPos.call(this, el) || new L.Point(0, 0);
    } catch {
      return new L.Point(0, 0);
    }
  };

  const origSetPos = L.DomUtil.setPosition;
  L.DomUtil.setPosition = function (el, point) {
    if (!el) return;
    try {
      origSetPos.call(this, el, point);
    } catch {}
  };

  L.DomUtil._safePatched = true;
  if (!window.L) {
    window.L = L;
  }
}

export default L;
