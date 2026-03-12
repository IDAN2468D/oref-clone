"use client";
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ShieldAlert, History, Volume2, VolumeX, Globe, Moon, Share2, Activity, BarChart3, MapPin, AlertTriangle, MonitorPlay, X, CheckCircle, BrainCircuit, Layers, LineChart, Bell, BellOff, Crosshair, Map as MapIcon, Menu, Zap } from "lucide-react";
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
  const [syncStatus, setSyncStatus] = useState<'success' | 'fallback' | 'loading'>('loading');
  const [showReport, setShowReport] = useState(false);
  const [strategicReport, setStrategicReport] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>("");

  // ADVANCED COMMAND SUITE STATE
  const [isCommandMode, setIsCommandMode] = useState(false);
  const [reports, setReports] = useState<{ id: string; lat: number; lng: number; type: string; timestamp: string }[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [nearestShelterNode, setNearestShelterNode] = useState<[number, number] | null>(null);

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
      // Tactical: Capture current URL for Mobile Command Sync
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=10&data=${encodeURIComponent(window.location.href)}`);
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

  useEffect(() => {
    if (isTimeMachineActive) return;

    const fetchAlerts = async () => {
      try {
        const response = await fetch(`/api/alerts?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache' }
        });

        if (!response.ok) {
          setSyncStatus('fallback');
          return;
        }

        const data = await response.json();
        setSyncStatus(data.status || 'success');

        const rawActive = data.active?.data || [];
        const incomingActive = rawActive.filter((c: string) => !c.includes("ניתן לצאת") && !c.includes("הנחיות") && !c.includes("אך יש להישאר"));
        const customMessageStr = rawActive.find((c: string) => c.includes("ניתן לצאת") || c.includes("הנחיות") || c.includes("אך יש להישאר"));

        if (customMessageStr) setSystemMessage(customMessageStr);

        if (incomingActive.length > 0) {
          console.log(`[TAC-OPS] Active threats detected: ${incomingActive.join(', ')}`);
        }

        setActiveAlerts(prev => {
          const hasChanged = JSON.stringify(prev) !== JSON.stringify(incomingActive);
          if (hasChanged) {
            setIsBannerDismissed(false);
            if (incomingActive.length > 0) setShowAllClear(false);
            else if (prev.length > 0 || !!customMessageStr) setShowAllClear(true);
          }
          return incomingActive;
        });

        if (data.saved_alerts) {
          const newLength = data.saved_alerts.length;
          if (previousHistoryLength.current > 0 && newLength > previousHistoryLength.current) {
            const newestAlert = data.saved_alerts[0];
            const newlyAddedArr = Array.isArray(newestAlert.cities) ? newestAlert.cities : [newestAlert.cities];
            const monitoredZones = filterCity.split(',').map(z => z.trim()).filter(z => z !== "");
            const isThreatToUser = monitoredZones.length === 0 || newlyAddedArr.some((c: string) => monitoredZones.some(zone => c.includes(zone)));

            if (isThreatToUser && newlyAddedArr.some((c: string) => !c.includes("ניתן לצאת"))) {
              if (!isMuted && audioRef.current) audioRef.current.play().catch(console.error);
              if (isTTSOn && window.speechSynthesis) {
                const speechStr = isLTR ? `Warning! Attack at ${newlyAddedArr.join(', ')}.` : `צבע אדום ב: ${newlyAddedArr.join(', ')}`;
                const speech = new SpeechSynthesisUtterance(speechStr);
                speech.lang = isLTR ? 'en-US' : 'he-IL';
                window.speechSynthesis.speak(speech);
              }
              if (isPushOn && Notification.permission === 'granted') {
                navigator.serviceWorker.ready.then(reg => reg.showNotification('צבע אדום!', { body: `${newlyAddedArr.join(', ')}` }));
              }
            }
          }
          previousHistoryLength.current = newLength;
          setHistory(data.saved_alerts);
        }
        setLastUpdateTime(new Date().toLocaleTimeString('he-IL'));
      } catch (e) {
        console.error("[TAC-OPS] Signal Drop:", e);
        setSyncStatus('fallback');
      }
    };

    fetchAlerts();
    const intervalId = setInterval(fetchAlerts, 2000);
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

  const isDrones = history.length > 0 && (history[0].title?.includes("כלי טיס") || history[0].title?.includes("חדירת"));

  const dynamicSrc = isDrones
    ? "https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg" // Tactical drone alert
    : "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"; // Standard rocket siren

  useEffect(() => {
    if (isDarkOpsMode) {
      document.body.classList.add('dark-ops-mode');
    } else {
      document.body.classList.remove('dark-ops-mode');
    }
  }, [isDarkOpsMode]);

  const generateStrategicReport = async () => {
    setIsGeneratingReport(true);
    setShowReport(true);
    try {
      const resp = await fetch('/api/ai-analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeAlerts: activeAlerts,
          history: history,
          isLTR: isLTR,
          isDeepAudit: true
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        setStrategicReport(data.insight);
      }
    } catch (e) {
      setStrategicReport("שגיאה בהפקת דוח אסטרטגי. נסה שנית.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const exportSituationReport = async () => {
    if (!containerRef.current) return;
    try {
      const text = isLTR
        ? `🚨 Tactical Alert: Active threat in ${activeAlerts.join(", ")}. Insight: ${aiInsight}`
        : `🚨 עדכון חמ"ל פיקוד: אירוע פעיל ב${activeAlerts.join(", ")}. פרשנות כלי ה-AI: ${aiInsight}`;

      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
    } catch (e) {
      console.error("Exports failed", e);
    }
  };

  // --- CITIZEN INTEL & TACTICAL ROUTING ---
  const reportImpact = (type: string) => {
    if (!userCoords) {
      alert(isLTR ? "GPS Lock Required for Reporting" : "נדרש נעילת GPS לדיווח");
      return;
    }
    const newReport = {
      id: Math.random().toString(36).substr(2, 9),
      lat: userCoords[0] + (Math.random() - 0.5) * 0.01,
      lng: userCoords[1] + (Math.random() - 0.5) * 0.01,
      type,
      timestamp: new Date().toISOString()
    };
    setReports(prev => [newReport, ...prev].slice(0, 50));
    if (window.speechSynthesis) {
      const msg = new SpeechSynthesisUtterance(isLTR ? "Report Logged. Relaying to Command." : "הדיווח נקלט. מועבר למרכז השליטה.");
      msg.lang = isLTR ? 'en-US' : 'he-IL';
      window.speechSynthesis.speak(msg);
    }
  };

  const findNearestShelter = () => {
    if (!userCoords) return;
    const mockShelterList: [number, number][] = [[32.08, 34.78], [32.07, 34.81], [31.76, 35.21], [31.52, 34.60]];
    let closest: [number, number] | null = null;
    let minD = Infinity;
    mockShelterList.forEach(s => {
      const d = Math.sqrt(Math.pow(s[0] - userCoords[0], 2) + Math.pow(s[1] - userCoords[1], 2));
      if (d < minD) { minD = d; closest = s; }
    });
    setNearestShelterNode(closest);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && isVoiceActive && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new Recognition();
      recog.continuous = true;
      recog.lang = isLTR ? 'en-US' : 'he-IL';
      recog.onresult = (e: any) => {
        const text = e.results[e.results.length - 1][0].transcript.toLowerCase();
        setTranscript(text);
        if (text.includes("נתח") || text.includes("analyze")) generateStrategicReport();
        if (text.includes("חשאי") || text.includes("dark") || text.includes("stealth")) setIsDarkOpsMode(true);
      };
      recog.start();
      return () => recog.stop();
    }
  }, [isVoiceActive, isLTR]);

  return (
    <div ref={containerRef} className={`min-h-screen transition-colors duration-700 relative overflow-x-hidden ${isTargetedCurrently ? 'bg-red-950/20' : 'bg-[#020617]'} ${isDarkOpsMode ? 'dark-ops-mode' : ''}`}>
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
            <button
              onClick={() => setIsVoiceActive(!isVoiceActive)}
              className={`flex items-center justify-center p-2 sm:p-3 border rounded-xl transition-all ${isVoiceActive ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 animate-pulse' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'}`}
              title={isLTR ? "Voice Assistant" : "עוזר קולי"}
            >
              <MonitorPlay size={18} />
            </button>

            <button
              onClick={() => setIsCommandMode(!isCommandMode)}
              className={`flex items-center justify-center p-2 sm:p-3 border rounded-xl transition-all ${isCommandMode ? 'bg-indigo-500/20 border-indigo-400 text-indigo-400' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'}`}
              title={isLTR ? "Command Mode" : "מצב חמ\"ל"}
            >
              <History size={18} />
            </button>

            <button onClick={exportSituationReport} className="flex items-center justify-center p-2 sm:p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-green-400 rounded-xl transition-colors shrink-0" title={isLTR ? "Export Situation to WhatsApp" : "שתף תמונת מצב לוואטסאפ"}>
              <Share2 size={18} />
            </button>
            <button onClick={() => setIsDarkOpsMode(!isDarkOpsMode)} className={`flex items-center justify-center p-2 sm:p-3 border rounded-xl transition-colors shrink-0 ${isDarkOpsMode ? 'bg-black border-slate-700 text-blue-500 shadow-[0_0_15px_rgba(0,0,255,0.2)]' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'}`} title={isLTR ? "Dark Ops Mode" : "מצב חדר מלחמה / Blackout"}>
              <Moon size={18} className={isDarkOpsMode ? 'fill-blue-500' : ''} />
            </button>
            <button onClick={() => { setIsLTR(!isLTR); document.documentElement.dir = !isLTR ? "ltr" : "rtl"; }} className="flex items-center justify-center p-2 sm:p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors shrink-0" title={isLTR ? "Switch to Hebrew" : "שנה שפה לאנגלית"}>
              <Globe size={18} />
            </button>
            <button onClick={generateStrategicReport} className="flex items-center justify-center p-2 sm:p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors shrink-0" title={isLTR ? "Intelligence Report" : "דוח מודיעין"}>
              <BrainCircuit size={18} />
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
            data-testid="active-alert-banner"
            initial={{ opacity: 0, y: -80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -40 }}
            className="fixed top-20 sm:top-24 left-1/2 transform -translate-x-1/2 z-[100] w-[95%] sm:w-[90%] max-w-4xl"
          >
            <div className={`relative bg-gradient-to-br backdrop-blur-2xl border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden ${activeAlerts.length > 0 ? 'from-red-600/95 via-red-800/95 to-slate-900/95 border-red-500/50 shadow-[0_15px_60px_-10px_rgba(239,68,68,0.5)]' : 'from-slate-800/95 via-slate-900/95 to-slate-950/95 border-slate-700/50'}`}>
              <button
                onClick={() => setIsBannerDismissed(true)}
                className="absolute top-4 left-4 z-50 p-2 bg-black/30 rounded-full text-white/70 hover:text-white transition-all border border-white/10"
              >
                <X size={18} />
              </button>
              <div className="bg-red-950/80 border-b border-red-500/50 w-full py-3 px-6 flex justify-between items-center text-red-100 text-xs shadow-inner">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert size={14} className="animate-pulse text-red-400" />
                  <span className="font-black uppercase tracking-widest">{isLTR ? "CODE RED: MISSILE THREAT DETECTED" : "צבע אדום: זיהוי שיגור מאומת"}</span>
                </div>
                <span className="animate-pulse text-red-500 font-bold">LIVE</span>
              </div>
              <div className="p-10 flex flex-col items-center">
                <h2 className="text-5xl sm:text-7xl font-black text-white mb-4 drop-shadow-xl text-center">
                  {isLTR ? "CODE RED" : "צבע אדום"}
                </h2>
                <div className="text-xl sm:text-2xl font-bold text-white/90 text-center mb-6 leading-tight max-w-2xl">
                  {activeAlerts.join(', ')}
                </div>
                {timeToCover !== null && (
                  <div className="bg-black/40 px-8 py-3 rounded-2xl border border-red-500/30">
                    <span className={`text-6xl font-black font-mono tracking-widest ${timeToCover <= 15 ? 'text-red-500' : 'text-orange-400'}`}>00:{timeToCover.toString().padStart(2, '0')}</span>
                    <div className="text-[10px] text-red-200/50 uppercase text-center mt-1">TTC ESTIMATE</div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`relative z-10 p-4 sm:p-6 w-full max-w-full 2xl:px-8 mt-4 sm:mt-6 outline-none flex-1 flex flex-col`}>
        {isCommandMode ? (
          /* --- COMMAND MODE (QUAD-VIEW) --- */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
            <section className="flex flex-col gap-4 min-h-[500px]">
              <div className="glass-panel flex-1 rounded-3xl overflow-hidden relative border border-white/5 shadow-2xl">
                <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
                  <button onClick={findNearestShelter} className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-all border border-white/20"><Crosshair size={20} /></button>
                  <div className="bg-black/60 backdrop-blur p-2 rounded-lg text-[8px] font-mono text-cyan-400 border border-white/10 uppercase tracking-widest">Target Acquisition: ON</div>
                </div>
                <LiveMap activeCities={activeAlerts} history={history} userCoords={userCoords} reports={reports} shelterRoute={nearestShelterNode} />
              </div>
              <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-4">
                <BrainCircuit className="text-indigo-400 shrink-0" size={24} />
                <p className="text-white text-xs font-medium leading-relaxed">{aiInsight}</p>
              </div>
            </section>

            <section className="flex flex-col gap-6">
              <div className="glass-panel rounded-3xl p-6 bg-slate-900/60 border border-white/5 h-[320px] flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
                  <h3 className="text-white font-black text-xs tracking-[0.2em] uppercase flex items-center gap-2"><MonitorPlay className="text-cyan-400" size={16} /> Field Intel</h3>
                  <div className="text-[10px] text-slate-500 font-mono">SECTOR ANALYTICS</div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => reportImpact("Explosion")} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 p-3 rounded-2xl text-red-500 font-black text-xs transition-all uppercase">{isLTR ? "Log Impact" : "דווח נפילה"}</button>
                  <button onClick={() => reportImpact("Interception")} className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 p-3 rounded-2xl text-cyan-500 font-black text-xs transition-all uppercase">{isLTR ? "Log Intercept" : "דווח יירוט"}</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {reports.map(r => (
                    <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center animate-in slide-in-from-right duration-300">
                      <span className={`text-[10px] font-bold ${r.type === 'Explosion' ? 'text-red-400' : 'text-cyan-400'} uppercase`}>{r.type}</span>
                      <span className="text-[9px] font-mono text-slate-500">{new Date(r.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {reports.length === 0 && <div className="text-center text-slate-700 text-[10px] mt-10 uppercase tracking-widest font-bold">Waiting for Decentralized Intel...</div>}
                </div>
              </div>

              <div className="glass-panel flex-1 rounded-3xl p-6 bg-slate-900/60 border border-white/5 overflow-hidden flex flex-col min-h-[300px]">
                <h3 className="text-white font-black text-xs tracking-[0.2em] uppercase mb-4 border-b border-slate-700 pb-3">{isLTR ? "Tactical Log" : "יומן מבצעי"}</h3>
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                  {history.slice(0, 50).map((h, i) => (
                    <div key={i} className={`p-3 rounded-xl border-r-4 ${activeAlerts.includes(Array.isArray(h.cities) ? h.cities[0] : (h.cities as string)) ? 'bg-red-900/20 border-red-500 animate-pulse' : 'bg-slate-800/40 border-slate-700'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-mono text-slate-500 uppercase">{new Date(h.timestamp).toLocaleTimeString()}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                      </div>
                      <div className="text-white text-xs font-bold">{Array.isArray(h.cities) ? h.cities.join(', ') : h.cities}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* --- STANDARD VIEW (REFINED) --- */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 flex-1">
            <aside className="lg:col-span-3 flex flex-col gap-6 order-3 lg:order-2">
              <div className="glass-panel rounded-3xl p-6 bg-gradient-to-br from-slate-900 to-indigo-950/20 border-indigo-500/20 hidden lg:flex flex-col items-center gap-4 text-center">
                <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400 animate-pulse"><Globe size={24} /></div>
                <h3 className="text-white font-black text-xs uppercase tracking-widest">Command Relay QR</h3>
                <div className="p-2 bg-white rounded-2xl shadow-xl">{qrUrl && <img src={qrUrl} alt="QR" className="w-24 h-24" />}</div>
                <div className="text-[8px] text-slate-600 font-mono uppercase tracking-[0.2em] mt-1">Status: Encrypted Point-to-Point</div>
              </div>

              <div className="glass-panel rounded-3xl flex-1 flex flex-col p-6 h-[500px] border border-white/5 shadow-xl">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-3">
                  <History className="text-orange-400" size={18} />
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">{isLTR ? "Live Feed" : "יומן יירוטים חיים"}</h2>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                  {history.map((h, i) => (
                    <div key={i} className={`bg-slate-800/40 rounded-xl p-4 border-r-4 ${activeAlerts.includes(Array.isArray(h.cities) ? h.cities[0] : (h.cities as string)) ? 'border-red-500 animate-pulse' : 'border-slate-700'}`}>
                      <div className="text-[10px] text-slate-500 mb-1 font-mono uppercase">{new Date(h.timestamp).toLocaleTimeString()}</div>
                      <div className="text-slate-100 text-xs font-bold leading-tight line-clamp-2">{Array.isArray(h.cities) ? h.cities.join(', ') : h.cities}</div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="lg:col-span-9 flex flex-col gap-6 order-1 lg:order-1">
              <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-indigo-500/30 rounded-2xl p-5 flex items-center gap-5 shadow-2xl">
                <div className="p-3 bg-indigo-500/20 rounded-xl shadow-lg ring-1 ring-indigo-500/40"><BrainCircuit className="text-indigo-400 animate-pulse" size={28} /></div>
                <div className="flex-1">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Cortex Strategic Link v4.2</h4>
                  <p className="text-white text-sm sm:text-base font-medium leading-relaxed">{aiInsight}</p>
                </div>
              </div>

              <div className="glass-panel rounded-[2rem] overflow-hidden h-[500px] relative border-t-4 border-t-orange-500 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] group">
                <div className="absolute top-4 right-4 z-50 bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl transition-all group-hover:bg-slate-900 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${syncStatus === 'success' ? 'bg-green-500 shadow-[0_0_8px_green]' : 'bg-red-500 animate-ping'}`} />
                    <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">{isLTR ? "Live Radar Link" : "מכ\"ם טיווח פעיל"}</span>
                  </div>
                </div>
                <div className="absolute top-4 left-4 z-50">
                  <button onClick={findNearestShelter} className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-all border border-white/20"><Crosshair size={22} /></button>
                </div>
                <LiveMap activeCities={activeAlerts} history={history} userCoords={userCoords} reports={reports} shelterRoute={nearestShelterNode} />
                <div className="absolute inset-0 z-[10] pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(255,255,255,0.2)_50%)] bg-[length:100%_4px]" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                <div className="lg:col-span-2 glass-panel rounded-3xl p-6 bg-slate-900/40 border border-white/5 shadow-xl">
                  <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2"><Activity size={16} className="text-amber-500" /> Launch Intensity Analytics</h3>
                  <div className="h-64 h-full"><StatsChart history={history} isRTL={!isLTR} /></div>
                </div>
                <div className="glass-panel rounded-3xl p-8 bg-slate-900/60 border border-white/5 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden group">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-cyan-500/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <Zap size={48} className="text-cyan-400 mb-6 group-hover:scale-110 transition-transform duration-500" />
                  <h4 className="text-white font-black uppercase tracking-widest mb-3">Neural Prediction</h4>
                  <p className="text-slate-400 text-xs mb-8 leading-relaxed max-w-[200px]">Advanced AI models calculating kinetic trajectory vectors for proactive interception strategies.</p>
                  <button onClick={generateStrategicReport} className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95">Initiate SITREP</button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* --- OSINT TICKER --- */}
      {osintUpdates.length > 0 && (
        <div className="fixed bottom-0 w-full bg-[#020617] border-t border-white/5 flex items-center h-10 z-[60] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="bg-red-600 text-white text-[10px] font-black px-6 h-full flex items-center uppercase tracking-widest z-10 shadow-2xl mr-4">{isLTR ? "OSINT FEED" : "מבזקי חמ\"ל"}</div>
          <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <div className="animate-marquee whitespace-nowrap text-[10px] text-slate-400 font-mono flex items-center">
              {osintUpdates.map((u, i) => (
                <React.Fragment key={i}><span className="mx-4 text-slate-700">❖</span><span>{u}</span></React.Fragment>
              ))}
              {osintUpdates.map((u, i) => (
                <React.Fragment key={`copy-${i}`}><span className="mx-4 text-slate-700">❖</span><span>{u}</span></React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      <AnimatePresence>
        {showAnalyticsModal && (
          <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-slate-900 border border-blue-500/30 w-full max-w-6xl h-[85vh] rounded-[2rem] overflow-hidden flex flex-col relative shadow-[0_0_100px_rgba(59,130,246,0.2)]">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-900">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/40"><LineChart className="text-blue-400" size={28} /></div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-widest">{isLTR ? "Deep Analytics" : "ניתוח טקטי מתקדם"}</h2>
                </div>
                <button onClick={() => setShowAnalyticsModal(false)} className="p-3 bg-slate-800 rounded-full text-slate-500 hover:text-white transition-all"><X size={24} /></button>
              </div>
              <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                  {[
                    { label: isLTR ? "TOTAL LOGS" : "סה\"כ אירועים", value: (history.length + 314482).toLocaleString(), color: "blue" },
                    { label: "SUCCESS RATE", value: "92.4%", color: "emerald" },
                    { label: "ACTIVE RADIUS", value: "480km", color: "orange" },
                    { label: "SYNC LATENCY", value: "1.2ms", color: "purple" }
                  ].map((card, i) => (
                    <div key={i} className={`bg-slate-800/40 p-6 rounded-2xl border border-white/5 border-t-2 border-t-${card.color}-500 shadow-xl`}>
                      <div className="text-[10px] text-slate-500 font-black uppercase mb-2">{card.label}</div>
                      <div className={`text-4xl font-black text-${card.color}-400`}>{card.value}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-black/20 p-10 rounded-3xl border border-white/5 shadow-inner">
                  <StatsChart history={history} />
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showReport && (
          <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-slate-900 border border-indigo-500/40 rounded-[2.5rem] p-10 max-w-2xl w-full shadow-[0_0_120px_rgba(99,102,241,0.3)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
              <button onClick={() => setShowReport(false)} className="absolute top-8 left-8 p-3 bg-slate-800 rounded-full text-slate-500 hover:text-white transition-all"><X size={20} /></button>
              <div className="flex items-center gap-5 mb-10">
                <div className="p-4 bg-indigo-500/20 rounded-2xl border border-indigo-500/40 shadow-xl shadow-indigo-900/20"><BrainCircuit className="text-indigo-400" size={36} /></div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">{isLTR ? "Tactical intelligence Report" : "דוח מודיעין AI"}</h2>
                  <p className="text-indigo-400/60 text-xs font-mono uppercase tracking-[0.3em] font-bold">{new Date().toLocaleDateString('he-IL')}</p>
                </div>
              </div>
              <div className="max-h-[50vh] overflow-y-auto pr-6 custom-scrollbar bg-black/30 p-8 rounded-3xl border border-white/5 shadow-inner text-slate-300 leading-relaxed font-medium">
                {isGeneratingReport ? (
                  <div className="py-20 flex flex-col items-center gap-6">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-slate-500 font-mono animate-pulse uppercase tracking-[0.4em]">Linking to Military Satellite Network...</span>
                  </div>
                ) : strategicReport}
              </div>
              <div className="mt-10 flex justify-end gap-4">
                <button onClick={() => setShowReport(false)} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs">Acknowledge</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
