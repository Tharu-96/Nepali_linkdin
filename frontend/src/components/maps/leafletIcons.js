import L from "leaflet";

// Colored teardrop pins as inline SVG so we don't depend on Leaflet's default
// image assets (which break under bundlers) or any external tile/CDN.
function pinIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="38" viewBox="0 0 26 38">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 25 13 25s13-15.25 13-25C26 5.82 20.18 0 13 0z" fill="${color}"/>
      <circle cx="13" cy="13" r="5" fill="#ffffff"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "rozgar-pin",
    iconSize: [26, 38],
    iconAnchor: [13, 38],
    popupAnchor: [0, -34],
  });
}

export const urgentJobIcon = pinIcon("#ef4444");
export const normalJobIcon = pinIcon("#3b82f6");
export const userLocationIcon = pinIcon("#10b981");
