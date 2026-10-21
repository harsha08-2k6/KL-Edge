import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import { Layout } from "../components/Layout.jsx";
import { 
  Search, Navigation, MapPin, Star, Clock, Phone, Utensils, 
  RefreshCw, X, ArrowUpDown, Compass, LocateFixed, Footprints,
  Building2, BookOpen, Bed, Car, Banknote, HeartPulse, ShieldAlert,
  Wrench, ChevronDown, ChevronUp, Check
} from "lucide-react";

// Color maps for category badges
const CATEGORY_COLORS = {
  academic: "border-violet/30 text-violet bg-violet/10",
  library: "border-indigo-400/30 text-indigo-700 bg-indigo-50",
  food: "border-amber/30 text-amber bg-amber/10",
  hostel: "border-purple-400/30 text-purple-700 bg-purple-50",
  parking: "border-mint/30 text-mint bg-mint/10",
  washroom: "border-coral/30 text-coral bg-coral/10",
  atm: "border-lime/30 text-lime bg-lime/10",
  sports: "border-mint/30 text-mint bg-mint/10",
  medical: "border-coral/30 text-coral bg-coral/10",
  emergency: "border-red-400/30 text-red-700 bg-red-50",
  services: "border-ink/20 text-ink bg-ink/5"
};

const CATEGORY_MARKER_COLORS = {
  academic: "#7867d8",
  library: "#6366f1",
  food: "#e3a72f",
  hostel: "#8b5cf6",
  parking: "#2f9d83",
  washroom: "#ef6f61",
  atm: "#84cc16",
  sports: "#10b981",
  medical: "#f43f5e",
  emergency: "#dc2626",
  services: "#12151f"
};

const CATEGORIES_CONFIG = [
  { id: "academic", label: "Academic", icon: Building2 },
  { id: "food", label: "Food & Canteens", icon: Utensils },
  { id: "library", label: "Library", icon: BookOpen },
  { id: "hostel", label: "Hostels", icon: Bed },
  { id: "atm", label: "ATMs", icon: Banknote },
  { id: "sports", label: "Sports & Gym", icon: Footprints },
  { id: "medical", label: "Medical", icon: HeartPulse },
  { id: "parking", label: "Parking", icon: Car },
  { id: "washroom", label: "Washrooms", icon: MapPin },
  { id: "services", label: "Services", icon: Wrench },
  { id: "emergency", label: "Emergency", icon: ShieldAlert }
];

const DEFAULT_CENTER = [16.4410, 80.6225];
const DEFAULT_ZOOM = 17;

// Helper to determine live Open/Closed status
function getOpenStatus(hoursStr) {
  if (!hoursStr) return null;
  const lower = hoursStr.toLowerCase();
  if (lower.includes("24 hour") || lower.includes("24/7") || lower.includes("24x7")) {
    return { isOpen: true, text: "Open 24/7", color: "text-emerald-700 bg-emerald-100/70 border-emerald-300" };
  }

  const match = hoursStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  let startH = parseInt(match[1], 10);
  const startM = parseInt(match[2], 10);
  const startAmPm = match[3].toUpperCase();
  if (startAmPm === "PM" && startH < 12) startH += 12;
  if (startAmPm === "AM" && startH === 12) startH = 0;
  const startMinutes = startH * 60 + startM;

  let endH = parseInt(match[4], 10);
  const endM = parseInt(match[5], 10);
  const endAmPm = match[6].toUpperCase();
  if (endAmPm === "PM" && endH < 12) endH += 12;
  if (endAmPm === "AM" && endH === 12) endH = 0;
  const endMinutes = endH * 60 + endM;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const isOpen = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  return {
    isOpen,
    text: isOpen ? "Open Now" : "Closed",
    color: isOpen
      ? "text-emerald-700 bg-emerald-100/70 border-emerald-300"
      : "text-rose-700 bg-rose-100/70 border-rose-300"
  };
}

// Custom marker renderer using Leaflet divIcon
const createCustomIcon = (loc, isSelected, isStart, isEnd) => {
  let color = CATEGORY_MARKER_COLORS[loc.category] || "#7867d8";
  let badgeLabel = "";
  let size = isSelected ? 34 : 26;

  if (isStart) {
    color = "#10b981"; // Emerald Green for Start
    badgeLabel = "A";
    size = 34;
  } else if (isEnd) {
    color = "#ef4444"; // Red for Destination
    badgeLabel = "B";
    size = 34;
  } else if (isSelected) {
    color = "#2f9d83"; // Mint for selected
  }

  return L.divIcon({
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        ${isSelected ? `<span style="position: absolute; inset: -4px; border-radius: 9999px; background: rgba(47, 157, 131, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>` : ""}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="${size}" height="${size}" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25)); transition: transform 0.2s ease;">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        ${badgeLabel ? `<span style="position: absolute; top: 4px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 900; color: white;">${badgeLabel}</span>` : ""}
      </div>
    `,
    className: "custom-leaflet-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

// Map controller to programmatic control of map bounds/views
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || DEFAULT_ZOOM, { animate: true, duration: 1 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function Map() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  // Directions / Routing State
  const [showDirectionsPanel, setShowDirectionsPanel] = useState(false);
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [activeRoute, setActiveRoute] = useState(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState("");
  const [showSteps, setShowSteps] = useState(false);
  
  // Review Form State
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Map coordinates
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);

  const searchContainerRef = useRef(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  // Close search suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/map/locations");
      setLocations(res.data);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleSelectLocation = (loc) => {
    setSelectedLocation(loc);
    setMapCenter([loc.latitude, loc.longitude]);
    setMapZoom(18);
    setShowSuggestions(false);
    setSearchQuery("");
  };

  const handleRecenter = () => {
    setMapCenter(DEFAULT_CENTER);
    setMapZoom(DEFAULT_ZOOM);
    setSelectedLocation(null);
  };

  const calculateRouteDirectly = async (fromId, toId) => {
    if (!fromId || !toId) return;
    if (fromId === toId) {
      setRoutingError("Start and destination cannot be the same place.");
      setActiveRoute(null);
      return;
    }
    try {
      setRoutingLoading(true);
      setRoutingError("");
      const res = await axios.get(`/api/map/route?from_id=${fromId}&to_id=${toId}`);
      setActiveRoute(res.data);
      setShowDirectionsPanel(true);
      
      if (res.data.path_coords && res.data.path_coords.length > 0) {
        // Fit view to path start
        setMapCenter(res.data.path_coords[0]);
        setMapZoom(17);
      }
      setRoutingLoading(false);
    } catch (err) {
      setRoutingError("Failed to fetch route. Please try different locations.");
      setActiveRoute(null);
      setRoutingLoading(false);
    }
  };

  useEffect(() => {
    if (routeFrom && routeTo) {
      calculateRouteDirectly(routeFrom, routeTo);
    } else {
      setActiveRoute(null);
    }
  }, [routeFrom, routeTo]);

  const handleSwapRoute = () => {
    const temp = routeFrom;
    setRouteFrom(routeTo);
    setRouteTo(temp);
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
    setRouteFrom("");
    setRouteTo("");
    setRoutingError("");
  };

  const handleSetRouteFrom = (locId) => {
    setRouteFrom(locId);
    setShowDirectionsPanel(true);
  };

  const handleSetRouteTo = (locId) => {
    setRouteTo(locId);
    setShowDirectionsPanel(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await axios.post(`/api/map/locations/${selectedLocation.id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment,
        studentName: reviewName.trim() || "Student"
      });
      if (res.data.status === "success") {
        const updatedLocRes = await axios.get("/api/map/locations");
        setLocations(updatedLocRes.data);
        const updatedLoc = updatedLocRes.data.find(l => l.id === selectedLocation.id);
        
        setSelectedLocation({
          ...selectedLocation,
          rating: res.data.rating,
          rating_count: res.data.rating_count,
          reviews: updatedLoc ? updatedLoc.reviews : selectedLocation.reviews
        });
        
        setReviewComment("");
        setReviewName("");
        setReviewRating(5);
      }
    } catch (err) {
      console.error(err);
    }
    setSubmittingReview(false);
  };

  // Helper: calculate Euclidean distances to show nearby locations
  const getNearbyLocations = (currentLoc) => {
    if (!currentLoc) return [];
    
    const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3;
      const phi1 = lat1 * Math.PI/180;
      const phi2 = lat2 * Math.PI/180;
      const deltaPhi = (lat2-lat1) * Math.PI/180;
      const deltaLambda = (lon2-lon1) * Math.PI/180;
      const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    return locations
      .filter(loc => loc.id !== currentLoc.id && loc.category !== "washroom")
      .map(loc => {
        const dist = getHaversineDistance(
          currentLoc.latitude, currentLoc.longitude,
          loc.latitude, loc.longitude
        );
        return { ...loc, distance: Math.round(dist) };
      })
      .filter(loc => loc.distance < 200)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
  };

  // Filter locations by Category
  const filteredLocations = useMemo(() => {
    if (selectedCategory === "ALL") return locations;
    return locations.filter(loc => loc.category === selectedCategory);
  }, [locations, selectedCategory]);

  // Autocomplete search suggestions
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return locations.filter(loc => 
      loc.name.toLowerCase().includes(q) ||
      (loc.description && loc.description.toLowerCase().includes(q)) ||
      (loc.departments && loc.departments.toLowerCase().includes(q)) ||
      (loc.category && loc.category.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [locations, searchQuery]);

  // Location lookups for route endpoints
  const fromLocation = useMemo(() => locations.find(l => l.id === routeFrom), [locations, routeFrom]);
  const toLocation = useMemo(() => locations.find(l => l.id === routeTo), [locations, routeTo]);

  return (
    <Layout title="Campus Map" width="full">
      <div className="pb-16 flex flex-col gap-3">
        
        {/* Top Control Bar: Search + Directions Toggle + Recenter */}
        <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-soft space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            
            {/* Search Input with Live Dropdown */}
            <div ref={searchContainerRef} className="relative flex-1">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
                <input
                  type="text"
                  placeholder="Search campus buildings, canteens, departments, ATMs..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full rounded-lg border border-ink/10 bg-surface/40 py-2.5 pl-9 pr-8 text-xs md:text-sm font-semibold text-ink placeholder:text-ink/35 focus:border-ink/30 focus:outline-none focus:bg-white transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setShowSuggestions(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-ink/10 bg-white p-1.5 shadow-xl space-y-1 max-h-64 overflow-y-auto">
                  {searchSuggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectLocation(item)}
                      className="tap w-full flex items-center justify-between rounded-lg p-2 text-left hover:bg-surface/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface text-ink/70">
                          <MapPin size={14} />
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-black text-ink truncate">{item.name}</p>
                          <p className="text-[10px] text-ink/45 truncate">
                            {item.departments || item.description || item.category}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${CATEGORY_COLORS[item.category] || "border-ink/10 text-ink/70"}`}>
                        {item.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDirectionsPanel(!showDirectionsPanel)}
                className={`tap flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all border ${
                  showDirectionsPanel || activeRoute
                    ? "bg-ink border-ink text-paper shadow-sm"
                    : "border-ink/10 bg-surface/50 text-ink/70 hover:bg-surface"
                }`}
              >
                <Navigation size={14} />
                <span>Directions</span>
                {activeRoute && (
                  <span className="rounded-full bg-mint text-white px-1.5 py-0.2 text-[9px] font-black">
                    Active
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleRecenter}
                title="Recenter campus view"
                className="tap flex items-center gap-1.5 rounded-lg border border-ink/10 bg-surface/50 px-3 py-2 text-xs font-bold text-ink/70 hover:bg-surface transition-all"
              >
                <Compass size={14} />
                <span className="hidden sm:inline">Recenter</span>
              </button>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none border-t border-ink/5">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`tap shrink-0 rounded-full px-3 py-1 text-xs font-black transition-colors ${
                selectedCategory === "ALL"
                  ? "bg-ink text-paper"
                  : "bg-surface text-ink/60 hover:text-ink"
              }`}
            >
              All ({locations.length})
            </button>
            {CATEGORIES_CONFIG.map((cat) => {
              const Icon = cat.icon;
              const count = locations.filter(l => l.category === cat.id).length;
              if (count === 0) return null;
              const isActive = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`tap shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black transition-colors ${
                    isActive
                      ? "bg-ink text-paper"
                      : "bg-surface text-ink/60 hover:text-ink"
                  }`}
                >
                  <Icon size={12} />
                  <span>{cat.label}</span>
                  <span className="text-[10px] opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Turn-by-Turn Directions Panel */}
        {showDirectionsPanel && (
          <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-soft space-y-3">
            <div className="flex items-center justify-between border-b border-ink/5 pb-2">
              <div className="flex items-center gap-2">
                <Navigation size={15} className="text-mint" />
                <h3 className="text-xs font-black uppercase tracking-wider text-ink">Campus Navigation</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectionsPanel(false)}
                className="text-xs font-bold text-ink/40 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              {/* Origin Dropdown */}
              <div className="sm:col-span-5 flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-ink/40">From</label>
                <select
                  value={routeFrom}
                  onChange={(e) => setRouteFrom(e.target.value)}
                  className="w-full rounded-lg border border-ink/10 bg-surface/50 px-2.5 py-2 text-xs font-bold text-ink focus:outline-none focus:border-ink/30"
                >
                  <option value="">Choose starting point...</option>
                  {locations.map((loc) => (
                    <option key={`from-${loc.id}`} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Swap Button */}
              <div className="sm:col-span-2 flex justify-center pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={handleSwapRoute}
                  disabled={!routeFrom && !routeTo}
                  title="Swap start and destination"
                  className="tap flex h-8 w-8 items-center justify-center rounded-full border border-ink/10 bg-surface text-ink/70 hover:bg-ink hover:text-paper transition-all disabled:opacity-40"
                >
                  <ArrowUpDown size={14} />
                </button>
              </div>

              {/* Destination Dropdown */}
              <div className="sm:col-span-5 flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-ink/40">To</label>
                <select
                  value={routeTo}
                  onChange={(e) => setRouteTo(e.target.value)}
                  className="w-full rounded-lg border border-ink/10 bg-surface/50 px-2.5 py-2 text-xs font-bold text-ink focus:outline-none focus:border-ink/30"
                >
                  <option value="">Choose destination...</option>
                  {locations.map((loc) => (
                    <option key={`to-${loc.id}`} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Routing Error */}
            {routingError && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 rounded-lg p-2 border border-rose-200">
                {routingError}
              </p>
            )}

            {/* Active Route Statistics & Steps */}
            {activeRoute && (
              <div className="rounded-xl border border-mint/30 bg-mint/5 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-mint">Distance</p>
                      <p className="text-base font-black text-ink">{activeRoute.distance_meters} meters</p>
                    </div>
                    <div className="h-6 w-px bg-ink/10" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-mint">Estimated Walk</p>
                      <p className="text-base font-black text-ink">~{activeRoute.estimated_minutes} min</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSteps(!showSteps)}
                      className="tap text-xs font-bold text-mint hover:underline flex items-center gap-1"
                    >
                      <span>{showSteps ? "Hide Steps" : "Show Turn-by-Turn"}</span>
                      {showSteps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearRoute}
                      className="tap rounded-md bg-white border border-ink/10 px-2 py-1 text-xs font-bold text-ink/60 hover:text-ink"
                    >
                      Clear Route
                    </button>
                  </div>
                </div>

                {/* Turn-by-turn Step Directions */}
                {showSteps && activeRoute.directions && (
                  <div className="mt-2 border-t border-ink/5 pt-2 space-y-1.5 max-h-48 overflow-y-auto">
                    {activeRoute.directions.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-medium text-ink/80">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mint/20 text-[9px] font-black text-mint mt-0.5">
                          {i + 1}
                        </span>
                        <p className="leading-snug">{step}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Map Container */}
        <div className="rounded-2xl border border-ink/10 bg-white p-2 shadow-soft overflow-hidden h-[460px] md:h-[560px] relative z-10">
          {loading ? (
            <div className="flex h-full w-full items-center justify-center bg-paper/50">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-mint" />
                <p className="text-xs font-semibold text-ink/60">Positioning Campus Layout...</p>
              </div>
            </div>
          ) : (
            <MapContainer 
              center={mapCenter} 
              zoom={mapZoom} 
              className="h-full w-full rounded-xl"
              zoomControl={true}
              maxBounds={[[16.4350, 80.6170], [16.4460, 80.6270]]}
              maxBoundsViscosity={1.0}
              minZoom={15}
              maxZoom={19}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapController center={mapCenter} zoom={mapZoom} />

              {/* Markers for ALL filtered locations */}
              {filteredLocations.map(loc => {
                const isSelected = selectedLocation && selectedLocation.id === loc.id;
                const isStart = activeRoute && activeRoute.from === loc.id;
                const isEnd = activeRoute && activeRoute.to === loc.id;
                const openStatus = getOpenStatus(loc.opening_hours);
                
                return (
                  <Marker
                    key={loc.id}
                    position={[loc.latitude, loc.longitude]}
                    icon={createCustomIcon(loc, isSelected, isStart, isEnd)}
                    eventHandlers={{
                      click: () => {
                        setSelectedLocation(loc);
                      }
                    }}
                  >
                    <Popup>
                      <div className="p-1 min-w-[160px] max-w-[220px]">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${CATEGORY_COLORS[loc.category] || "border-ink/10 text-ink/70"}`}>
                            {loc.category}
                          </span>
                          {openStatus && (
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${openStatus.color}`}>
                              {openStatus.text}
                            </span>
                          )}
                        </div>
                        <p className="font-black text-ink m-0 text-xs leading-snug">{loc.name}</p>
                        {loc.departments && (
                          <p className="text-[9px] text-ink/50 m-0 mt-0.5 truncate">{loc.departments}</p>
                        )}
                        <div className="flex flex-col gap-1 mt-2.5 pt-2 border-t border-ink/5">
                          <button
                            type="button"
                            onClick={() => handleSelectLocation(loc)}
                            className="text-[10px] font-bold bg-ink text-white rounded py-1 px-1.5 text-center hover:bg-ink/85 transition-colors"
                          >
                            View Full Details
                          </button>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleSetRouteFrom(loc.id)}
                              className={`flex-1 text-[9px] font-bold rounded py-1 px-1 text-center transition-colors ${
                                routeFrom === loc.id 
                                  ? "bg-emerald-600 text-white" 
                                  : "bg-surface border border-ink/10 text-ink hover:bg-surface/80"
                              }`}
                            >
                              From Here
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetRouteTo(loc.id)}
                              className={`flex-1 text-[9px] font-bold rounded py-1 px-1 text-center transition-colors ${
                                routeTo === loc.id 
                                  ? "bg-mint text-white" 
                                  : "bg-surface border border-ink/10 text-ink hover:bg-surface/80"
                              }`}
                            >
                              To Here
                            </button>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Walking Polyline Route */}
              {activeRoute && (
                <Polyline
                  positions={activeRoute.path_coords}
                  color="#2f9d83"
                  weight={6}
                  opacity={0.9}
                  dashArray="8, 6"
                />
              )}
            </MapContainer>
          )}
        </div>

        {/* Selected Location Detailed Sliding/Expandable Panel */}
        {selectedLocation && (
          <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-soft">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-ink/5 pb-4 mb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${CATEGORY_COLORS[selectedLocation.category] || "border-ink/10 text-ink"}`}>
                    {selectedLocation.category}
                  </span>
                  {selectedLocation.opening_hours && (
                    (() => {
                      const status = getOpenStatus(selectedLocation.opening_hours);
                      if (!status) return null;
                      return (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
                          {status.text}
                        </span>
                      );
                    })()
                  )}
                </div>
                <h3 className="mt-1.5 text-lg md:text-xl font-black text-ink">{selectedLocation.name}</h3>
                <p className="text-xs text-ink/70 leading-relaxed mt-1">{selectedLocation.description}</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetRouteFrom(selectedLocation.id)}
                  className={`tap flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                    routeFrom === selectedLocation.id 
                      ? "bg-emerald-600 border-emerald-600 text-white" 
                      : "border-ink/10 bg-surface/50 text-ink hover:bg-surface"
                  }`}
                >
                  <MapPin size={14} /> From Here
                </button>
                <button
                  type="button"
                  onClick={() => handleSetRouteTo(selectedLocation.id)}
                  className={`tap flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                    routeTo === selectedLocation.id 
                      ? "bg-mint border-mint text-white" 
                      : "border-ink/10 bg-surface/50 text-ink hover:bg-surface"
                  }`}
                >
                  <Navigation size={14} /> To Here
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLocation(null)}
                  className="tap flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 bg-surface/50 text-ink/50 hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Grid content for Specifications & Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Specifications Column */}
              <div className="flex flex-col gap-3.5">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-ink/40">Specifications & Info</h4>
                
                {selectedLocation.opening_hours && (
                  <div className="flex items-center gap-3.5 text-xs text-ink">
                    <Clock size={16} className="text-ink/50 shrink-0" />
                    <div>
                      <p className="font-bold text-[10px] text-ink/50">Operating Hours</p>
                      <p className="font-semibold">{selectedLocation.opening_hours}</p>
                    </div>
                  </div>
                )}

                {selectedLocation.contact && (
                  <div className="flex items-center gap-3.5 text-xs text-ink">
                    <Phone size={16} className="text-ink/50 shrink-0" />
                    <div>
                      <p className="font-bold text-[10px] text-ink/50">Contact Number</p>
                      <a href={`tel:${selectedLocation.contact}`} className="font-semibold text-mint hover:underline">
                        {selectedLocation.contact}
                      </a>
                    </div>
                  </div>
                )}

                {selectedLocation.departments && (
                  <div className="flex items-start gap-3.5 text-xs text-ink">
                    <Building2 size={16} className="text-ink/50 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-[10px] text-ink/50">Departments & Facilities</p>
                      <p className="font-semibold leading-snug">{selectedLocation.departments}</p>
                    </div>
                  </div>
                )}

                {/* Food Canteen Specific Menu */}
                {selectedLocation.category === "food" && selectedLocation.menu && (
                  <div className="rounded-xl border border-ink/5 bg-paper/50 p-3 mt-1">
                    <div className="flex items-center justify-between border-b border-ink/5 pb-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Utensils size={14} className="text-amber" />
                        <span className="text-xs font-bold uppercase tracking-wider text-ink">Menu & Pricing</span>
                      </div>
                      {selectedLocation.price_range && (
                        <span className="text-[10px] font-bold text-ink/50">Range: {selectedLocation.price_range}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs max-h-36 overflow-y-auto">
                      {selectedLocation.menu.map((dish, i) => (
                        <div key={i} className="flex justify-between border-b border-ink/5 pb-1">
                          <span className="font-medium text-ink/80 truncate mr-2">{dish.item}</span>
                          <span className="font-black text-ink shrink-0">₹{dish.price}</span>
                        </div>
                      ))}
                    </div>
                    {selectedLocation.peak_hours && (
                      <p className="text-[10px] text-ink/50 mt-2 font-medium">
                        🕒 <strong>Peak Hours:</strong> {selectedLocation.peak_hours}
                      </p>
                    )}
                  </div>
                )}

                {/* Hostel Specific Details */}
                {selectedLocation.category === "hostel" && (
                  <div className="rounded-xl border border-ink/5 bg-paper/50 p-3 mt-1 text-xs text-ink/80 flex flex-col gap-2">
                    {selectedLocation.visitor_timings && <p><strong>Visitor Timings:</strong> {selectedLocation.visitor_timings}</p>}
                    {selectedLocation.warden_office && <p><strong>Warden Office:</strong> {selectedLocation.warden_office}</p>}
                    {selectedLocation.laundry_details && <p><strong>Laundry:</strong> {selectedLocation.laundry_details}</p>}
                    {selectedLocation.mess_details && <p><strong>Mess Timings:</strong> {selectedLocation.mess_details}</p>}
                  </div>
                )}

                {/* Nearby Facilities */}
                {getNearbyLocations(selectedLocation).length > 0 && (
                  <div className="mt-2 border-t border-ink/5 pt-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-ink/40 mb-2">Nearby Walking Facilities</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {getNearbyLocations(selectedLocation).map(nearby => (
                        <button
                          key={nearby.id}
                          type="button"
                          onClick={() => handleSelectLocation(nearby)}
                          className="tap flex items-center justify-between rounded-lg border border-ink/5 bg-surface/40 p-2 text-left hover:bg-surface transition-all"
                        >
                          <span className="text-[11px] font-bold text-ink truncate mr-2">
                            {nearby.name}
                          </span>
                          <span className="text-[9px] font-bold text-mint shrink-0">{nearby.distance}m</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Student Reviews & Feedback Column */}
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-3 bg-surface/50 border border-ink/5 rounded-xl p-3">
                  <div className="flex items-center justify-center rounded-lg bg-amber text-white p-2.5 shrink-0">
                    <Star size={20} fill="white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Student Rating</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-black text-ink">{selectedLocation.rating || "5.0"}</span>
                      <span className="text-xs text-ink/50">({selectedLocation.rating_count || 0} reviews)</span>
                    </div>
                  </div>
                </div>

                {/* Reviews List */}
                <div className="flex-1 flex flex-col gap-2">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-ink/40">Student Reviews</h5>
                  
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-2 border border-ink/5 rounded-xl p-2.5 bg-surface/20">
                    {selectedLocation.reviews && selectedLocation.reviews.length > 0 ? (
                      selectedLocation.reviews.map(rev => (
                        <div key={rev.id} className="border-b border-ink/5 pb-2 last:border-b-0">
                          <div className="flex items-center justify-between text-[10px] mb-0.5">
                            <span className="font-bold text-ink">{rev.student_name}</span>
                            <div className="flex text-amber">
                              {Array.from({ length: rev.rating }).map((_, i) => (
                                <Star key={i} size={8} fill="currentColor" />
                              ))}
                            </div>
                          </div>
                          <p className="text-[10px] text-ink/70 leading-normal">{rev.comment}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-ink/40 text-center py-4 italic">No reviews yet. Share your experience!</p>
                    )}
                  </div>

                  {/* Add Review Form */}
                  <form onSubmit={handleReviewSubmit} className="flex flex-col gap-2 mt-1 border-t border-ink/5 pt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Your Name (optional)..."
                        value={reviewName}
                        onChange={(e) => setReviewName(e.target.value)}
                        className="w-1/2 rounded-lg border border-ink/10 bg-surface/40 px-2 py-1.5 text-[11px] outline-none font-medium"
                      />
                      <div className="flex items-center gap-1 w-1/2 justify-end">
                        <span className="text-[10px] text-ink/50 font-bold">Stars:</span>
                        <select
                          value={reviewRating}
                          onChange={(e) => setReviewRating(Number(e.target.value))}
                          className="rounded-lg border border-ink/10 bg-surface/40 px-1 py-1 text-[11px] font-bold text-ink"
                        >
                          <option value="5">5 ★</option>
                          <option value="4">4 ★</option>
                          <option value="3">3 ★</option>
                          <option value="2">2 ★</option>
                          <option value="1">1 ★</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Write a helpful review..."
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        className="flex-1 rounded-lg border border-ink/10 bg-surface/40 px-2.5 py-1.5 text-[11px] outline-none focus:border-mint font-medium"
                        required
                      />
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="tap rounded-lg bg-ink px-3 py-1.5 text-[10px] font-bold text-white hover:bg-ink/80 transition-colors disabled:opacity-50 shrink-0"
                      >
                        {submittingReview ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
