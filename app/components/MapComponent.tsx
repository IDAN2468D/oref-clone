"use client";
import React, { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Basic Map bounds & coordinates for demonstration context
const cityCoordinates: Record<string, [number, number]> = {
    "תל אביב - יפו": [32.0853, 34.7818],
    "רמת גן": [32.0823, 34.8106],
    "גבעתיים": [32.0722, 34.8089],
    "חיפה": [32.7940, 34.9896],
    "ירושלים": [31.7683, 35.2137],
    "באר שבע": [31.2518, 34.7913],
    "אשדוד": [31.8014, 34.6435],
    "אשקלון": [31.6693, 34.5715],
    "שדרות": [31.5229, 34.5956],
    "אזור בדיקה (סימולציה)": [32.1, 34.85], // Simulated location slightly off
};

// Component to dynamically pan the map when alerts happen or GPS locks
function MapUpdater({ activeCities, userCoords }: { activeCities: string[], userCoords?: [number, number] | null }) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        // Wrap in timeout so react-leaflet finishes adding its DOM panes (prevents appendChild error)
        const flyTimer = setTimeout(() => {
            if (activeCities.length > 0) {
                // Priority 1: Focus on threats
                const firstTarget = activeCities[0];
                let hash = 0;
                for (let i = 0; i < firstTarget.length; i++) {
                    hash = firstTarget.charCodeAt(i) + ((hash << 5) - hash);
                }
                const deterministicOffset = Math.abs(hash);

                const targetCoords = cityCoordinates[firstTarget] || [31.5 + ((deterministicOffset * 0.1) % 1 - 0.5), 34.8 + ((deterministicOffset * 0.05) % 0.5 - 0.25)];

                map.flyTo(targetCoords as [number, number], 10, {
                    animate: true,
                    duration: 1.5
                });
            } else if (userCoords) {
                // Priority 2: Focus on user location if locked
                map.flyTo(userCoords, 12, {
                    animate: true,
                    duration: 2
                });
            } else {
                // Priority 3: Country-wide view
                map.flyTo([31.5, 34.8], 7, {
                    animate: true,
                    duration: 2
                });
            }
        }, 300);

        return () => clearTimeout(flyTimer);
    }, [activeCities, userCoords, map]);

    return null;
}

interface AlertData {
    id: string;
    cities: string[] | string;
    timestamp: string;
    [key: string]: unknown;
}

interface MapContentProps {
    activeCities: string[];
    isHeatmap?: boolean;
    history?: AlertData[];
    userCoords?: [number, number] | null;
}

// Next.js dynamic imports wrap this component.
function MapContent({ activeCities, isHeatmap = false, history = [], userCoords = null }: MapContentProps) {
    // `isMounted` hack is no longer strictly necessary with Next.js dynamic imports using ssr: false.
    // However, if we need it for specific Leaflet hydration logic downstream, we would use a layout effect or
    // simply trust the dynamic import bounds. Since this is already `ssr: false`, we can skip the artificial block.

    return (
        <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700">
            <MapContainer
                center={[31.5, 34.8]}
                zoom={7}
                minZoom={7}
                maxBounds={[
                    [29.0, 33.5], // South West Israel
                    [33.5, 36.5]  // North East Israel / Golan
                ]}
                maxBoundsViscosity={1.0}
                style={{ height: "100%", width: "100%", zIndex: 0, backgroundColor: "#020617" }}
                zoomControl={false}
                scrollWheelZoom={false}
                dragging={true}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">Carto</a>'
                />

                <MapUpdater activeCities={activeCities} userCoords={userCoords} />

                {/* User GPS location pulsing marker */}
                {userCoords && (
                    <React.Fragment>
                        <CircleMarker
                            center={userCoords}
                            radius={20}
                            pathOptions={{
                                color: "transparent",
                                fillColor: "#3b82f6", // Blue pulse
                                fillOpacity: 0.3,
                                className: "animate-ping"
                            }}
                        />
                        <CircleMarker
                            center={userCoords}
                            radius={8}
                            pathOptions={{
                                color: "#ffffff",
                                weight: 2,
                                fillColor: "#2563eb",
                                fillOpacity: 1,
                            }}
                        >
                            <Tooltip direction="top" permanent={false} className="font-sans font-bold">
                                📍 Command Center (GPS Lock)
                            </Tooltip>
                        </CircleMarker>
                    </React.Fragment>
                )}

                {/* Draw Heatmap if enabled */}
                {isHeatmap && history && history.length > 0 && (
                    history.slice(0, 30).flatMap((alert, idx) => {
                        const cities = Array.isArray(alert.cities) ? alert.cities : [alert.cities];
                        return cities.map((city, cityIdx) => {
                            let hash = 0;
                            for (let i = 0; i < city.length; i++) {
                                hash = city.charCodeAt(i) + ((hash << 5) - hash);
                            }
                            const deterministicOffset = Math.abs(hash);
                            const coords = cityCoordinates[city] || [31.5 + ((deterministicOffset * 0.1) % 1 - 0.5), 34.8 + ((deterministicOffset * 0.05) % 0.5 - 0.25)];

                            // Intensity fades out over time (the deeper the index, the fainter)
                            const currentOpacity = Math.max(0.1, 0.4 - (idx * 0.015));

                            return (
                                <CircleMarker
                                    key={`heat-${idx}-${cityIdx}-${hash}`}
                                    center={coords as [number, number]}
                                    radius={40}
                                    pathOptions={{
                                        color: "transparent",
                                        fillColor: "#ef4444",
                                        fillOpacity: currentOpacity,
                                    }}
                                />
                            );
                        });
                    })
                )}

                {/* Draw active blips on map */}
                {(!isHeatmap || activeCities.length > 0) && activeCities.map((city, idx) => {
                    // Hash string to scatter unknown cities transparently across Israel bounds
                    let hash = 0;
                    for (let i = 0; i < city.length; i++) {
                        hash = city.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const deterministicOffset = Math.abs(hash);

                    const coords = cityCoordinates[city] || [31.5 + ((deterministicOffset * 0.1) % 1 - 0.5), 34.8 + ((deterministicOffset * 0.05) % 0.5 - 0.25)];
                    const isThreatLevelSevere = city.includes("תל אביב") || city.includes("חיפה") || city.includes("ירושלים");

                    return (
                        <React.Fragment key={`marker-group-${city}-${idx}-${hash}`}>
                            {/* Blast Radius Ripple Wrapper using divIcon internally via CSS or just extra layered markers */}
                            <CircleMarker
                                center={coords as [number, number]}
                                radius={isThreatLevelSevere ? 80 : 50}
                                pathOptions={{
                                    color: "transparent",
                                    fillColor: "#f97316", // Orange blast
                                    fillOpacity: 0.15,
                                    className: "animate-ping" // native tailwind animate-ping
                                }}
                            />

                            {/* Core Hit Marker */}
                            <CircleMarker
                                center={coords as [number, number]}
                                radius={activeCities.length > 10 ? 20 : 30}
                                pathOptions={{
                                    color: "#ff0000",
                                    fillColor: "#ef4444",
                                    fillOpacity: 0.6,
                                    weight: 3,
                                    className: "animate-radar-ping" // custom radar ping
                                }}
                            >
                                <Tooltip className="font-sans font-bold text-center" direction="top" opacity={0.9}>
                                    {isHeatmap ? '🔥' : '🔴'} <br /> {city} <br /> {isHeatmap ? 'מוקד תקיפה' : 'תחת מתקפה'}
                                </Tooltip>
                            </CircleMarker>
                        </React.Fragment>
                    );
                })}
            </MapContainer>

            {/* RADAR SWEEP OVERLAY */}
            {!isHeatmap && activeCities.length === 0 && (
                <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] rounded-full border border-emerald-500/10 pointer-events-none" style={{ transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                    <div className="absolute top-0 right-1/2 w-1/2 h-1/2 bg-[conic-gradient(from_0deg_at_100%_100%,rgba(16,185,129,0)_0deg,rgba(16,185,129,0.3)_90deg)] animate-radar-sweep border-r-2 border-emerald-400"></div>
                </div>
            )}

            {/* RADAR TARGETING CROSSHAIRS GUI */}
            <div className="absolute inset-0 pointer-events-none z-10 opacity-30">
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-emerald-500/20"></div>
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-emerald-500/20"></div>
                <div className="absolute top-1/2 left-1/2 w-32 h-32 border border-emerald-500/30 rounded-full" style={{ transform: 'translate(-50%, -50%)' }}></div>
                <div className="absolute top-1/2 left-1/2 w-64 h-64 border border-emerald-500/20 rounded-full" style={{ transform: 'translate(-50%, -50%)' }}></div>
                <div className="absolute top-1/2 left-1/2 w-96 h-96 border border-emerald-500/10 rounded-full" style={{ transform: 'translate(-50%, -50%)' }}></div>
            </div>
        </div>
    );
}

export default MapContent;
