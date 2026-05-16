"use client";

import { useState } from "react";
// Import MapLibre wrapper and the required CSS
import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

// Mock data for London incidents
const INCIDENTS = [
  { id: 1, priority: "HIGH", time: "14:02:01", msg: "Supply drop identified. Awaiting retrieval.", lat: 51.5054, lng: -0.0235, loc: "Canary Wharf" },
  { id: 2, priority: "MED", time: "14:00:45", msg: "Civil unrest reported. Avoid primary arterial roads.", lat: 51.5136, lng: -0.1365, loc: "Soho" },
  { id: 3, priority: "HIGH", time: "13:58:12", msg: "Comms tower offline. Investigating sabotage.", lat: 51.5045, lng: -0.0865, loc: "The Shard" }
];

export function UrgencyBoard() {
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

      {/* Split Content */}
      <div className="flex h-[600px] flex-col lg:flex-row">
        
        {/* LEFT: Main Feed */}
        <div className="flex-1 overflow-y-auto border-b-2 border-red-600 lg:border-b-0 lg:border-r-2 bg-zinc-950">
          <div className="p-4 space-y-4">
            {INCIDENTS.map((inc) => (
              <div key={inc.id} className="border border-zinc-800 bg-zinc-900 p-3 relative overflow-hidden group hover:border-red-600/50 transition-colors">
                {inc.priority === "HIGH" && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>}
                
                <div className="flex justify-between font-seven text-red-600 text-xl tracking-wider">
                  <span className={inc.priority === "HIGH" ? "ml-2" : ""}>PRIORITY {inc.priority}</span>
                  <span className="text-zinc-500">{inc.time}</span>
                </div>
                
                <p className="text-zinc-300 font-jetbrains text-sm mt-2 leading-relaxed">
                  {inc.msg}
                </p>
                
                {/* Coordinate Mapping Text */}
                <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2 font-seven text-xs text-zinc-500 tracking-widest">
                  <span>LOC: {inc.loc}</span>
                  <span className="text-red-500/70">
                    [{inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}]
                  </span>
                </div>
              </div>
            ))}
            <div className="flex h-32 items-center justify-center border border-dashed border-zinc-800 text-zinc-600">
              <p className="text-xs font-jetbrains italic">Waiting for incoming packets...</p>
            </div>
          </div>
        </div>

        {/* RIGHT: Tactical Map */}
        <div className="relative flex-1 bg-black overflow-hidden">
          
          <Map
            initialViewState={{
              longitude: -0.1278,
              latitude: 51.5074,
              zoom: 11.5,
              pitch: 45, // Adds a slight 3D tilt for a tactical radar look
            }}
            // Carto's free Dark Matter map style - no API key required!
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            attributionControl={false} // Hides the default map attribution for a cleaner HUD
          >
            {INCIDENTS.map((inc) => (
              <Marker 
                key={inc.id} 
                longitude={inc.lng} 
                latitude={inc.lat} 
                anchor="center"
              >
                {/* Custom HTML Tactical Marker */}
                <div className="relative flex items-center justify-center w-8 h-8">
                  {/* Radar pulse effect */}
                  <span className="absolute inline-flex w-full h-full rounded-full bg-red-600 opacity-30 animate-ping"></span>
                  {/* Crosshair core */}
                  <div className="relative z-10 w-3 h-3 bg-red-600 border border-black transform rotate-45"></div>
                </div>
              </Marker>
            ))}
          </Map>

          {/* Map Overlay HUD (Coordinates) */}
          <div className="absolute bottom-4 right-4 bg-black/80 border border-red-600 p-2 font-seven text-lg tracking-wider text-red-500 pointer-events-none">
            LAT: 51.5074<br/>
            LON: -0.1278<br/>
            ALT: 35M
          </div>
          
          {/* Top Left Overlay HUD */}
          <div className="absolute top-4 left-4 bg-black/80 border border-red-600 p-2 font-seven text-sm tracking-widest text-red-500 pointer-events-none">
            SAT_UPLINK: SECURE<br/>
            MARKERS: {INCIDENTS.length}
          </div>
          
          {/* Scanline Overlay Effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-40"></div>
        </div>
      </div>
    </div>
  );
}