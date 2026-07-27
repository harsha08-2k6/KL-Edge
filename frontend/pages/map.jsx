import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import { Layout } from "../components/Layout.jsx";
import { 
  Search, Navigation, MapPin, Star, Clock, Phone, Utensils, 
  RefreshCw, Eye, MessageSquare, ChevronRight, AlertTriangle 
} from "lucide-react";

// Color maps for premium look
const CATEGORY_COLORS = {
  academic: "border-violet text-violet bg-violet/10",
  library: "border-violet text-violet bg-violet/10",
  food: "border-amber text-amber bg-amber/10",
  hostel: "border-violet text-violet bg-violet/10",
  parking: "border-mint text-mint bg-mint/10",
  washroom: "border-coral text-coral bg-coral/10",
  atm: "border-lime text-lime bg-lime/10",
  sports: "border-mint text-mint bg-mint/10",
  medical: "border-coral text-coral bg-coral/10",
  emergency: "border-coral text-coral bg-coral/10 bg-red-100",
  services: "border-ink text-ink bg-ink/10"
};

const MAP_CATEGORIES = [
  "academic",
  "library",
  "food",
  "hostel",
  "parking",
  "washroom",
  "atm",
  "sports",
  "medical",
  "emergency",
  "services"
];

// Custom marker renderer using Leaflet divIcon
const createCustomIcon = (loc, isSelected) => {
  const color = isSelected ? "#10b981" : "#7867d8"; // Mint green for selected, Purple for others
  const size = isSelected ? 32 : 24;
  
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="${size}" height="${size}" class="transition-all duration-300 hover:scale-125 drop-shadow-md">
             <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
           </svg>`,
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
      map.setView(center, zoom || 17, { animate: true, duration: 1 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function Map() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  // Routing State
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [activeRoute, setActiveRoute] = useState(null);
  const [routingError, setRoutingError] = useState("");
  
  // Review Form State
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // AI Navigator Chat State
  
  // Map coordinates
  const [mapCenter, setMapCenter] = useState([16.4410, 80.6225]);
  const [mapZoom, setMapZoom] = useState(17);

  useEffect(() => {
    fetchLocations();
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

  const triggerSearch = (query) => {
    if (!query) return;
    const match = locations.find(loc => 
      loc.name.toLowerCase().includes(query.toLowerCase()) || 
      (loc.description && loc.description.toLowerCase().includes(query.toLowerCase()))
    );
    if (match) {
      handleSelectLocation(match);
    }
  };

  const calculateRouteDirectly = async (fromId, toId) => {
    if (!fromId || !toId) return;
    if (fromId === toId) {
      setRoutingError("Start and destination cannot be the same place.");
      setActiveRoute(null);
      return;
    }
    try {
      setRoutingError("");
      const res = await axios.get(`/api/map/route?from_id=${fromId}&to_id=${toId}`);
      setActiveRoute(res.data);
      
      if (res.data.path_coords.length > 0) {
        setMapCenter(res.data.path_coords[0]);
        setMapZoom(17);
      }
    } catch (err) {
      setRoutingError("Failed to fetch route. Please try different locations.");
      setActiveRoute(null);
    }
  };

  useEffect(() => {
    if (routeFrom && routeTo) {
      calculateRouteDirectly(routeFrom, routeTo);
    } else {
      setActiveRoute(null);
    }
  }, [routeFrom, routeTo]);

  const handleRouteSearch = () => {
    calculateRouteDirectly(routeFrom, routeTo);
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
    setRouteFrom("");
    setRouteTo("");
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
        // Refresh selected location details
        const updatedLocRes = await axios.get("/api/map/locations");
        setLocations(updatedLocRes.data);
        const updatedLoc = updatedLocRes.data.find(l => l.id === selectedLocation.id);
        
        // Add fresh review directly to local UI state
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
      const R = 6371e3; // meters
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
      .filter(loc => loc.distance < 180) // 180 meters walking radius
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4); // Limit to top 4 suggestions
  };

  // Filter coordinates based on search and category selections
  const filteredLocations = locations.filter(loc => {
    if (selectedCategory) return loc.category === selectedCategory;
    return true;
  });

  const searchFilteredLocations = searchQuery.trim() 
    ? locations.filter(loc => loc.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];



  return (
    <Layout title="Campus Map" width="full">
      {/* Under Development Banner */}
      <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber/20 bg-amber/5 px-4 py-3 text-xs font-semibold text-amber-700 shadow-sm">
        <AlertTriangle size={16} className="text-amber-500 shrink-0" />
        <div>
          <p className="font-bold">Caution: Feature Under Development</p>
          <p className="text-[10px] text-amber-600/90 font-medium mt-0.5">Route calculation and campus locations are currently being refined. Paths may change during testing.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Sidebar UI Panels */}
        <div className="flex flex-col gap-4 lg:col-span-4 max-h-[85vh] overflow-y-auto pb-4 pr-1">
          {/* Smart Search Bar */}
          <div className="relative rounded-xl border border-ink/10 bg-white p-3 shadow-soft">
            <div className="flex items-center gap-2 rounded-lg bg-paper/60 px-3 py-2 border border-ink/5 focus-within:border-mint transition-colors">
              <Search size={18} className="text-ink/40" />
              <input
                type="text"
                placeholder="Search labs, blocks, washrooms..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </div>
            
            {showSuggestions && searchFilteredLocations.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-[1000] mt-1 rounded-xl border border-ink/10 bg-white py-1 shadow-soft max-h-[220px] overflow-y-auto">
                {searchFilteredLocations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => handleSelectLocation(loc)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink hover:bg-paper/80 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-ink">{loc.name}</p>
                      <p className="text-[10px] text-ink/50 capitalize">{loc.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Filters */}
          <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-soft">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink/40 mb-2">Category Filters</h2>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all border ${
                  !selectedCategory 
                    ? "bg-ink border-ink text-white" 
                    : "bg-paper/40 border-ink/5 text-ink/70 hover:bg-paper"
                }`}
              >
                All
              </button>
              {MAP_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all capitalize border ${
                    selectedCategory === cat
                      ? "bg-ink border-ink text-white"
                      : "bg-paper/40 border-ink/5 text-ink/70 hover:bg-paper"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* From / To Navigation Selector */}
          <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-soft">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink/40">Navigation Route</h2>
              {activeRoute && (
                <button 
                  onClick={handleClearRoute}
                  className="text-[10px] font-bold text-coral hover:underline"
                >
                  Clear Route
                </button>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink/40 w-10">From:</span>
                <select
                  value={routeFrom}
                  onChange={(e) => setRouteFrom(e.target.value)}
                  className="w-full rounded-lg border border-ink/10 bg-paper/30 px-3 py-1.5 text-xs font-semibold outline-none"
                >
                  <option value="">Choose starting point...</option>
                  {locations.map(loc => (
                    <option key={`from-${loc.id}`} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink/40 w-10">To:</span>
                <select
                  value={routeTo}
                  onChange={(e) => setRouteTo(e.target.value)}
                  className="w-full rounded-lg border border-ink/10 bg-paper/30 px-3 py-1.5 text-xs font-semibold outline-none"
                >
                  <option value="">Choose destination...</option>
                  {locations.map(loc => (
                    <option key={`to-${loc.id}`} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {routingError && (
                <p className="text-[10px] font-bold text-coral mt-1">{routingError}</p>
              )}

              <button
                onClick={handleRouteSearch}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-mint py-2 text-xs font-bold text-white shadow-soft hover:bg-mint/90 transition-all"
              >
                <Navigation size={14} /> Calculate Route
              </button>
            </div>

            {/* Active Route Details */}
            {activeRoute && (
              <div className="mt-3 border-t border-ink/5 pt-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-ink">Distance: {activeRoute.distance_meters}m</span>
                  <span className="font-semibold text-ink/60 bg-paper px-2 py-0.5 rounded flex items-center gap-1">
                    <Clock size={12} className="text-ink/40" />
                    {activeRoute.estimated_minutes} min walk
                  </span>
                </div>
                <div className="max-h-[160px] overflow-y-auto border border-ink/5 rounded-lg p-2 bg-paper/30">
                  <ol className="flex flex-col gap-1.5 text-[11px] text-ink/70">
                    {activeRoute.directions.map((step, idx) => (
                      <li key={idx} className="flex gap-2 leading-tight">
                        <span className="font-bold text-ink/40">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>


        </div>

        {/* Interactive Map on Right / Center */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          <div className="rounded-2xl border border-ink/10 bg-white p-2 shadow-soft overflow-hidden h-[450px] md:h-[550px] relative z-10">
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
                minZoom={16}
                maxZoom={19}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapController center={mapCenter} zoom={mapZoom} />

                {/* Markers */}
                {filteredLocations.map(loc => {
                  const isSelected = selectedLocation && selectedLocation.id === loc.id;
                  const isRouteEndpoint = activeRoute && (activeRoute.from === loc.id || activeRoute.to === loc.id);
                  
                  if (!isSelected && !isRouteEndpoint) return null;
                  
                  return (
                    <Marker
                      key={loc.id}
                      position={[loc.latitude, loc.longitude]}
                      icon={createCustomIcon(loc, isSelected)}
                      eventHandlers={{
                        click: () => {
                          setSelectedLocation(loc);
                        }
                      }}
                    >
                      <Popup>
                        <div className="p-1 min-w-[140px]">
                          <p className="font-black text-ink m-0 text-xs">{loc.name}</p>
                          <p className="text-[9px] text-mint font-bold m-0 mt-0.5 capitalize">{loc.category}</p>
                          <div className="flex flex-col gap-1 mt-2">
                            <button
                              onClick={() => handleSelectLocation(loc)}
                              className="text-[9px] font-bold bg-paper border border-ink/10 text-ink rounded py-1 px-1.5 text-center hover:bg-paper/85 transition-colors"
                            >
                              View Details
                            </button>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setRouteFrom(loc.id)}
                                className={`flex-1 text-[9px] font-bold rounded py-1 px-1 text-center transition-colors ${
                                  routeFrom === loc.id 
                                    ? "bg-ink text-white" 
                                    : "bg-paper border border-ink/10 text-ink hover:bg-paper/80"
                                }`}
                              >
                                From Here
                              </button>
                              <button
                                onClick={() => setRouteTo(loc.id)}
                                className={`flex-1 text-[9px] font-bold rounded py-1 px-1 text-center transition-colors ${
                                  routeTo === loc.id 
                                    ? "bg-mint text-white" 
                                    : "bg-paper border border-ink/10 text-ink hover:bg-paper/80"
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

                {/* Routing Polyline */}
                {activeRoute && (
                  <Polyline
                    positions={activeRoute.path_coords}
                    color="#7867d8"
                    weight={5}
                    opacity={0.9}
                  />
                )}
              </MapContainer>
            )}
          </div>

          {/* Location Detailed Panel - Slide open */}
          {selectedLocation && (
            <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-soft animate-panel-slide-in">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-ink/5 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${CATEGORY_COLORS[selectedLocation.category]}`}>
                      {selectedLocation.category}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-lg font-black text-ink">{selectedLocation.name}</h3>
                  <p className="text-xs text-ink/70 leading-relaxed mt-1">{selectedLocation.description}</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setRouteFrom(selectedLocation.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                      routeFrom === selectedLocation.id 
                        ? "bg-ink border-ink text-white" 
                        : "border-ink/10 bg-paper/50 text-ink hover:bg-paper"
                    }`}
                  >
                    <MapPin size={14} /> From Here
                  </button>
                  <button
                    onClick={() => setRouteTo(selectedLocation.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                      routeTo === selectedLocation.id 
                        ? "bg-mint border-mint text-white" 
                        : "border-ink/10 bg-paper/50 text-ink hover:bg-paper"
                    }`}
                  >
                    <Navigation size={14} /> To Here
                  </button>
                  <button
                    onClick={() => setSelectedLocation(null)}
                    className="text-xs font-bold text-ink/40 hover:text-ink px-2"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Grid content for info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Specific features column */}
                <div className="flex flex-col gap-3.5">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-ink/40">Specifications</h4>
                  
                  {selectedLocation.opening_hours && (
                    <div className="flex items-center gap-3.5 text-xs text-ink">
                      <Clock size={16} className="text-ink/50 shrink-0" />
                      <div>
                        <p className="font-bold text-[10px] text-ink/50">Opening Hours</p>
                        <p className="font-semibold">{selectedLocation.opening_hours}</p>
                      </div>
                    </div>
                  )}

                  {selectedLocation.contact && (
                    <div className="flex items-center gap-3.5 text-xs text-ink">
                      <Phone size={16} className="text-ink/50 shrink-0" />
                      <div>
                        <p className="font-bold text-[10px] text-ink/50">Contact Number</p>
                        <p className="font-semibold">{selectedLocation.contact}</p>
                      </div>
                    </div>
                  )}

                  {selectedLocation.departments && (
                    <div className="flex items-start gap-3.5 text-xs text-ink">
                      <MapPin size={16} className="text-ink/50 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold text-[10px] text-ink/50">Departments Inside</p>
                        <p className="font-semibold leading-snug">{selectedLocation.departments}</p>
                      </div>
                    </div>
                  )}

                  {/* Food Menu specific */}
                  {selectedLocation.category === "food" && selectedLocation.menu && (
                    <div className="rounded-xl border border-ink/5 bg-paper/40 p-3 mt-1">
                      <div className="flex items-center gap-1.5 mb-2 border-b border-ink/5 pb-1.5">
                        <Utensils size={14} className="text-amber" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink">Menu & Pricing</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {selectedLocation.menu.map((dish, i) => (
                          <div key={i} className="flex justify-between border-b border-ink/5 pb-1">
                            <span className="font-medium text-ink/80">{dish.item}</span>
                            <span className="font-bold text-ink">₹{dish.price}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-ink/50 mt-3 font-semibold">
                        <span>Price Range: {selectedLocation.price_range}</span>
                        <span>Peak Hours: {selectedLocation.peak_hours}</span>
                      </div>
                    </div>
                  )}

                  {/* Hostel Specific */}
                  {selectedLocation.category === "hostel" && (
                    <div className="rounded-xl border border-ink/5 bg-paper/40 p-3 mt-1 text-xs text-ink/80 flex flex-col gap-2">
                      <p><strong>Visitor Timings:</strong> {selectedLocation.visitor_timings}</p>
                      <p><strong>Warden Office:</strong> {selectedLocation.warden_office}</p>
                      <p><strong>Laundry:</strong> {selectedLocation.laundry_details}</p>
                      <p><strong>Mess Details:</strong> {selectedLocation.mess_details}</p>
                    </div>
                  )}

                  {/* Nearby POIs suggestions */}
                  {getNearbyLocations(selectedLocation).length > 0 && (
                    <div className="mt-2 border-t border-ink/5 pt-3">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-ink/40 mb-2">Nearby Facilities</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {getNearbyLocations(selectedLocation).map(nearby => (
                          <button
                            key={nearby.id}
                            onClick={() => handleSelectLocation(nearby)}
                            className="flex items-center justify-between rounded-lg border border-ink/5 bg-paper/30 p-2 text-left hover:bg-paper/80 transition-all"
                          >
                            <span className="text-[11px] font-bold text-ink truncate mr-2">
                              {nearby.name}
                            </span>
                            <span className="text-[9px] font-semibold text-mint shrink-0">{nearby.distance}m</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reviews & Student rating Column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 bg-paper/30 border border-ink/5 rounded-xl p-3">
                    <div className="flex items-center justify-center rounded-lg bg-amber text-white p-2.5 shrink-0">
                      <Star size={20} fill="white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Average Rating</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-ink">{selectedLocation.rating}</span>
                        <span className="text-xs text-ink/50">({selectedLocation.rating_count} review(s))</span>
                      </div>
                    </div>
                  </div>

                  {/* Reviews List */}
                  <div className="flex-1 flex flex-col gap-2">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-ink/40">Student Feedback</h5>
                    
                    <div className="max-h-[140px] overflow-y-auto flex flex-col gap-2 border border-ink/5 rounded-xl p-2 bg-paper/20">
                      {selectedLocation.reviews && selectedLocation.reviews.length > 0 ? (
                        selectedLocation.reviews.map(rev => (
                          <div key={rev.id} className="border-b border-ink/5 pb-2 last:border-b-0">
                            <div className="flex items-center justify-between text-[10px] mb-1">
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
                        <p className="text-[10px] text-ink/40 text-center py-4 italic">No reviews yet. Be the first to add one!</p>
                      )}
                    </div>

                    {/* Add Review Form */}
                    <form onSubmit={handleReviewSubmit} className="flex flex-col gap-2 mt-1 border-t border-ink/5 pt-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Your Name..."
                          value={reviewName}
                          onChange={(e) => setReviewName(e.target.value)}
                          className="w-1/2 rounded-lg border border-ink/10 bg-paper/40 px-2 py-1 text-[11px] outline-none"
                        />
                        <div className="flex items-center gap-1 w-1/2 justify-end">
                          <span className="text-[10px] text-ink/50 font-bold">Stars:</span>
                          <select
                            value={reviewRating}
                            onChange={(e) => setReviewRating(Number(e.target.value))}
                            className="rounded-lg border border-ink/10 bg-paper/30 px-1 py-0.5 text-[11px] font-bold"
                          >
                            <option value="5">5 Stars</option>
                            <option value="4">4 Stars</option>
                            <option value="3">3 Stars</option>
                            <option value="2">2 Stars</option>
                            <option value="1">1 Star</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Review comments..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="flex-1 rounded-lg border border-ink/10 bg-paper/40 px-2 py-1 text-[11px] outline-none focus:border-mint"
                          required
                        />
                        <button
                          type="submit"
                          disabled={submittingReview}
                          className="rounded-lg bg-ink px-3 py-1 text-[10px] font-bold text-white hover:bg-ink/80 transition-colors disabled:opacity-50"
                        >
                          Submit
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
