"use client";

import { useState } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

// Mock data for London incidents
const INCIDENTS = [
  { id: 1, priority: "HIGH", time: "14:02:01", msg: "Supply drop identified. Awaiting retrieval.", lat: 51.5054, lng: -0.0235, loc: "Canary Wharf" },
  { id: 2, priority: "MED", time: "14:00:45", msg: "Civil unrest reported. Avoid primary arterial roads.", lat: 51.5136, lng: -0.1365, loc: "Soho" },
  { id: 3, priority: "HIGH", time: "13:58:12", msg: "Comms tower offline. Investigating sabotage.", lat: 51.5045, lng: -0.0865, loc: "The Shard" }
];

// User's base location (Big Ben)
const BASE_LOCATION = { lat: 51.5007, lng: -0.1246 };

// Helper: Haversine distance formula (returns straight-line distance in km)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

export function UrgencyBoard() {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [activeRoute, setActiveRoute] = useState<{ geojson: any, durationMinutes: number } | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  // Fetch routing data from OSRM's free public API
  const handleMapClick = async (incident: typeof INCIDENTS[0]) => {
    setSelectedIncidentId(incident.id);
    setIsRouting(true);
    
    try {
      // OSRM expects coordinates in lng,lat order
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${BASE_LOCATION.lng},${BASE_LOCATION.lat};${incident.lng},${incident.lat}?overview=full&geometries=geojson`
      );
      const data = await res.json();

      if (data.routes && data.routes[0]) {
        setActiveRoute({
          geojson: data.routes[0].geometry,
          durationMinutes: Math.ceil(data.routes[0].duration / 60) // Convert seconds to minutes
        });
      }
    } catch (err) {
      console.error("Routing failed:", err);
    } finally {
      setIsRouting(false);
    }
  };

  return (
    <div className="flex flex-col border-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
      {/* Board Header */}
      <div className="flex items-center justify-between bg-red-600 px-4 py-2 font-seven text-2xl tracking-wider text-black">
        <span>LIVE URGENCY BOARD // VOL. 04</span>
        <div className="flex items-center gap-4">
          <span className="animate-pulse">● LIVE FEED</span>
          <span>LONDON_SEC_01</span>
        </div>
      </div>

      <div className="flex h-[600px] flex-col lg:flex-row">
        
        {/* LEFT: Main Feed */}
        <div className="flex-1 overflow-y-auto border-b-2 border-red-600 lg:border-b-0 lg:border-r-2 bg-zinc-950">
          <div className="p-4 space-y-4">
            {INCIDENTS.map((inc) => (
              <div 
                key={inc.id} 
                className={`border p-3 transition-colors cursor-pointer ${selectedIncidentId === inc.id ? 'border-green-500 bg-zinc-900/80' : 'border-zinc-800 bg-zinc-900 hover:border-red-600/50'}`}
                onClick={() => handleMapClick(inc)}
              >
                {inc.priority === "HIGH" && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>}
                <div className="flex justify-between font-seven text-red-600 text-xl tracking-wider">
                  <span className={inc.priority === "HIGH" ? "ml-2" : ""}>PRIORITY {inc.priority}</span>
                  <span className="text-zinc-500">{inc.time}</span>
                </div>
                <p className="text-zinc-300 font-jetbrains text-sm mt-2 leading-relaxed">{inc.msg}</p>
                <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2 font-seven text-xs tracking-widest">
                  <span className="text-zinc-500">LOC: {inc.loc}</span>
                  <span className="text-red-500/70">[{inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}]</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Tactical Map */}
        <div className="relative flex-1 bg-black overflow-hidden">
          <Map
            initialViewState={{
              longitude: -0.1278,
              latitude: 51.5074,
              zoom: 11.5,
              pitch: 45,
            }}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            attributionControl={false}
          >
            
            {/* Draw Path Layer if a route exists */}
            {activeRoute && (
              <Source id="route-source" type="geojson" data={activeRoute.geojson}>
                <Layer
                  id="route-layer"
                  type="line"
                  layout={{
                    "line-join": "round",
                    "line-cap": "round"
                  }}
                  paint={{
                    "line-color": "#22c55e", // Green matching the base
                    "line-width": 3,
                    "line-dasharray": [0, 2, 2] // Dashed tactical line
                  }}
                />
              </Source>
            )}

            {/* BASE LOCATION MARKER (Green) */}
            <Marker longitude={BASE_LOCATION.lng} latitude={BASE_LOCATION.lat} anchor="center">
              <div className="relative flex items-center justify-center w-6 h-6">
                <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-40 animate-ping"></span>
                <div className="relative z-10 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
              </div>
              <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-seven text-[10px] text-green-500 bg-black/80 px-1 border border-green-500/30">
                HQ_BASE
              </div>
            </Marker>

            {/* INCIDENT MARKERS (Red) */}
            {INCIDENTS.map((inc) => (
              <Marker 
                key={inc.id} 
                longitude={inc.lng} 
                latitude={inc.lat} 
                anchor="center"
              >
                <div 
                  className="relative group cursor-pointer"
                  onMouseEnter={() => setHoveredId(inc.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleMapClick(inc)}
                >
                  <div className="relative flex items-center justify-center w-8 h-8">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-red-600 opacity-30 animate-ping"></span>
                    <div className="relative z-10 w-3 h-3 bg-red-600 border border-black transform rotate-45"></div>
                  </div>

                  {/* HOVER TOOLTIP */}
                  {hoveredId === inc.id && (
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 bg-zinc-950 border border-red-600 p-2 z-50 pointer-events-none shadow-lg shadow-red-900/20">
                      <div className="font-seven text-red-500 text-sm border-b border-red-600/30 pb-1 mb-1">
                        DIST: {getDistance(BASE_LOCATION.lat, BASE_LOCATION.lng, inc.lat, inc.lng)} KM
                      </div>
                      <p className="font-jetbrains text-[10px] text-zinc-300 leading-tight">
                        {inc.msg}
                      </p>
                    </div>
                  )}
                </div>
              </Marker>
            ))}
          </Map>

          {/* Map Overlay HUD (Routing Info) */}
          <div className="absolute bottom-4 right-4 bg-black/80 border border-red-600 p-2 font-seven tracking-wider text-right pointer-events-none">
            {isRouting ? (
              <span className="text-yellow-500 text-lg animate-pulse">CALCULATING ROUTE...</span>
            ) : activeRoute ? (
              <>
                <div className="text-green-500 text-xl">PATH_LOCKED</div>
                <div className="text-zinc-400 text-sm mt-1">ETA: {activeRoute.durationMinutes} MIN (DRIVE)</div>
              </>
            ) : (
              <span className="text-red-500 text-lg">AWAITING COORD SELECTION</span>
            )}
          </div>
          
          <div className="absolute top-4 left-4 bg-black/80 border border-red-600 p-2 font-seven text-sm tracking-widest text-red-500 pointer-events-none">
            SAT_UPLINK: SECURE<br/>
            MARKERS: {INCIDENTS.length}
          </div>
          
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-40"></div>
        </div>
      </div>
    </div>
  );
}