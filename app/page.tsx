"use client";
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ShieldAlert, History, Volume2, VolumeX, Globe, Moon, Share2, Search, Activity, BarChart3, MapPin, AlertTriangle, MonitorPlay, X, CheckCircle, BrainCircuit, Layers, LineChart, Bell, BellOff, Crosshair, Map as MapIcon, Menu } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';

// Dynamic imports to prevent SSR errors with heavy/DOM-dependent libraries
const LiveMap = dynamic(() => import('./components/MapComponent'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-900 opacity-50 animate-pulse rounded-xl border border-slate-700 flex items-center justify-center text-slate-500">טוען מפת מכ&quot;ם...</div>
});
const StatsChart = dynamic(() => import('./components/ChartComponent'), { ssr: false });

interface AlertData {
  id: string;
  title?: string;
  cities: string[] | string;
  timestamp: string;
  [key: string]: unknown;
}

export default function Home() {
  // State configuration
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);
  const [history, setHistory] = useState<AlertData[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isTTSOn, setIsTTSOn] = useState(false);
  const [filterCity, setFilterCity] = useState("");
  const [lastUpdateTime, setLastUpdateTime] = useState("");
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [showAllClear, setShowAllClear] = useState(false);
  const [systemMessage, setSystemMessage] = useState("");

  // NEW FEATURES STATE
  const [isLTR, setIsLTR] = useState(false);
  const [isHeatmap, setIsHeatmap] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [aiInsight, setAiInsight] = useState("מערכת ה-AI עוקבת אחר מגמות הירי ומחשבת אזורי מיקוד...");
  const [isPushOn, setIsPushOn] = useState(false);
  const [isGPSLocked, setIsGPSLocked] = useState(false);
  const [timeToCover, setTimeToCover] = useState<number | null>(null);
  const [isTimeMachineActive, setIsTimeMachineActive] = useState(false);
  const [isDarkOpsMode, setIsDarkOpsMode] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [osintUpdates, setOsintUpdates] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs to track previous states without re-triggering hooks needlessly
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousHistoryLength = useRef(0);

  // Initialize Service Worker for Push Notifications
  useEffect(() => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => console.log('SW Registered:', registration.scope),
        (err) => console.error('SW Registration failed:', err)
      );
      if (Notification.permission === 'granted') {
        setIsPushOn(true);
      }
    }
  }, []);

  // Fetch OSINT feeds once on mount
  useEffect(() => {
    fetch('/api/osint')
      .then(res => res.json())
      .then(data => {
        if (data.updates) setOsintUpdates(data.updates);
      })
      .catch(console.error);
  }, []);

  // Poll server for live API states
  useEffect(() => {
    if (isTimeMachineActive) return;

    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/alerts');
        if (!res.ok) return;

        const data = await res.json();
        const rawActive = (data.active && data.active.data) || [];

        // Oref API sometimes sends system messages (like "All Clear" or instructions) disguised as target names.
        // We catch them so they don't trigger the red siren banner, and instead parse them for context.
        const incomingActive = rawActive.filter((c: string) => !c.includes("ניתן לצאת") && !c.includes("הנחיות") && !c.includes("אך יש להישאר"));
        const customMessageStr = rawActive.find((c: string) => c.includes("ניתן לצאת") || c.includes("הנחיות") || c.includes("אך יש להישאר"));
        const hasAllClearMessage = !!customMessageStr;

        if (customMessageStr) setSystemMessage(customMessageStr);

        // Update active displays. Reset dismiss if alert data strictly changes.
        setActiveAlerts(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(incomingActive)) {
            // If we're getting a new active alert state (different target)
            setIsBannerDismissed(false);

            // Log that we are under attack to trigger 'All Clear' later
            if (incomingActive.length > 0) {
              setShowAllClear(false);
            }
            // If active alerts dropped to 0, but we were previously under attack, show ALL CLEAR
            else if ((incomingActive.length === 0 && prev.length > 0) || hasAllClearMessage) {
              setShowAllClear(true);
            }

            return incomingActive;
          }

          if (hasAllClearMessage && incomingActive.length === 0) {
            setShowAllClear(true);
          }

          return prev;
        });

        // Track History
        if (data.saved_alerts) {
          const newLength = data.saved_alerts.length;
          // Check if there's genuinely a new alert hitting the stack
          if (previousHistoryLength.current > 0 && newLength > previousHistoryLength.current) {
            const newlyAddedArr = incomingActive.length > 0 ? incomingActive : (Array.isArray(data.saved_alerts[0].cities) ? data.saved_alerts[0].cities : [data.saved_alerts[0].cities]); // best effort

            // Threat check: If user typed specific zones, split by comma to allow Multi-Zone Tracking
            const monitoredZones = filterCity.split(',').map(z => z.trim()).filter(z => z !== "");
            const isThreatToUser = monitoredZones.length === 0 || newlyAddedArr.some((c: string) => monitoredZones.some(zone => c.includes(zone)));

            // Only trigger sirens if valid targets exist (not system messages)
            if (isThreatToUser && newlyAddedArr.some((c: string) => !c.includes("ניתן לצאת") && !c.includes("אך יש להישאר"))) {
              // Trigger Visual/Graphic Siren
              if (!isMuted && audioRef.current) {
                audioRef.current.play().catch(e => console.log("Init audio error:", e));
              }

              // Trigger Text-To-Speech
              if (isTTSOn && window.speechSynthesis) {
                const speechStr = isLTR
                  ? `Warning! Incoming attack detected at ${Array.isArray(newlyAddedArr) ? newlyAddedArr.join(', ') : newlyAddedArr}. Please take cover.`
                  : `צבע אדום ב: ${Array.isArray(newlyAddedArr) ? newlyAddedArr.join(', ') : newlyAddedArr}`;
                const speech = new SpeechSynthesisUtterance(speechStr);
                speech.lang = isLTR ? 'en-US' : 'he-IL';
                speech.rate = 1.1; // Make it sound urgent!
                speech.pitch = 0.9;
                window.speechSynthesis.speak(speech);
              }

              // Trigger Push Notification (only if backgrounded/unfocused or specifically opted in)
              if (isPushOn && Notification.permission === 'granted') {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification('צבע אדום!', {
                    body: `התרעה מאומתת: ${Array.isArray(newlyAddedArr) ? newlyAddedArr.join(', ') : newlyAddedArr}`,
                    icon: '/icon-192x192.png',
                    tag: 'oref-alert'
                  });
                });
              }
            }
          }
          previousHistoryLength.current = newLength;
          setHistory(data.saved_alerts);
        }

        // Live Clock Tick
        const now = new Date();
        setLastUpdateTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);

      } catch (e) {
        console.error("Signal Drop:", e);
      }
    };
    fetchAlerts();
    const intervalId = setInterval(fetchAlerts, 2000); // Poll every 2 seconds for intense response times
    return () => clearInterval(intervalId);
  }, [filterCity, isMuted, isTTSOn, isPushOn, isLTR, isTimeMachineActive]);

  // TIME TO COVER EVALUATOR & CLOCK TICKER
  useEffect(() => {
    if (activeAlerts.length > 0) {
      const fullString = activeAlerts.join(" ");
      let time = 60; // default 1 min
      if (fullString.includes("שדרות") || fullString.includes("עוטף") || fullString.includes("אשקלון")) time = 15;
      else if (fullString.includes("תל אביב") || fullString.includes("מרכז") || fullString.includes("חיפה")) time = 90;
      else if (fullString.includes("ירושלים")) time = 90;

      setTimeToCover(time);
    } else {
      setTimeToCover(null);
    }
  }, [activeAlerts]);

  useEffect(() => {
    if (timeToCover !== null && timeToCover > 0) {
      const timer = setInterval(() => setTimeToCover(prev => (prev !== null && prev > 0 ? prev - 1 : 0)), 1000);
      return () => clearInterval(timer);
    }
  }, [timeToCover]);

  // AI ANALYST UPDATE LOGIC
  useEffect(() => {
    // Only invoke Gemini if we have some data
    if (history.length === 0 && activeAlerts.length === 0) return;

    const fetchAiInsight = async () => {
      try {
        const res = await fetch('/api/ai-analyst', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeAlerts: activeAlerts,
            history: history,
            isLTR: isLTR
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.insight) {
            setAiInsight(data.insight);
            // Trigger Telegram Notification integration for major operations
            if (activeAlerts.length >= 3) {
              fetch('/api/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `🔴 *Oref AI Tactical Update*\nTargets Active: ${activeAlerts.length}\nSystem Insight: ${data.insight}` })
              }).catch(() => console.error("Telegram dispatcher silent drop"));
            }
          }
        }
      } catch (e) {
        console.error("AI Insight Error:", e);
      }
    };

    // Use a small delay/debounce so it doesn't fire 10 times a second during cascading updates
    const timer = setTimeout(() => {
      fetchAiInsight();
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlerts.length, history.length, isLTR]);


  // Helper Handlers
  const simulateAlert = async () => await fetch('/api/simulate', { method: 'POST' });

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Silent unlock trick
    if (isMuted && audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        if (audioRef.current) audioRef.current.currentTime = 0;
      }).catch(() => { });
    }
  };

  const togglePush = async () => {
    if (!('Notification' in window)) return alert("הדפדפן שלך לא תומך בהתראות פוש.");

    if (Notification.permission === 'granted') {
      setIsPushOn(!isPushOn);
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setIsPushOn(true);
      }
    } else {
      alert("התראות חסומות אצלך בדפדפן. שחרר את החסימה דרך המנעול בשורת הכתובת.");
    }
  };

  const toggleGPS = () => {
    if (isGPSLocked) {
      setIsGPSLocked(false);
      setFilterCity("");
      setUserCoords(null);
      return;
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords([lat, lng]);
        setIsGPSLocked(true);

        // Live Reverse Geocoding to get actual localized city instead of generic hardcoded regions
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=he`)
          .then(res => res.json())
          .then(data => {
            const realCity = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "";
            if (realCity) {
              setFilterCity(realCity.replace('מועצה מקומית ', '').trim());
            } else {
              setFilterCity(""); // Default back to all if unseen territory
            }
          })
          .catch(() => setFilterCity(""));

      }, () => {
        alert("לא אושר מיקום או שיש בעיית קליטה.");
      }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    }
  };

  const triggerTimeMachine = () => {
    if (isTimeMachineActive) return;
    setIsTimeMachineActive(true);
    setActiveAlerts([]);
    setHistory([]);
    let step = 0;

    // Historical Replication: April 13th Iranian Attack (Mock)
    const iranianPlayback = [
      { id: 'tm1', cities: ['באר שבע', 'דימונה', 'אילת', 'שדרות'], title: 'ירי רקטות וטילים', timestamp: new Date().toISOString() },
      { id: 'tm2', cities: ['תל אביב - יפו', 'רמת גן', 'ירושלים', 'חולון'], title: 'ירי רקטות וטילים', timestamp: new Date(Date.now() + 5000).toISOString() },
      { id: 'tm3', cities: ['אילת'], title: 'חדירת כלי טיס עוין', timestamp: new Date(Date.now() + 10000).toISOString() },
      { id: 'tm4', cities: ['חיפה - כרמל', 'הקריות'], title: 'ירי רקטות וטילים', timestamp: new Date(Date.now() + 15000).toISOString() },
    ];

    const simulateInterval = setInterval(() => {
      if (step >= iranianPlayback.length) {
        clearInterval(simulateInterval);
        setTimeout(() => {
          setIsTimeMachineActive(false);
          setActiveAlerts([]);
        }, 8000);
        return;
      }

      const alert = iranianPlayback[step];
      setActiveAlerts(prev => [...prev, ...alert.cities]);
      setHistory(prev => [alert, ...prev]);

      // Dynamic Sounds Evaluator
      if (!isMuted && audioRef.current) {
        if (alert.title.includes("כלי טיס")) audioRef.current.src = "https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg";
        else audioRef.current.src = "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg";

        audioRef.current.play().catch(e => console.log("TM audio error:", e));
      }

      if (isTTSOn && window.speechSynthesis) {
        const speech = new SpeechSynthesisUtterance(`צבע אדום ב: ${alert.cities.join(', ')}`);
        speech.lang = 'he-IL';
        speech.rate = 1.1;
        window.speechSynthesis.speak(speech);
      }
      step++;
    }, 4500);
  };


  const monitoredZones = filterCity.split(',').map(z => z.trim()).filter(z => z !== "");
  const isTargetedCurrently = activeAlerts.length > 0 &&
    (monitoredZones.length === 0 || activeAlerts.some(c => monitoredZones.some(zone => c.includes(zone))));

  const dynamicSrc = history.length > 0 && history[0].title?.includes("כלי טיס")
    ? "https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg"
    : "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg";

  useEffect(() => {
    if (isDarkOpsMode) {
      document.body.classList.add('dark-ops-mode');
    } else {
      document.body.classList.remove('dark-ops-mode');
    }
  }, [isDarkOpsMode]);

  const exportSituationReport = async () => {
    if (!containerRef.current) return;
    try {
      // const canvas = await html2canvas(containerRef.current, { backgroundColor: '#000000' });
      // const imgData = canvas.toDataURL('image/jpeg', 0.8);

      const text = isLTR
        ? `🚨 Tactical Alert: Active threat in ${activeAlerts.join(", ")}. Insight: ${aiInsight}`
        : `🚨 עדכון חמ"ל פיקוד: אירוע פעיל ב${activeAlerts.join(", ")}. פרשנות כלי ה-AI: ${aiInsight}`;

      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
      // In a real mobile environment (Cordova/Capacitor/Web Share API), we would share the actual image blob:
      // navigator.share({ files: [new File([blob], 'report.jpg')], title: 'Situation Report', text: text });
    } catch (e) {
      console.error("Exports failed", e);
    }
  };

  return (
    <div ref={containerRef} className={`min-h-screen transition-colors duration-700 relative overflow-hidden ${isTargetedCurrently ? 'bg-red-950/20' : 'bg-[#020617]'} ${isDarkOpsMode ? 'dark-ops-mode' : ''}`}>
      <audio ref={audioRef} src={dynamicSrc} preload="auto" />

      {/* Background Graphic Grid */}
      <div className="absolute inset-0 z-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.03] animate-pulse pointer-events-none" />

      {/* --- PREMIUM TOP NAVBAR --- */}
      <nav className="glass-panel sticky top-0 z-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 backdrop-blur-3xl">
        <div className="flex items-center justify-between w-full relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center p-1.5 sm:p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg shadow-red-500/20">
              <ShieldAlert className="text-white drop-shadow-md shrink-0" size={24} />
            </div>
            <div className={`text-right ${isLTR ? 'text-left' : ''}`}>
              <h1 className="font-black text-lg sm:text-2xl tracking-tight text-white m-0 leading-tight">
                {isLTR ? "National Command Center" : "מרכז שליטה ארצי"}
              </h1>
              <p className="text-slate-400 text-[10px] sm:text-xs font-mono m-0 hidden sm:block">
                {isLTR ? "Home Front Command | Tactical Dashboard" : "פיקוד העורף | מערכת טקטית"}
              </p>
            </div>
          </div>

          {/* MOBILE HAMBURGER TOGGLE */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden p-2 bg-slate-800 border border-slate-700 text-white rounded-lg hover:bg-slate-700 transition"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* DESKTOP/TABLET ACTIONS (Hidden on Mobile) */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            <button onClick={exportSituationReport} className="flex items-center justify-center p-2 sm:p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-green-400 rounded-xl transition-colors shrink-0" title={isLTR ? "Export Situation to WhatsApp" : "שתף תמונת מצב לוואטסאפ"}>
              <Share2 size={18} />
            </button>
            <button onClick={() => setIsDarkOpsMode(!isDarkOpsMode)} className={`flex items-center justify-center p-2 sm:p-3 border rounded-xl transition-colors shrink-0 ${isDarkOpsMode ? 'bg-black border-slate-700 text-blue-500 shadow-[0_0_15px_rgba(0,0,255,0.2)]' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'}`} title={isLTR ? "Dark Ops Mode" : "מצב חדר מלחמה / Blackout"}>
              <Moon size={18} className={isDarkOpsMode ? 'fill-blue-500' : ''} />
            </button>
            <button onClick={() => { setIsLTR(!isLTR); document.documentElement.dir = !isLTR ? "ltr" : "rtl"; }} className="flex items-center justify-center p-2 sm:p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors shrink-0" title={isLTR ? "Switch to Hebrew" : "שנה שפה לאנגלית"}>
              <Globe size={18} />
            </button>
            <button onClick={() => setShowAnalyticsModal(true)} className="flex items-center justify-center p-2 sm:p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors shrink-0" title={isLTR ? "Deep Analytics" : "ניתוח עומק"}>
              <LineChart size={18} />
            </button>

            <button onClick={triggerTimeMachine} disabled={isTimeMachineActive} className={`group relative flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r ${isTimeMachineActive ? "from-purple-900 to-indigo-900 animate-pulse border-purple-400" : "from-slate-800 to-slate-900 border-slate-700"} border text-slate-200 text-sm font-semibold rounded-full transition-all duration-300 shadow-md hover:from-slate-700 hover:to-slate-800`}>
              <History size={16} className={`${isTimeMachineActive ? 'text-purple-400 animate-spin' : 'text-purple-500'}`} />
              <span className="leading-tight whitespace-nowrap font-bold text-xs">{isLTR ? "Time Machine" : "מכונת זמן"}</span>
            </button>

            <button onClick={simulateAlert} className="group relative flex items-center justify-center gap-2 px-4 py-2 mr-1 bg-gradient-to-r from-red-950/40 to-slate-900 border border-red-900/50 text-slate-200 text-sm font-semibold rounded-full transition-all duration-300 shadow-md hover:from-slate-800 hover:border-red-500/50">
              <AlertTriangle size={16} className="text-yellow-500 group-hover:scale-110 transition-transform" />
              <span className="whitespace-nowrap font-bold">{isLTR ? "Simulate Test" : "טסט סימולציה"}</span>
            </button>

            <div className="flex gap-2">
              <button onClick={() => setIsTTSOn(!isTTSOn)} className={`flex items-center justify-center gap-1.5 px-3 py-2 border text-[11px] sm:text-sm font-bold rounded-full transition-colors ${isTTSOn ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                <MonitorPlay size={16} /> <span>{isTTSOn ? (isLTR ? 'Voice On' : 'קול (פעיל)') : (isLTR ? 'Voice Off' : 'קול מושתק')}</span>
              </button>
              <button onClick={toggleMute} className={`flex items-center justify-center gap-1.5 px-3 py-2 border text-[11px] sm:text-sm font-bold rounded-full transition-colors ${!isMuted ? 'bg-red-900/40 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {!isMuted ? <Volume2 size={16} className="animate-pulse" /> : <VolumeX size={16} />}
                <span>{!isMuted ? (isLTR ? 'Siren Armed' : 'סירנה דרוכה') : (isLTR ? 'Siren Muted' : 'מושתקת')}</span>
              </button>
              <button onClick={togglePush} className={`flex items-center justify-center gap-1.5 px-3 py-2 border text-[11px] sm:text-sm font-bold rounded-full transition-colors ${isPushOn ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {isPushOn ? <Bell size={16} className="animate-pulse" /> : <BellOff size={16} />}
                <span>{isPushOn ? (isLTR ? 'Push On' : 'התראות') : (isLTR ? 'Push Off' : 'התראות')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE SLIDE-DOWN MENU */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="sm:hidden overflow-hidden mt-4 pt-4 border-t border-slate-800 flex flex-col gap-3"
            >
              <div className="flex gap-2 w-full">
                <button onClick={simulateAlert} className="flex-1 group flex justify-center gap-2 px-3 py-3 bg-gradient-to-r from-red-950/40 to-slate-900 border border-red-900/50 text-slate-200 text-xs font-semibold rounded-xl transition-all w-full">
                  <AlertTriangle size={16} className="text-yellow-500" />
                  <span>{isLTR ? "Simulate" : "סימולציה"}</span>
                </button>
                <button onClick={triggerTimeMachine} disabled={isTimeMachineActive} className="flex-1 flex justify-center gap-2 px-3 py-3 bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl w-full">
                  <History size={16} className={`${isTimeMachineActive ? 'text-purple-400 animate-spin' : 'text-purple-500'}`} />
                  <span>{isLTR ? "History" : "מכונת זמן"}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportSituationReport} className="flex items-center justify-center gap-2 px-2 py-3 bg-slate-800 border border-slate-700 text-green-400 rounded-xl text-xs font-bold">
                  <Share2 size={16} /> {isLTR ? "Share" : "שיתוף"}
                </button>
                <button onClick={() => setShowAnalyticsModal(true)} className="flex items-center justify-center gap-2 px-2 py-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold">
                  <LineChart size={16} /> {isLTR ? "Analytics" : "ניתוח"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setIsDarkOpsMode(!isDarkOpsMode)} className={`flex flex-col items-center justify-center p-3 border rounded-xl ${isDarkOpsMode ? 'bg-black border-slate-700 text-blue-500' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                  <Moon size={18} className="mb-1" />
                  <span className="text-[10px]">{isLTR ? "Dark Ops" : "מצב לילה"}</span>
                </button>
                <button onClick={() => { setIsLTR(!isLTR); document.documentElement.dir = !isLTR ? "ltr" : "rtl"; }} className="flex flex-col items-center justify-center p-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl">
                  <Globe size={18} className="mb-1" />
                  <span className="text-[10px]">{isLTR ? "EN" : "עברית"}</span>
                </button>
                <button onClick={togglePush} className={`flex flex-col items-center justify-center p-3 border rounded-xl ${isPushOn ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {isPushOn ? <Bell size={18} className="mb-1" /> : <BellOff size={18} className="mb-1" />}
                  <span className="text-[10px]">{isLTR ? "Push" : "פוש"}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button onClick={() => setIsTTSOn(!isTTSOn)} className={`flex items-center justify-center gap-2 px-2 py-3 border text-xs font-bold rounded-xl ${isTTSOn ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  <MonitorPlay size={16} /> <span>{isTTSOn ? (isLTR ? 'Voice On' : 'קול פעיל') : (isLTR ? 'Voice Off' : 'קול כבוי')}</span>
                </button>
                <button onClick={toggleMute} className={`flex items-center justify-center gap-2 px-2 py-3 border text-xs font-bold rounded-xl ${!isMuted ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {!isMuted ? <Volume2 size={16} className="animate-pulse" /> : <VolumeX size={16} />}
                  <span>{!isMuted ? (isLTR ? 'Siren On' : 'סירנה דרוכה') : (isLTR ? 'Siren Muted' : 'מושתקת')}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* --- ACTIVE ALERT BANNER (Only renders when under attack) --- */}
      <AnimatePresence>
        {activeAlerts.length > 0 && !isBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -40 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-20 sm:top-24 left-1/2 transform -translate-x-1/2 z-[100] w-[95%] sm:w-[90%] max-w-4xl"
            data-testid="active-alert-banner"
          >
            <div className="relative bg-gradient-to-br from-red-600/95 via-red-800/95 to-slate-900/95 backdrop-blur-2xl border border-red-500/50 rounded-2xl sm:rounded-3xl shadow-[0_15px_60px_-10px_rgba(239,68,68,0.5)] overflow-hidden">

              {/* Visual pulse background */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/20 via-transparent to-transparent animate-pulse" />
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-red-300 to-transparent opacity-50" />

              <button
                onClick={() => setIsBannerDismissed(true)}
                className="absolute top-4 left-4 z-50 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white/70 hover:text-white transition-all border border-white/10 hover:border-white/30 hover:scale-105"
                title="הסתר התרעה"
              >
                <X size={18} />
              </button>

              <div className="bg-red-950/80 border-b border-red-500/50 w-full py-3 sm:py-3.5 px-4 sm:px-6 flex justify-between items-center text-red-100 text-xs sm:text-sm shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(45deg, #000 0, #000 10px, #ef4444 10px, #ef4444 20px)" }} />

                <div className="flex items-center gap-2.5 z-10 pr-10 sm:pr-12">
                  <span className="flex items-center justify-center bg-red-600 text-white p-1 rounded-md shadow-[0_0_12px_rgba(239,68,68,0.8)]">
                    <ShieldAlert size={14} className="animate-pulse" />
                  </span>
                  <span className="font-black tracking-[0.05em] sm:tracking-[0.1em] text-red-50 uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">זיהוי שיגור מאומת</span>
                </div>

                <div className="flex items-center gap-2 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/40 z-10 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="animate-pulse text-red-100 font-mono tracking-wider font-bold">LIVE</span>
                </div>
              </div>

              <div className="p-6 sm:p-10 flex flex-col items-center justify-center relative">
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <AlertTriangle size={36} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-bounce hidden sm:block" />
                  <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">צבע אדום</h2>
                  <AlertTriangle size={36} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-bounce hidden sm:block" />
                </div>
                <div className="w-16 h-1 bg-red-400/50 rounded-full mb-4 sm:mb-6" />

                <div className="flex flex-col items-center">
                  <span className="text-white/80 font-medium text-xs sm:text-sm tracking-wide mb-1 sm:mb-2 text-center break-words max-w-[90vw]">
                    {Array.isArray(activeAlerts) ? activeAlerts.join(' , ') : activeAlerts}
                  </span>

                  {timeToCover !== null && (
                    <div className="mt-2 text-center bg-black/40 px-6 py-2 rounded-xl border border-red-500/20 shadow-inner">
                      <span className={`text-4xl sm:text-5xl font-black font-mono tracking-widest ${timeToCover <= 15 ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : typeof timeToCover === 'number' && timeToCover > 15 && timeToCover <= 45 ? 'text-orange-400' : 'text-slate-200'}`}>00:{timeToCover.toString().padStart(2, '0')}</span>
                      <div className="text-[10px] text-red-200/50 uppercase tracking-widest mt-1">{isLTR ? "Time To Cover (Est)" : "זמן מוערך לכניסה למרחב (TTC)"}</div>
                    </div>
                  )}
                </div>

                <div className="mt-6 sm:mt-8 text-red-200 text-xs sm:text-sm font-medium tracking-wide flex items-center gap-2 bg-red-950/50 px-4 py-2 rounded-full border border-red-800/50">
                  היכנסו מיד למרחב מוגן ושהו בו 10 דקות
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- ALL CLEAR BANNER (Shows when safe to exit) --- */}
        {showAllClear && activeAlerts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            transition={{ type: "spring", stiffness: 250, damping: 25 }}
            className="fixed top-20 sm:top-24 left-1/2 transform -translate-x-1/2 z-[100] w-[95%] sm:w-[90%] max-w-4xl"
          >
            <div className="relative bg-gradient-to-br from-emerald-600/95 via-emerald-800/95 to-slate-900/95 backdrop-blur-2xl border border-emerald-400/50 rounded-2xl sm:rounded-3xl shadow-[0_15px_50px_-10px_rgba(16,185,129,0.4)] overflow-hidden">

              {/* Visual pulse background */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-400/20 via-transparent to-transparent opacity-60" />

              <button
                onClick={() => setShowAllClear(false)}
                className="absolute top-4 left-4 z-50 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white/70 hover:text-white transition-all border border-white/10 hover:border-white/30 hover:scale-105"
                title="סגור הודעה"
              >
                <X size={18} />
              </button>

              <div className="bg-black/40 border-b border-emerald-500/30 w-full py-2.5 px-5 sm:px-6 flex justify-between items-center text-emerald-200 text-xs sm:text-sm font-bold tracking-[0.15em] pl-14 shadow-inner">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span>הסרת איום אירוע</span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
                  <span className="text-emerald-100 font-mono tracking-wider">SAFE</span>
                </div>
              </div>

              <div className="p-6 sm:p-10 flex flex-col items-center justify-center relative">
                <div className="flex flex-col items-center gap-2 sm:gap-4 mb-2">
                  <div className="p-3 sm:p-4 bg-emerald-500/20 rounded-full border border-emerald-400/30 mb-2">
                    <CheckCircle className="text-emerald-300 drop-shadow-md" size={42} />
                  </div>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white text-center tracking-tight drop-shadow-md pb-1 leading-tight max-w-[95%]">
                    {systemMessage || "ניתן לצאת מהמרחב המוגן"}
                  </h2>
                </div>

                <div className="w-16 h-1 bg-emerald-400/50 rounded-full mb-4 sm:mb-6 mt-2" />

                <p className="text-base sm:text-lg text-emerald-50 font-medium max-w-2xl text-center leading-relaxed bg-black/20 px-5 sm:px-8 py-3 sm:py-4 rounded-xl border border-emerald-400/10">
                  {systemMessage ? "יש להישמע להנחיות פיקוד העורף לגבי השהייה במרחב." : "חלפו 10 דקות מקבלת ההתרעה ללא איומים נוספים במרחב. יש להישמע להנחיות פיקוד העורף."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 p-2 sm:p-6 w-full max-w-full 2xl:px-8 mt-4 sm:mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 outline-none flex-1">

        {/* RIGHT SIDEBAR (Focus & Stats) - 4 Cols */}
        <aside className="lg:col-span-3 flex flex-col gap-4 sm:gap-6 order-3 lg:order-1">

          {/* TARGET FOCUS PANEL */}
          <div className="glass-card rounded-2xl p-6 order-1 lg:order-none">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-3">
              <MapPin className="text-blue-400" size={20} />
              <h2 className="text-lg font-bold text-white">{isLTR ? "Multi-Zone Alert Monitoring" : "מעקב התראות רב-זירתי (Multi-Zone)"}</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {isLTR ? "Enter multiple cities separated by commas (e.g. Haifa, Tel Aviv) to monitor specific zones simultaneously and prevent nationwide panic hysteresis." : "הזן מספר יישובים מופרדים בפסיקים (למשל: תל אביב, אשדוד, חיפה) כדי לעקוב אחר כמה אזורים במקביל. הסירנה תופעל רק שם."}
            </p>
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Layers size={16} className="text-slate-500" />
              </div>
              <input
                type="text"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block pr-10 pl-12 p-3 font-mono"
                placeholder="לדוגמה: תל אביב, חיפה, רמת גן"
              />
              <button
                onClick={toggleGPS}
                className={`absolute inset-y-0 left-0 pl-3 flex items-center justify-center cursor-pointer transition-colors ${isGPSLocked ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                title={isLTR ? "Lock nearest location via GPS" : "נעילת GPS לחיפוש יישוב קרוב"}
              >
                {isGPSLocked && <span className="absolute animate-ping h-8 w-8 rounded-full bg-blue-400 opacity-20"></span>}
                <Crosshair size={20} className={isGPSLocked ? 'animate-pulse' : ''} />
              </button>
            </div>
          </div>

          {/* STATS OVERVIEW - REDESIGNED */}
          <div className="glass-card rounded-2xl p-0 overflow-hidden relative group">
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-3 items-center text-white">
                  <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <BarChart3 size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-wide">מדדים טקטיים</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">ניתוח נתוני מערכת הליבה</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-300">LIVE</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6">
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-4 sm:px-6 sm:py-5 rounded-xl border border-slate-700 shadow-inner overflow-hidden flex flex-col justify-center min-h-[110px] group">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors duration-500" />

                  <div className="flex items-center justify-between mb-1.5 w-full">
                    <span className="text-slate-400 text-[11px] sm:text-xs font-semibold tracking-wide">
                      סך מערכות שהופעלו <span className="hidden sm:inline">(היסטורי)</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 shadow-sm font-medium">
                      <Activity size={10} /> +1.2%
                    </span>
                  </div>

                  {/* Dynamic Scaling for large numbers */}
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 tracking-tight py-1" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {Number(history.length + 314482).toLocaleString('he-IL')}
                  </div>
                </div>

                <div className={`relative p-4 sm:p-5 flex flex-col justify-center min-h-[110px] rounded-xl border overflow-hidden transition-all duration-500 ${activeAlerts.length > 0 ? 'bg-gradient-to-br from-red-950/90 to-slate-900 border-red-500/60 shadow-[inset_0_0_30px_rgba(239,68,68,0.25)]' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-inner'}`}>
                  {activeAlerts.length > 0 && <div className="absolute inset-0 bg-red-500/10 animate-pulse"></div>}
                  <div className={`absolute -left-4 -bottom-4 w-16 h-16 rounded-full blur-xl transition-colors duration-500 ${activeAlerts.length > 0 ? 'bg-red-500/30' : 'bg-slate-700/30'}`}></div>
                  <div className={`text-[10px] sm:text-[11px] mb-1 font-bold tracking-wide z-10 relative ${activeAlerts.length > 0 ? 'text-red-300' : 'text-slate-400'}`}>איומים גלויים כעת</div>

                  <div className={`text-4xl sm:text-5xl font-black z-10 relative transition-all duration-500 ${activeAlerts.length > 0 ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.9)] scale-110 origin-right' : 'text-slate-500'}`}>
                    {activeAlerts.length}
                  </div>

                  <div className={`mt-2 text-[9px] sm:text-[10px] flex items-center gap-1 w-fit px-1.5 py-0.5 rounded border z-10 relative shadow-sm transition-colors duration-500 ${activeAlerts.length > 0 ? 'text-red-200 bg-red-600/30 border-red-500/50' : 'text-slate-400 bg-slate-800/80 border-slate-600'}`}>
                    <AlertTriangle size={10} className={activeAlerts.length > 0 ? 'animate-bounce' : ''} /> {activeAlerts.length > 0 ? 'הערכות למיירטים' : 'יירוטים בהמתנה'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3 border-t border-slate-800 pt-5">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-purple-500 rounded-full"></div>
                  <div className="text-xs text-white font-bold tracking-wider">עצימות שיגורים ארצית</div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">ממוצע שעות (H/A)</div>
              </div>
              <div className="bg-[#0f172a]/60 rounded-xl p-3 border border-slate-800/80 shadow-inner">
                <StatsChart history={history} />
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER & LEFT CONTENT (Map & Live Feed) - 9 Cols */}
        <section className="lg:col-span-9 flex flex-col gap-4 sm:gap-6 order-1 lg:order-2">

          {/* AI ANALYST BANNER */}
          <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg order-1 lg:order-none">
            <div className="p-3 bg-indigo-500/20 rounded-xl shrink-0">
              <BrainCircuit className="text-indigo-400 animate-pulse" size={24} />
            </div>
            <div>
              <h3 className="text-indigo-300 text-xs font-bold mb-1 tracking-wider uppercase">{isLTR ? "Oref AI Analyst" : "פרשן טקטי AI"}</h3>
              <p className="text-white text-sm sm:text-base font-medium">{aiInsight}</p>
            </div>
          </div>

          {/* RADAR MAP INTERFACE */}
          <div className="glass-card rounded-2xl overflow-hidden h-64 sm:h-96 relative group border-t-4 border-t-orange-500 shrink-0 order-2 lg:order-none">
            <div className="absolute top-4 right-4 z-[999] bg-slate-900/80 backdrop-blur px-4 py-2 rounded-lg border border-slate-700 shadow-xl pointer-events-none">
              <div className="flex items-center gap-2">
                <Activity className={activeAlerts.length > 0 ? "text-red-500 animate-pulse" : "text-green-500"} size={16} />
                <span className="text-sm font-bold tracking-wider text-slate-200">{isLTR ? "Live Radar" : "מכ\"ם טיווח חי"}</span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">{isLTR ? "Sync :" : "סנכרון :"} {lastUpdateTime}</div>
            </div>

            <button
              onClick={() => setIsHeatmap(!isHeatmap)}
              className={`absolute top-4 left-4 z-[999] px-3 py-2 rounded-lg border text-xs font-bold transition-all shadow-lg flex items-center gap-2
               ${isHeatmap ? 'bg-orange-600/90 border-orange-400 text-white' : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
              <Layers size={14} />
              {isHeatmap ? (isLTR ? "Heatmap Active" : "מפת חום פעילה") : (isLTR ? "Show Heatmap" : "הצג מפת חום")}
            </button>

            <LiveMap activeCities={activeAlerts} isHeatmap={isHeatmap} history={history} userCoords={userCoords} />

            {/* Scanline overlay for aesthetic */}
            <div className="absolute inset-0 z-[400] pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(255,255,255,0.2)_50%)] bg-[length:100%_4px]" />
          </div>

          {/* LIVE COMBAT FEED (Historic Log) */}
          <div className="glass-card rounded-2xl flex-1 flex flex-col p-6 h-[400px] order-4 lg:order-none">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-3 h-10 shrink-0">
              <MapIcon className="text-orange-400" size={20} />
              <h2 className="text-lg font-bold text-white">יומן יירוטים ומטרות (Live Feed)</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-1">
              {history.length > 0 ? (
                <ul className="space-y-4 pb-12">
                  <AnimatePresence>
                    {history.map((alert, index) => {
                      const contentString = Array.isArray(alert.cities) ? alert.cities.join(' , ') : (alert.cities || "");
                      const titleStr = alert.title || "";
                      const fullString = contentString + titleStr;

                      const isInstruction = fullString.includes("ניתן לצאת") || fullString.includes("הנחיות");

                      return (
                        <motion.li
                          key={alert.id || index}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`bg-slate-800/40 rounded-xl p-4 border-r-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/80 transition shadow-md ${isInstruction ? 'border-emerald-500' : 'border-red-500'}`}
                        >
                          <div className="flex flex-col sm:flex-row w-[65%] sm:w-3/4">
                            <div className="flex flex-col gap-1 w-full">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded border shrink-0 ${isInstruction ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>
                                  {isInstruction ? 'הודעת מערכת' : 'התרעה'}
                                </span>
                                <span className={`font-bold text-sm sm:text-base pr-1 ${isInstruction ? 'text-emerald-300' : 'text-slate-200'}`}>
                                  {titleStr || (isInstruction ? "הנחיית התגוננות" : "התרעה מאומתת")}
                                </span>
                              </div>
                              <span className="text-slate-400 text-xs sm:text-sm leading-relaxed" style={{ wordBreak: 'break-word' }}>
                                {contentString}
                              </span>
                            </div>
                          </div>
                          <div className="text-slate-500 text-[10px] sm:text-xs font-mono bg-[#0f172a] px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-700/50 shadow-inner text-center shrink-0 w-max sm:self-auto self-start pr-1 pl-1">
                            {new Date(alert.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}  <br className="hidden sm:block" /> <span className="opacity-50 text-[9px] sm:text-[10px] pl-1 pr-1">{new Date(alert.timestamp).toLocaleDateString('he-IL')}</span>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3">
                  <ShieldAlert size={48} className="opacity-20" />
                  <p>המרחב האווירי נקי. מנטר כל 2 שניות...</p>
                </div>
              )}
            </div>
          </div>

        </section>
      </main>

      {/* --- ANALYTICS MODAL --- */}
      <AnimatePresence>
        {showAnalyticsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-[#020617] border border-blue-500/30 w-full max-w-6xl h-[85vh] sm:h-[90vh] rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.15)] overflow-hidden flex flex-col relative"
            >
              {/* Scanline overlay for modal */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(59,130,246,0.4)_50%)] bg-[length:100%_4px] z-0" />

              <div className="p-4 sm:p-6 border-b border-blue-900/50 flex justify-between items-center bg-slate-900/80 backdrop-blur-md relative z-10 shadow-md">
                <div className="flex items-center gap-4">
                  <div className="p-2 sm:p-3 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-500/40 relative">
                    <div className="absolute -inset-1 bg-blue-500/20 blur rounded-xl animate-pulse" />
                    <LineChart size={24} className="relative z-10" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase">
                      {isLTR ? "Deep Tactical Analytics" : "מרכז השליטה והניתוח הטקטי"}
                    </h2>
                    <p className="text-blue-400/70 text-xs font-mono mt-1 tracking-widest uppercase">{isLTR ? "SYSTEM OREF OVERRIDE V2.0" : "רשת נתונים מאובטחת - סייבר הארי"}</p>
                  </div>
                </div>
                <button onClick={() => setShowAnalyticsModal(false)} className="p-2.5 bg-slate-800 border border-slate-700 hover:border-red-500/50 hover:bg-red-500/10 rounded-full text-slate-300 hover:text-red-400 transition-all z-10">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-gradient-to-b from-transparent to-blue-950/20 relative z-10 custom-scrollbar">

                {/* TOP CARDS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-t-2 border-t-blue-500 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:bg-slate-800 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-600/20 rounded-full blur-2xl group-hover:bg-blue-500/30 transition-all" />
                    <h3 className="text-slate-400 text-xs sm:text-sm font-bold tracking-wider mb-2 uppercase">{isLTR ? "Total Launches Tracked" : "סך שיגורים השנה גיזרה ארצית"}</h3>
                    <div className="flex items-end gap-2 mt-4">
                      <p className="text-4xl sm:text-5xl font-black text-white tracking-tight">{Number(history.length + 314482).toLocaleString('he-IL')}</p>
                      <span className="text-blue-400 text-xs font-mono mb-1.5 flex items-center gap-1"><Activity size={10} /> Live</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-t-2 border-t-emerald-500 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:bg-slate-800 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-600/20 rounded-full blur-2xl group-hover:bg-emerald-500/30 transition-all" />
                    <h3 className="text-slate-400 text-xs sm:text-sm font-bold tracking-wider mb-2 uppercase">{isLTR ? "Interception Success Rate" : "אחוזי יירוט מוצלחים משוערים"}</h3>
                    <div className="flex items-end gap-2 mt-4">
                      <p className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tight">92.4%</p>
                      <span className="text-emerald-500 text-xs font-mono mb-1.5">+0.2%</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-t-2 border-t-orange-500 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:bg-slate-800 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-600/20 rounded-full blur-2xl group-hover:bg-orange-500/30 transition-all" />
                    <h3 className="text-slate-400 text-xs sm:text-sm font-bold tracking-wider mb-2 uppercase">{isLTR ? "Current Active Threats" : "איומים פעילים באוויר הארץ"}</h3>
                    <div className="flex items-end gap-2 mt-4">
                      <p className={`text-4xl sm:text-5xl font-black tracking-tight ${activeAlerts.length > 0 ? "text-red-500 animate-pulse" : "text-slate-300"}`}>{activeAlerts.length}</p>
                      <span className="text-orange-400 text-xs font-mono mb-1.5">Targets</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-t-2 border-t-purple-500 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:bg-slate-800 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-600/20 rounded-full blur-2xl group-hover:bg-purple-500/30 transition-all" />
                    <h3 className="text-slate-400 text-xs sm:text-sm font-bold tracking-wider mb-2 uppercase">{isLTR ? "Data Synchronization" : "נפח סנכרון רשומות אחרון"}</h3>
                    <div className="flex items-end gap-2 mt-4">
                      <p className="text-4xl sm:text-5xl font-black text-purple-400 tracking-tight">{((Math.random() * (15 - 5)) + 5).toFixed(1)}<span className="text-lg">MB/s</span></p>
                      <span className="text-purple-500 text-xs font-mono mb-1.5 font-bold">Encrypted</span>
                    </div>
                  </div>
                </div>

                {/* MAIN CHART AREA */}
                <div className="glass-card rounded-2xl border border-slate-700/50 p-5 sm:p-8 bg-slate-900/40">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-black text-lg sm:text-xl tracking-wide flex items-center gap-3">
                      <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                      {isLTR ? "Launch Intensity Trajectory Analysis" : "ניתוח מסלול עצימות אש בזמן אמת (Live)"}
                    </h3>
                    <div className="hidden sm:flex p-1 bg-slate-800 rounded-lg text-xs font-bold text-slate-400 border border-slate-700">
                      <div className="px-3 py-1.5 bg-blue-500 border border-blue-400 text-white rounded-md cursor-pointer">Live 30 Days</div>
                      <div className="px-3 py-1.5 hover:text-white cursor-pointer transition">1 Year</div>
                    </div>
                  </div>
                  <div className="h-72 sm:h-96 w-full bg-[#020617]/50 rounded-xl border border-slate-800/80 p-2 sm:p-5 relative">
                    {/* Fake grid lines background */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none rounded-xl" />
                    <StatsChart history={history} />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- OSINT TICKER --- */}
      {osintUpdates.length > 0 && (
        <div className="fixed bottom-0 w-full bg-slate-900 border-t border-slate-700/50 flex items-center h-8 sm:h-10 z-[60]">
          <div className="bg-red-600 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-4 h-full flex items-center uppercase whitespace-nowrap z-10 shrink-0 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
            {isLTR ? "OSINT UPDATE" : "מבזקי חמ״ל"}
          </div>
          <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <div className="animate-marquee whitespace-nowrap text-[10px] sm:text-xs text-slate-300 font-mono flex items-center">
              {osintUpdates.map((update, idx) => (
                <React.Fragment key={`o1-${idx}`}>
                  <span className="mx-4 text-slate-600">❖</span> <span>{update}</span>
                </React.Fragment>
              ))}
              {/* Duplicate for seamless looping */}
              {osintUpdates.map((update, idx) => (
                <React.Fragment key={`o2-${idx}`}>
                  <span className="mx-4 text-slate-600">❖</span> <span>{update}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
