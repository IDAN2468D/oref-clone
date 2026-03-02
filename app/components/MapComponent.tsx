"use client";
import React, { useEffect, useState, memo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, Polyline, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// --- TACTICAL COORDINATE DATABASE ---
const rawCityCoordinates: Record<string, [number, number]> = {
    "תל אביב - יפו": [32.0853, 34.7818],
    "תל אביב-יפו": [32.0853, 34.7818],
    "רמת גן": [32.0823, 34.8106],
    "גבעתיים": [32.0722, 34.8089],
    "חיפה": [32.7940, 34.9896],
    "ירושלים": [31.7683, 35.2137],
    "באר שבע": [31.2518, 34.7913],
    "אשדוד": [31.8014, 34.6435],
    "אשקלון": [31.6693, 34.5715],
    "שדרות": [31.5229, 34.5956],
    "אילת": [29.5581, 34.9482],
    "אילות": [29.58, 34.96],
    "קריית שמונה": [33.2078, 35.5694],
    "מטולה": [33.2842, 35.5806],
    "כפר גלעדי": [33.24, 35.57],
    "חולון": [32.0158, 34.7874],
    "ראשון לציון": [31.973, 34.7925],
    "פתח תקווה": [32.084, 34.887],
    "נתיבות": [31.4222, 34.5886],
    "אופקים": [31.3125, 34.6208],
    "מבשרת ציון": [31.8033, 35.155],
    "בית שמש": [31.747, 34.988],
    "נהריה": [32.992, 35.101],
    "עכו": [32.933, 35.083],
    "מעלות תרשיחא": [33.013, 35.267],
    "נשר": [32.766, 35.041],
    "טירת כרמל": [32.763, 34.974],
    "הקריות": [32.83, 35.08],
    "כרמיאל": [32.913, 35.295],
    "עפולה": [32.61, 35.29],
    "אזור בדיקה (סימולציה)": [32.1, 34.85],
};

// Tactical Normalization to match varying naming conventions from Oref APIs
const cityCoordinates = new Proxy(rawCityCoordinates, {
    get(target, name: string) {
        if (typeof name !== 'string') return undefined;
        const normalized = name.replace(/\s*-\s*/, '-').trim();
        const altNormalized = name.replace(/-/, ' - ').trim();
        return target[name] || target[normalized] || target[altNormalized];
    }
});

// --- UTILS ---
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// --- SUB-COMPONENTS ---

function MapUpdater({ activeCities, userCoords }: { activeCities: string[], userCoords?: [number, number] | null }) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;
        const flyTimer = setTimeout(() => {
            if (activeCities.length > 0) {
                const firstTarget = activeCities[0];
                const coords = cityCoordinates[firstTarget] || [31.5, 35.1];
                map.flyTo(coords, 10, { animate: true, duration: 1.5 });
            } else if (userCoords) {
                map.flyTo(userCoords, 12, { animate: true, duration: 2 });
            } else {
                map.flyTo([31.5, 35.1], 8.5, { animate: true, duration: 2 });
            }
        }, 300);
        return () => clearTimeout(flyTimer);
    }, [activeCities, userCoords, map]);

    return null;
}

function OrbitalSatellites() {
    const [angle, setAngle] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setAngle(prev => (prev + 0.5) % 360), 50);
        return () => clearInterval(interval);
    }, []);

    const radius = 1.2;
    const center: [number, number] = [31.5, 35.1];
    const satPos: [number, number] = [
        center[0] + radius * Math.cos(angle * Math.PI / 180),
        center[1] + radius * Math.sin(angle * Math.PI / 180)
    ];

    return (
        <>
            <CircleMarker center={satPos} radius={3} pathOptions={{ color: "#38bdf8", fillColor: "#0ea5e9", fillOpacity: 0.9 }}>
                <Tooltip direction="right" permanent className="satellite-label">🛰️ SAT-GEO-1</Tooltip>
            </CircleMarker>
            <Polyline positions={[satPos, center]} pathOptions={{ color: "#38bdf8", weight: 0.5, opacity: 0.2, dashArray: "2,4" }} />
        </>
    );
}

// --- INTERFACES ---
interface AlertData {
    id: string;
    cities: string[] | string;
    timestamp: string;
}

interface MapContentProps {
    activeCities: string[];
    isHeatmap?: boolean;
    history?: AlertData[];
    userCoords?: [number, number] | null;
    reports?: { id: string; lat: number; lng: number; type: string; timestamp: string }[];
    shelterRoute?: [number, number] | null;
}

// --- MAIN CONTENT COMPONENT ---
const MapContent = memo(({ activeCities, isHeatmap = false, history = [], userCoords, reports = [], shelterRoute }: MapContentProps) => {
    const [threatDistance, setThreatDistance] = useState<number | null>(null);

    useEffect(() => {
        if (activeCities.length > 0 && userCoords) {
            let minDistance = Infinity;
            activeCities.forEach(city => {
                const coords = cityCoordinates[city];
                if (coords) {
                    const d = getDistance(userCoords[0], userCoords[1], coords[0], coords[1]);
                    if (d < minDistance) minDistance = d;
                }
            });
            setThreatDistance(minDistance === Infinity ? null : Math.round(minDistance));
        } else {
            setThreatDistance(null);
        }
    }, [activeCities, userCoords]);

    return (
        <div className="w-full h-full relative group">
            <MapContainer
                center={[31.8, 35.1]}
                zoom={8.5}
                className="h-full w-full"
                zoomControl={false}
                attributionControl={false}
                style={{ background: "#010413" }}
                maxBounds={[[29.0, 33.0], [34.5, 37.0]]}
                minZoom={7.5}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    className="brightness-[1.1] contrast-[1.3] saturate-0 opacity-100"
                />

                <MapUpdater activeCities={activeCities} userCoords={userCoords} />
                <OrbitalSatellites />

                {/* ACTIVE THREATS */}
                {activeCities.map((city, idx) => {
                    const coords = cityCoordinates[city];
                    if (!coords) return null;
                    return (
                        <React.Fragment key={`active-${city}-${idx}`}>
                            <Circle center={coords} radius={3000} pathOptions={{ color: "transparent", fillColor: "#ef4444", fillOpacity: 0.2, className: "animate-ping" }} />
                            <CircleMarker center={coords} radius={15} pathOptions={{ color: "#ff0000", fillColor: "#ef4444", fillOpacity: 0.6, weight: 3, className: "animate-radar-ping" }}>
                                <Tooltip permanent direction="top" className="tactical-tooltip"><span className="font-bold text-red-500 uppercase">{city}</span></Tooltip>
                            </CircleMarker>
                        </React.Fragment>
                    );
                })}

                {/* CITIZEN INTEL */}
                {reports.map(r => (
                    <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={8} pathOptions={{ color: r.type === 'Explosion' ? '#ef4444' : '#06b6d4', weight: 2, fillOpacity: 0.6, dashArray: '5,5' }}>
                        <Tooltip direction="top">
                            <div className="bg-slate-900/90 border border-white/10 p-1.5 rounded-lg text-white shadow-xl">
                                <span className={`text-[9px] font-black uppercase ${r.type === 'Explosion' ? 'text-red-400' : 'text-cyan-400'}`}>{r.type === 'Explosion' ? '💥 IMPACT' : '⚡ INTERCEPT'}</span>
                                <div className="text-[7px] text-slate-500 font-mono mt-0.5">{new Date(r.timestamp).toLocaleTimeString()}</div>
                            </div>
                        </Tooltip>
                    </CircleMarker>
                ))}

                {/* SHELTER PATH */}
                {shelterRoute && userCoords && (
                    <Polyline positions={[userCoords, shelterRoute]} pathOptions={{ color: '#22c55e', weight: 4, dashArray: '10,10', opacity: 0.8 }}>
                        <Tooltip permanent direction="center">
                            <div className="bg-green-600 border border-green-400 px-2 py-1 rounded text-white shadow-2xl">
                                <span className="font-black text-[9px] uppercase tracking-widest">SHELTER PATH</span>
                            </div>
                        </Tooltip>
                    </Polyline>
                )}

                {/* USER POSITION */}
                {userCoords && (
                    <CircleMarker center={userCoords} radius={10} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}>
                        <Tooltip>Command Center (GPS Lock)</Tooltip>
                    </CircleMarker>
                )}
            </MapContainer>

            {/* SONAR UI OVERLAY */}
            <div className="absolute inset-0 pointer-events-none z-[400] overflow-hidden sonar-glow">
                {/* Background Grid */}
                <div className="absolute inset-0 radar-grid-pattern opacity-20" />

                {/* Concentric Sonar Rings */}
                <div className="radar-ring w-[200px] h-[200px]" />
                <div className="radar-ring w-[400px] h-[400px]" />
                <div className="radar-ring w-[600px] h-[600px]" />
                <div className="radar-ring w-[800px] h-[800px] border-dashed" />

                {/* Tactical Crosshairs */}
                <div className="absolute inset-0">
                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-emerald-500/20" />
                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-emerald-500/20" />

                    {/* Tick Marks */}
                    <div className="absolute left-1/2 top-1/4 w-4 h-[1px] bg-emerald-500/40 -translate-x-1/2" />
                    <div className="absolute left-1/2 top-3/4 w-4 h-[1px] bg-emerald-500/40 -translate-x-1/2" />
                    <div className="absolute top-1/2 left-1/4 h-4 w-[1px] bg-emerald-500/40 -translate-y-1/2" />
                    <div className="absolute top-1/2 left-3/4 h-4 w-[1px] bg-emerald-500/40 -translate-y-1/2" />
                </div>

                {/* Sonar Sweep (Active scanning) */}
                <div className="absolute top-1/2 left-1/2 w-[1000px] h-[1000px] -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute top-0 right-1/2 w-1/2 h-1/2 bg-[conic-gradient(from_0deg_at_100%_100%,rgba(16,185,129,0)_0deg,rgba(16,185,129,0.2)_60deg,rgba(16,185,129,0.4)_90deg)] animate-radar-sweep origin-bottom-right border-r-2 border-emerald-400/50 blur-[2px]" />
                </div>

                {/* TACTICAL HUD ELEMENTS (Corner Readouts) */}
                <div className="absolute top-6 left-6 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest font-mono">System Live</span>
                    </div>
                    <div className="text-[8px] text-emerald-500/60 font-mono">SCAN_FREQ: 2.4 GHz</div>
                    <div className="text-[8px] text-emerald-500/60 font-mono">AZIMUTH: {(Math.random() * 360).toFixed(2)}°</div>
                </div>

                <div className="absolute bottom-6 right-6 text-right font-mono">
                    <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">Target Acquisition: {activeCities.length > 0 ? 'LOCKED' : 'STANDBY'}</div>
                    <div className="text-[8px] text-emerald-500/40 mt-1">LAT: 31.0461 | LNG: 34.8516</div>
                </div>
            </div>

            {/* THREAT HUD */}
            {threatDistance !== null && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-950/90 border border-red-500/50 px-4 py-2 rounded-2xl backdrop-blur-xl z-[500] flex flex-col items-center shadow-2xl animate-pulse">
                    <span className="text-[9px] text-red-300 font-black tracking-widest uppercase mb-1">Target Proximity</span>
                    <div className="text-2xl font-black text-red-500 font-mono flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-600 animate-ping mr-1"></div>
                        {threatDistance} <span className="text-xs">KM</span>
                    </div>
                </div>
            )}
        </div>
    );
});

export default MapContent;
