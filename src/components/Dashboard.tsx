import React, { useState, useEffect, useRef } from "react";
import { 
  Users, Smartphone, Map, History, FileText, Award, ShieldAlert, Sliders, 
  MessageSquare, Bell, Settings, Lock, Unlock, Play, Battery, Radio, MapPin, 
  Plus, CheckCircle2, AlertTriangle, Send, Sparkles, Brain, Clock, ShieldCheck,
  ChevronRight, Volume2, Moon, AppWindow, Globe, Eye, BookOpen, ExternalLink, RefreshCw,
  Download, TrendingUp, Compass, Book, GraduationCap, Shield, Check, AlertOctagon,
  Trash2, PlusCircle, HelpCircle, Briefcase, EyeOff, BarChart3, Code, Cpu, Atom, Camera, Music,
  Calendar, Info, QrCode
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, LineChart, Line, ReferenceLine 
} from "recharts";
import { ChildProfile, ActivityLog, ChatMessage, SafetyLevel } from "../types";
import { initialProfiles, initialLogs, initialAIReports, initialInterestData } from "../data";
import { useFirebaseSync } from "../lib/useFirebaseSync";
import RealLeafletMap from "./RealLeafletMap";
import { motion } from "motion/react";
import InterestsExplorer from "./InterestsExplorer";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Motion animation variants for subtle, high-fidelity entry and hover interactions
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 110,
      damping: 14
    }
  },
  hover: {
    y: -4,
    scale: 1.006,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    borderColor: "rgba(6, 182, 212, 0.35)", // Subtle cyan border glow on hover
    transition: {
      duration: 0.25,
      ease: "easeOut"
    }
  },
  tap: {
    scale: 0.995,
    transition: {
      duration: 0.1
    }
  }
};

export default function Dashboard() {
  const sync = useFirebaseSync();
  const {
    user,
    profiles,
    logs,
    dangerousEvents,
    safeZones,
    chatHistory,
    setProfiles,
    setLogs,
    setDangerousEvents,
    setSafeZones,
    setChatHistory,
    addProfileInDb,
    updateProfileInDb,
    addLogInDb,
    addDangerousEventInDb,
    deleteDangerousEventInDb,
    addSafeZoneInDb,
    deleteSafeZoneInDb,
    addChatMessageInDb,
    isGuestMode,
    setIsGuestMode,
    handleLogin
  } = sync;

  const [selectedChildId, setSelectedChildId] = useState<string>("child-1");
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Chat parameters & model selection
  const [userInput, setUserInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  
  const [selectedModel, setSelectedModel] = useState<"gemini-3.1-pro-preview" | "gemini-3.5-flash" | "gemini-3.1-flash-lite">("gemini-3.5-flash");
  const [enableSearch, setEnableSearch] = useState<boolean>(true);
  const [enableMaps, setEnableMaps] = useState<boolean>(false);
  const [enableMemory, setEnableMemory] = useState<boolean>(false);
  const [assistantError, setAssistantError] = useState<{ text: string; lastMessage: string } | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const queueRef = useRef<Record<string, string[]>>({});
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          console.warn("Geolocation permission or fetching failed, using fallback:", err);
        }
      );
    }
  }, []);

  // Control variables state per child
  const [studyMode, setStudyMode] = useState<Record<string, boolean>>({ "child-1": true, "child-2": false });
  const [safeSearch, setSafeSearch] = useState<Record<string, boolean>>({ "child-1": true, "child-2": true });
  const [geofenceRadius, setGeofenceRadius] = useState<number>(150); // in meters
  const [sosActive, setSosActive] = useState<Record<string, boolean>>({ "child-1": false, "child-2": false });
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // New AI Insights states
  const [activeSubInterest, setActiveSubInterest] = useState<Record<string, string>>({
    "child-1": "Programming",
    "child-2": "Languages"
  });
  
  const [isRegeneratingReport, setIsRegeneratingReport] = useState<boolean>(false);

  // Pairing Form States
  const [pairingDeviceId, setPairingDeviceId] = useState("");
  const [pairingMode, setPairingMode] = useState<"existing" | "new">("existing");
  const [targetProfileId, setTargetProfileId] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [newChildAge, setNewChildAge] = useState(10);
  const [newChildAvatar, setNewChildAvatar] = useState("https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150");
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [pairingMessage, setPairingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isQrScanning, setIsQrScanning] = useState(false);

  const handleSimulateQrScan = () => {
    setIsQrScanning(true);
    setPairingMessage(null);
    setTimeout(() => {
      const activeIdInLocalStorage = localStorage.getItem("GUA_COMPANION_DEVICE_ID") || "GUA-TRK819";
      setPairingDeviceId(activeIdInLocalStorage);
      setIsQrScanning(false);
      setPairingMessage({
        type: "success",
        text: `QR Scan successful! Detected Companion Device ID: ${activeIdInLocalStorage}`
      });
    }, 2000);
  };

  const handlePairDevice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pairingDeviceId.trim()) {
      setPairingMessage({ type: "error", text: "Please enter a valid Companion Device ID." });
      return;
    }

    setIsPairingLoading(true);
    setPairingMessage(null);

    try {
      // Look up /devices/{deviceId} in Firestore to verify client is running
      const devRef = doc(db, "devices", pairingDeviceId.trim());
      const devSnap = await getDoc(devRef);
      
      let initialDeviceData = {
        deviceName: "Unpaired Phone",
        deviceModel: "Android Device",
        battery: 100,
        gps: { lat: 37.7749, lng: -122.4194, name: "San Francisco" },
        screenOn: true
      };

      if (devSnap.exists()) {
        initialDeviceData = devSnap.data() as any;
      } else {
        // If device is not in Firestore yet, we create a placeholder document
        await setDoc(devRef, {
          deviceId: pairingDeviceId.trim(),
          deviceName: pairingMode === "new" ? `${newChildName}'s Device` : "Child Phone",
          deviceModel: "Android Core Client",
          battery: 85,
          charging: false,
          screenOn: true,
          gps: { lat: 37.7749, lng: -122.4194, name: "Initial San Francisco Coordinates" },
          lastSeen: new Date().toISOString()
        });
      }

      if (pairingMode === "existing") {
        if (!targetProfileId) {
          setPairingMessage({ type: "error", text: "Please select an existing child profile to link." });
          setIsPairingLoading(false);
          return;
        }

        // Link the deviceId to the selected profile
        await updateProfileInDb(targetProfileId, {
          deviceId: pairingDeviceId.trim(),
          device: `${initialDeviceData.deviceModel} (${initialDeviceData.deviceName})`,
          battery: initialDeviceData.battery,
          lastSeenLocation: initialDeviceData.gps ? {
            lat: initialDeviceData.gps.lat,
            lng: initialDeviceData.gps.lng,
            name: initialDeviceData.gps.name,
            timestamp: new Date().toISOString()
          } : undefined
        });

        const targetName = profiles.find(p => p.id === targetProfileId)?.name || "Child";
        setPairingMessage({
          type: "success",
          text: `Established real-time cloud link! ${targetName}'s device is now securely connected.`
        });
        
        await addLogInDb({
          id: `pair-log-${Date.now()}`,
          childId: targetProfileId,
          type: "system",
          title: "Hardware Link Established",
          description: `Linked companion device (${pairingDeviceId}) securely to ${targetName}'s profile.`,
          timestamp: new Date().toISOString(),
          safetyLevel: "safe"
        });

      } else {
        // Create a brand new child profile
        if (!newChildName.trim()) {
          setPairingMessage({ type: "error", text: "Please specify a name for the new child profile." });
          setIsPairingLoading(false);
          return;
        }

        const newProfileId = `child-${Date.now()}`;
        const newProfile: ChildProfile = {
          id: newProfileId,
          deviceId: pairingDeviceId.trim(),
          name: newChildName.trim(),
          age: Number(newChildAge),
          avatar: newChildAvatar,
          device: `${initialDeviceData.deviceModel} (${initialDeviceData.deviceName})`,
          battery: initialDeviceData.battery,
          status: "online",
          screenTimeLimit: 120,
          screenTimeToday: 0,
          riskScore: 5,
          lastSeenLocation: {
            lat: initialDeviceData.gps?.lat ?? 37.7749,
            lng: initialDeviceData.gps?.lng ?? -122.4194,
            name: initialDeviceData.gps?.name ?? "Linked Coordinates",
            timestamp: new Date().toISOString()
          }
        };

        await addProfileInDb(newProfile);
        setSelectedChildId(newProfileId);

        setPairingMessage({
          type: "success",
          text: `Success! Created new profile for ${newChildName.trim()} and linked device ${pairingDeviceId} in real-time.`
        });

        await addLogInDb({
          id: `pair-log-${Date.now()}`,
          childId: newProfileId,
          type: "system",
          title: "Profile Created & Device Paired",
          description: `Created profile for ${newChildName.trim()} and established premium real-time monitoring link.`,
          timestamp: new Date().toISOString(),
          safetyLevel: "safe"
        });
      }

      setPairingDeviceId("");
      setNewChildName("");
    } catch (err: any) {
      console.error("Pairing Error:", err);
      setPairingMessage({ type: "error", text: "Failed to establish cloud pairing connection." });
    } finally {
      setIsPairingLoading(false);
    }
  };

  // Family Risk Score & Safety Trends widget states
  const [trendPeriod, setTrendPeriod] = useState<"7d" | "30d">("7d");
  const [trendFilter, setTrendFilter] = useState<"all" | "leo" | "emily">("all");
  const [showTrendTable, setShowTrendTable] = useState<boolean>(false);
  const [trendSearch, setTrendSearch] = useState<string>("");
  const [trendLevelFilter, setTrendLevelFilter] = useState<"all" | "safe" | "warning" | "severe">("all");

  // Guardian AI Intelligence Hub states
  const [showAiHub, setShowAiHub] = useState<boolean>(false);
  const [aiHubMode, setAiHubMode] = useState<"grounding" | "image">("grounding");
  const [aiHubPrompt, setAiHubPrompt] = useState<string>("");
  const [aiHubGroundingType, setAiHubGroundingType] = useState<"search" | "maps">("search");
  const [aiHubImageSize, setAiHubImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [aiHubLoading, setAiHubLoading] = useState<boolean>(false);
  const [aiHubResponse, setAiHubResponse] = useState<string | null>(null);
  const [aiHubImageUrl, setAiHubImageUrl] = useState<string | null>(null);
  const [aiHubIsFallback, setAiHubIsFallback] = useState<boolean>(false);
  const [aiHubMetadata, setAiHubMetadata] = useState<any>(null);
  const [aiHubError, setAiHubError] = useState<string | null>(null);

  const handleAiHubSubmit = async () => {
    if (!aiHubPrompt.trim()) return;
    setAiHubLoading(true);
    setAiHubResponse(null);
    setAiHubImageUrl(null);
    setAiHubIsFallback(false);
    setAiHubMetadata(null);
    setAiHubError(null);

    try {
      if (aiHubMode === "grounding") {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: aiHubPrompt,
            childContext: activeChild,
            history: [],
            logs: logs.filter(l => l.childId === selectedChildId),
            dangerousEvents: dangerousEvents.filter(e => e.childId === selectedChildId),
            modelName: "gemini-3.5-flash",
            enableSearch: aiHubGroundingType === "search",
            enableMaps: aiHubGroundingType === "maps",
            userLocation: userLocation
          })
        });

        if (!response.ok) {
          throw new Error(`Cloud services reported error code: ${response.status}`);
        }

        const data = await response.json();
        setAiHubResponse(data.text || "No insights found.");
        setAiHubMetadata(data.groundingMetadata || null);
        setAiHubIsFallback(data.isFallback || false);
      } else {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: aiHubPrompt,
            size: aiHubImageSize
          })
        });

        if (!response.ok) {
          throw new Error(`Cloud services reported error code: ${response.status}`);
        }

        const data = await response.json();
        setAiHubImageUrl(data.imageUrl || null);
        setAiHubIsFallback(data.isFallback || false);
      }
    } catch (err: any) {
      console.error("AI Hub Error:", err);
      setAiHubError(err.message || "An error occurred. Check your cloud connectivity in settings.");
    } finally {
      setAiHubLoading(false);
    }
  };

  // Current active child object
  const activeChild = profiles.find(p => p.id === selectedChildId) || profiles[0];

  useEffect(() => {
    // Scroll chat to bottom when messages update
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    const timer = setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => clearTimeout(timer);
  }, [chatHistory, selectedChildId, chatLoading, assistantError]);

  useEffect(() => {
    // Cancel unfinished requests if the user starts a completely new conversation / switches child
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    // Clear pending queue for all children to prevent state leaking
    queueRef.current = {};
    setChatLoading(false);
    setAssistantError(null);
  }, [selectedChildId]);

  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => {
        setActionFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Handle selected child's remote lock toggle
  const toggleDeviceLock = async (id: string) => {
    const target = profiles.find(p => p.id === id);
    if (!target) return;
    const nextStatus = target.status === "locked" ? "online" : "locked";
    
    await updateProfileInDb(id, { status: nextStatus as any });
    
    setActionFeedback(nextStatus === "locked" 
      ? `Immediate lock signal deployed to ${target.name}'s device. Hardware is locked.` 
      : `Device unlocked successfully for ${target.name}. Standard filter rules restored.`
    );

    // Add alert log
    const isLocked = nextStatus === "locked";
    const newLog: ActivityLog = {
      id: `log-lock-${Date.now()}`,
      childId: id,
      type: "system",
      title: isLocked ? "Device Remotely Locked" : "Device Remotely Unlocked",
      description: `Parent issued immediate ${isLocked ? "lock" : "unlock"} order for all child hardware.`,
      timestamp: new Date().toISOString(),
      safetyLevel: isLocked ? "warning" : "safe"
    };
    await addLogInDb(newLog);
  };

  // Trigger high emergency SOS alert
  const triggerSosAlert = async (id: string) => {
    let isCurrentlyActive = false;
    setSosActive(prev => {
      isCurrentlyActive = prev[id];
      return { ...prev, [id]: !isCurrentlyActive };
    });
    
    const targetChild = profiles.find(p => p.id === id) || activeChild;
    const activating = !isCurrentlyActive;
    
    // Create activity log
    const newLog: ActivityLog = {
      id: `log-sos-${Date.now()}`,
      childId: id,
      type: "system",
      title: activating ? "SOS Siren Alert Triggered" : "SOS Alarm Silenced",
      description: activating 
        ? `HIGH EMERGENCY: Loud siren alarm triggered on ${targetChild.name}'s device to get immediate attention.`
        : `Parent silenced the high-decibel alarm signal on ${targetChild.name}'s device.`,
      timestamp: new Date().toISOString(),
      safetyLevel: activating ? "severe" : "safe"
    };
    await addLogInDb(newLog);
    
    setActionFeedback(activating 
      ? `EMERGENCY ALERT: Active broadcast siren sent to ${targetChild.name}'s hardware. Max volume forced.`
      : `Silenced alert siren on ${targetChild.name}'s device.`
    );
  };

  // Bump screen time limit
  const bumpScreenTime = async (id: string) => {
    const targetChild = profiles.find(p => p.id === id) || activeChild;
    const increment = 15;
    const nextLimit = targetChild.screenTimeLimit + increment;
    
    await updateProfileInDb(id, { screenTimeLimit: nextLimit });
    
    // Add activity log
    const newLog: ActivityLog = {
      id: `log-bump-${Date.now()}`,
      childId: id,
      type: "system",
      title: "Screen Time Bonus Granted",
      description: `Parent granted a +${increment} minutes screen time extension. New limit: ${nextLimit} minutes.`,
      timestamp: new Date().toISOString(),
      safetyLevel: "safe"
    };
    await addLogInDb(newLog);
    
    setActionFeedback(`Granted ${targetChild.name} an extra ${increment} minutes of screen time.`);
  };

  // Toggle study mode filter
  const toggleStudyMode = async (id: string) => {
    let nextVal = false;
    setStudyMode(prev => {
      nextVal = !prev[id];
      return { ...prev, [id]: nextVal };
    });
    const targetChild = profiles.find(p => p.id === id) || activeChild;
    
    // Add activity log
    const newLog: ActivityLog = {
      id: `log-study-${Date.now()}`,
      childId: id,
      type: "system",
      title: nextVal ? "Educational Study Mode Enabled" : "Educational Study Mode Disabled",
      description: nextVal 
        ? `Device configured to filter non-educational apps. Priority block active.` 
        : `Standard application access rules restored for ${targetChild.name}.`,
      timestamp: new Date().toISOString(),
      safetyLevel: "safe"
    };
    await addLogInDb(newLog);
    
    setActionFeedback(nextVal 
      ? `Study Mode activated for ${targetChild.name}. All social media/games are now locked.` 
      : `Study Mode deactivated for ${targetChild.name}. Standard filter profiles applied.`
    );
  };

  // Change screen limits
  const handleLimitChange = async (id: string, mins: number) => {
    await updateProfileInDb(id, { screenTimeLimit: mins });
  };

  // Family Assistant Request Execution with unique Request ID and AbortController
  const executeAssistantRequest = async (promptText: string, userMsgId?: string) => {
    setChatLoading(true);
    setAssistantError(null);

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    currentRequestIdRef.current = requestId;

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    try {
      const currentHistory = chatHistory[selectedChildId] || [];
      const finalHistory = enableMemory
        ? currentHistory.filter(m => !m.id.startsWith("chat-err-") && m.id !== userMsgId).slice(-6)
        : [];

      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: promptText,
          childContext: activeChild,
          history: finalHistory,
          logs: logs.filter(l => l.childId === selectedChildId),
          dangerousEvents: dangerousEvents.filter(e => e.childId === selectedChildId),
          modelName: selectedModel,
          enableSearch,
          enableMaps,
          userLocation
        })
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();

      // Ignore responses from expired or cancelled requests
      if (currentRequestIdRef.current !== requestId) {
        return;
      }

      const modelMsg: ChatMessage = {
        id: `chat-mdl-${Date.now()}`,
        role: "model",
        text: data.text || "I was unable to retrieve a response from the service. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        groundingMetadata: data.groundingMetadata || null
      };

      await addChatMessageInDb(selectedChildId, modelMsg);

      // Process next in queue
      const currentQueue = queueRef.current[selectedChildId] || [];
      if (currentQueue.length > 0) {
        const nextPrompt = currentQueue[0];
        queueRef.current[selectedChildId] = currentQueue.slice(1);
        await executeAssistantRequest(nextPrompt);
      } else {
        setChatLoading(false);
      }

    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        console.log("Request was aborted:", requestId);
        return;
      }
      console.error("Chat Submit Error:", err);
      
      if (currentRequestIdRef.current === requestId) {
        setAssistantError({
          text: "The connection to the Guardian AI network failed. Would you like to retry your question?",
          lastMessage: promptText
        });
        setChatLoading(false);
      }
    }
  };

  // Family Assistant Query submission to Express
  const handleAssistantSubmit = async (textToSend?: string) => {
    const promptText = textToSend || userInput;
    if (!promptText.trim()) return;

    setAssistantError(null);

    // Clear input field immediately so the newest user message displays instantly
    if (!textToSend) {
      setUserInput("");
    }

    // Assign a temporary userMsgId to track this message
    const userMsgId = `chat-usr-${Date.now()}`;

    // Add User message
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    await addChatMessageInDb(selectedChildId, userMsg);

    // If there is already an active AI request, queue it
    if (chatLoading) {
      queueRef.current[selectedChildId] = [...(queueRef.current[selectedChildId] || []), promptText];
      return;
    }

    await executeAssistantRequest(promptText, userMsgId);
  };

  const [newZoneName, setNewZoneName] = useState("");
  const [draftZoneLat, setDraftZoneLat] = useState<number | null>(null);
  const [draftZoneLng, setDraftZoneLng] = useState<number | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

  const addNewZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (newZoneName.trim()) {
      const fallbackLat = (activeChild?.lastSeenLocation?.lat || 37.7749) + (Math.random() - 0.5) * 0.005;
      const fallbackLng = (activeChild?.lastSeenLocation?.lng || -122.4194) + (Math.random() - 0.5) * 0.005;
      
      addSafeZoneInDb({ 
        name: newZoneName, 
        active: true, 
        radius: geofenceRadius,
        lat: draftZoneLat !== null ? draftZoneLat : fallbackLat,
        lng: draftZoneLng !== null ? draftZoneLng : fallbackLng
      });
      setNewZoneName("");
      setDraftZoneLat(null);
      setDraftZoneLng(null);
    }
  };

  // Filter logs for selected child
  const childLogs = logs.filter(l => l.childId === selectedChildId);

  // Load AI weekly report elements
  const activeReport = initialAIReports[selectedChildId] || initialAIReports["child-1"];

  // Load Interest Data
  const activeInterest = initialInterestData[selectedChildId] || initialInterestData["child-1"];

  if (sync.authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-cyan-500"></div>
        <p className="text-xs font-mono uppercase tracking-widest text-cyan-500 animate-pulse">Initializing Guardian Shield Credentials...</p>
      </div>
    );
  }

  if (sync.dbLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="animate-bounce rounded-full h-10 w-10 bg-cyan-500/20 border border-cyan-500 flex items-center justify-center">
          <Shield className="h-5 w-5 text-cyan-400 animate-pulse" />
        </div>
        <p className="text-xs font-mono uppercase tracking-widest text-cyan-400 animate-pulse">Synchronizing Cloud Telemetry Tables...</p>
      </div>
    );
  }

  if (!user && !isGuestMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-cyan-500/30 font-sans">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#080c14_1px,transparent_1px),linear-gradient(to_bottom,#080c14_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70"></div>
        
        {/* Glow circles */}
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[100px]"></div>

        <div className="relative max-w-lg w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl shadow-cyan-950/20 text-center space-y-8">
          
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 opacity-75 blur-md animate-pulse"></div>
              <div className="relative bg-slate-950 text-cyan-400 h-16 w-16 rounded-full flex items-center justify-center border border-slate-700/60 shadow-inner">
                <Shield className="h-8 w-8 text-cyan-400" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-bold text-cyan-400 border border-cyan-500/20 uppercase tracking-widest font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              <span>Parental Gateway Secured</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight text-white leading-none">
              Guardian AI Security
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Deploy active geofencing boundaries, enforce hardware device locks, configure screen-time schedules, and monitor safe search diagnostics securely through our live database sync.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleLogin}
              type="button"
              className="w-full bg-white text-slate-900 hover:bg-slate-100 transition-all font-bold text-xs py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-xl cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Authenticate Parent with Google</span>
            </button>

            <button
              onClick={() => setIsGuestMode(true)}
              type="button"
              className="w-full bg-slate-800/40 hover:bg-slate-800/80 text-slate-300 hover:text-white transition-all font-bold text-xs py-3.5 px-6 rounded-2xl border border-slate-800 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye className="h-4 w-4 text-slate-400" />
              <span>Explore Guest Sandbox (Offline Mode)</span>
            </button>
          </div>

          <div className="text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5 pt-2">
            <Lock className="h-3 w-3 text-emerald-500/70" />
            <span>FIPS 140-2 Compliant Cloud Encrypted Link</span>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-300">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
        
        {/* Child Selector Profile Strip */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-900/50">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Managing Profile:</label>
          <div className="grid grid-cols-2 gap-2">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedChildId(p.id)}
                className={`p-2 rounded-xl flex flex-col items-center border transition-all text-center cursor-pointer ${
                  selectedChildId === p.id
                    ? "bg-cyan-500/10 text-cyan-600 border-cyan-400 dark:text-cyan-400"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                <img 
                  src={p.avatar} 
                  alt={p.name} 
                  className={`h-9 w-9 rounded-full object-cover border-2 ${selectedChildId === p.id ? "border-cyan-400" : "border-slate-300"}`}
                />
                <span className="text-xs font-bold mt-1 block truncate w-full">{p.name}</span>
                <span className="text-[9px] text-slate-400">Age {p.age}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {[
            { id: "overview", label: "Dashboard Home", icon: Users },
            { id: "devices", label: "Child Hardware", icon: Smartphone },
            { id: "map", label: "Live Geofences", icon: Map },
            { id: "timeline", label: "Activity Logs", icon: History },
            { id: "ai-report", label: "AI Weekly Report", icon: FileText },
            { id: "talent", label: "Future Potential", icon: Award },
            { id: "danger-center", label: "Dangerous Content", icon: ShieldAlert },
            { id: "controls", label: "App & Web Rules", icon: Sliders },
            { id: "assistant", label: "Family AI Assistant", icon: MessageSquare, badge: "GEMINI 3.5" },
            { id: "settings", label: "Platform Setup", icon: Settings }
          ].map(item => {
            const IconComp = item.icon;
            const isAct = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isAct
                    ? "bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-md"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <IconComp className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isAct ? "bg-white text-slate-950" : "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Global parent account details */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center space-x-3">
          <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold">ES</div>
          <div>
            <p className="text-xs font-bold leading-none">Elijah Stephen</p>
            <span className="text-[10px] text-slate-400">Account: Elite Guard</span>
          </div>
        </div>

      </aside>

      {/* DYNAMIC CONTENT SPACE */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
        
        {/* TOP STATUS HIGHLIGHTS BAR */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold font-mono uppercase text-slate-400 tracking-wider">Guardian Panel</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display">
              {activeChild.name}'s Safety Portal
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick action: Immediate remote toggle lock */}
            <button
              onClick={() => toggleDeviceLock(activeChild.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeChild.status === "locked"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                  : "bg-rose-500 hover:bg-rose-400 text-white"
              }`}
            >
              {activeChild.status === "locked" ? (
                <>
                  <Unlock className="h-3.5 w-3.5" />
                  <span>Unblock Device</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Immediate Lock</span>
                </>
              )}
            </button>

            {/* Hardware Status indicator */}
            <div className="bg-white dark:bg-slate-800 border px-3 py-2 rounded-xl text-xs space-y-0.5">
              <p className="text-[9px] text-slate-400 uppercase font-mono font-bold leading-none">Primary Hardware</p>
              <div className="flex items-center space-x-2">
                <span className="truncate max-w-[120px] font-medium">{activeChild.device}</span>
                <span className="flex items-center text-slate-500 font-mono text-[10px]">
                  <Battery className="h-3.5 w-3.5 text-emerald-500 mr-0.5" /> {activeChild.battery}%
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ACTION FEEDBACK STATUS NOTIFICATION */}
        {actionFeedback && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl p-4 flex items-center space-x-3 text-xs text-blue-800 dark:text-blue-300 shadow-sm animate-fade-in animate-pulse duration-1000">
            <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="flex-1 font-medium">{actionFeedback}</div>
            <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <Plus className="h-4 w-4 rotate-45" />
            </button>
          </div>
        )}

        {/* QUICK ACTIONS TOOLBAR */}
        <div className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-[2rem] p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Real-time Override</span>
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping"></span>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">Quick Command Center</h3>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Targeting: <strong className="text-slate-800 dark:text-teal-400 font-semibold">{activeChild.name} ({activeChild.device})</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Button 1: Remote Lock */}
            <button
              onClick={() => toggleDeviceLock(activeChild.id)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-300 cursor-pointer ${
                activeChild.status === "locked"
                  ? "bg-emerald-500/10 border-emerald-400 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-slate-700 dark:text-slate-200"
              }`}
            >
              <div className={`p-2.5 rounded-xl mb-2 ${activeChild.status === "locked" ? "bg-emerald-500/20" : "bg-slate-100 dark:bg-slate-800"}`}>
                {activeChild.status === "locked" ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5 text-rose-500" />}
              </div>
              <span className="text-xs font-bold font-display">{activeChild.status === "locked" ? "Unlock Device" : "Remote Lock"}</span>
              <span className="text-[9px] text-slate-400 mt-1">{activeChild.status === "locked" ? "Currently Locked" : "Secure Connection"}</span>
            </button>

            {/* Button 2: Live Location */}
            <button
              onClick={() => {
                setActiveTab("map");
                setActionFeedback(`Locating ${activeChild.name}'s ${activeChild.device} via live hardware telemetry GPS...`);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-slate-700 dark:text-slate-200 text-center transition-all duration-300 cursor-pointer"
            >
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2">
                <MapPin className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-xs font-bold font-display">Live Location</span>
              <span className="text-[9px] text-slate-400 mt-1">Locate on Map</span>
            </button>

            {/* Button 3: SOS Alert Siren */}
            <button
              onClick={() => triggerSosAlert(activeChild.id)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-300 cursor-pointer relative overflow-hidden ${
                sosActive[activeChild.id]
                  ? "bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-500/20"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-slate-700 dark:text-slate-200"
              }`}
            >
              {sosActive[activeChild.id] && (
                <div className="absolute inset-0 bg-rose-600/10 animate-pulse"></div>
              )}
              <div className={`p-2.5 rounded-xl mb-2 relative z-10 ${sosActive[activeChild.id] ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>
                <ShieldAlert className={`h-5 w-5 ${sosActive[activeChild.id] ? "text-white animate-bounce" : "text-amber-500"}`} />
              </div>
              <span className="text-xs font-bold font-display relative z-10">{sosActive[activeChild.id] ? "Stop SOS Siren" : "Trigger SOS"}</span>
              <span className={`text-[9px] mt-1 relative z-10 ${sosActive[activeChild.id] ? "text-rose-100 animate-pulse" : "text-slate-400"}`}>
                {sosActive[activeChild.id] ? "Siren Broadcasting" : "Forced Alarm Sound"}
              </span>
            </button>

            {/* Button 4: Study Mode Toggle */}
            <button
              onClick={() => toggleStudyMode(activeChild.id)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-300 cursor-pointer ${
                studyMode[activeChild.id]
                  ? "bg-teal-500/10 border-teal-400 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 text-slate-700 dark:text-slate-200"
              }`}
            >
              <div className={`p-2.5 rounded-xl mb-2 ${studyMode[activeChild.id] ? "bg-teal-500/20" : "bg-slate-100 dark:bg-slate-800"}`}>
                <BookOpen className="h-5 w-5 text-teal-500" />
              </div>
              <span className="text-xs font-bold font-display">{studyMode[activeChild.id] ? "Disable Study" : "Study Mode"}</span>
              <span className="text-[9px] text-slate-400 mt-1">
                {studyMode[activeChild.id] ? "Focus Mode Active" : "No Content Blocks"}
              </span>
            </button>

            {/* Button 5: Bump Screen Time */}
            <button
              onClick={() => bumpScreenTime(activeChild.id)}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-200 text-center transition-all duration-300 cursor-pointer col-span-2 md:col-span-1"
            >
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2">
                <Plus className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-xs font-bold font-display">+15m Limit</span>
              <span className="text-[9px] text-slate-400 mt-1">Extend Allowance</span>
            </button>
          </div>
        </div>

        {/* TAB CONTENTS */}

        {/* 1. DASHBOARD HOME (OVERVIEW) */}
        {activeTab === "overview" && (
          <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            
            {/* BENTO STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: AI Safety Score */}
              <motion.div 
                variants={cardVariants}
                whileHover="hover"
                whileTap="tap"
                className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 p-6 rounded-[2rem] shadow-xl flex flex-col justify-between cursor-default"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Digital Health</p>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-1">{activeChild.name}'s AI Safety Score</h3>
                    </div>
                    <div className="w-14 h-14 rounded-full border-4 border-teal-400 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{100 - activeChild.riskScore}%</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    Based on active telemetry content scans and hardware policy compliance levels.
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Status: <strong className="text-emerald-500 font-semibold">Highly Secure</strong></span>
                  <span className="font-mono text-[10px]">99.8% UPTIME</span>
                </div>
              </motion.div>

              {/* Card 2: Screen Time Limit */}
              <motion.div 
                variants={cardVariants}
                whileHover="hover"
                whileTap="tap"
                className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 p-6 rounded-[2rem] shadow-xl flex flex-col justify-between cursor-default"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Today's Usage</p>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-1">Screen Time Allotment</h3>
                    </div>
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>

                  <div className="space-y-3 mt-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {activeChild.screenTimeToday} Mins <span className="text-xs font-normal text-slate-400">used</span>
                      </span>
                      <span className="text-slate-400 text-xs">Limit: {activeChild.screenTimeLimit} Mins</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-teal-400 rounded-full" 
                        style={{ width: `${(activeChild.screenTimeToday / activeChild.screenTimeLimit) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Remaining: <strong>{activeChild.screenTimeLimit - activeChild.screenTimeToday} Mins</strong></span>
                  <button onClick={() => setActiveTab("controls")} className="text-blue-600 hover:underline text-[10px] uppercase font-mono">Adjust limits →</button>
                </div>
              </motion.div>

              {/* Card 3: AI Talent Spotlight */}
              <motion.div 
                variants={cardVariants}
                whileHover="hover"
                whileTap="tap"
                className="bg-slate-900 dark:bg-slate-950 text-white rounded-[2rem] p-6 shadow-2xl flex flex-col justify-between border border-slate-800 relative overflow-hidden cursor-default"
              >
                {/* Decorative blur inside card */}
                <div className="absolute top-[-20%] right-[-20%] w-[120px] h-[120px] bg-blue-500/20 rounded-full blur-[30px]"></div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Talent Discovery</p>
                      <h3 className="text-lg font-bold text-white mt-1">AI Interest Spotlight</h3>
                    </div>
                    <Award className="h-5 w-5 text-teal-400" />
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mt-2">
                    Detected a <span className="text-teal-400 font-semibold font-mono">+{activeInterest.talentScore}% score</span> in creative design & logical reasoning focus this week.
                  </p>
                </div>

                <div className="relative z-10 mt-6 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Identified Focus: <strong className="text-white">{activeInterest.talents[0]?.name || "STEM & Coding"}</strong></span>
                  <button onClick={() => setActiveTab("talent")} className="text-teal-400 hover:underline text-[10px] uppercase font-mono">Explore Talent →</button>
                </div>
              </motion.div>

            </div>

            {/* FAMILY RISK SCORE TREND WIDGET */}
            {(() => {
              // Extract real-time risk scores from active profiles in Firestore/State
              const leoRealScore = profiles.find(p => p.id === "child-1")?.riskScore ?? 12;
              const emilyRealScore = profiles.find(p => p.id === "child-2")?.riskScore ?? 4;
              const familyRealScore = Math.round((leoRealScore + emilyRealScore) / 2);

              // Today's dynamic combined security alerts text description
              const todayLeoEvents = dangerousEvents.filter(e => e.childId === "child-1");
              const todayEmilyEvents = dangerousEvents.filter(e => e.childId === "child-2");
              
              let todayCombinedEvent = "None";
              if (todayLeoEvents.length > 0 && todayEmilyEvents.length > 0) {
                todayCombinedEvent = `${todayLeoEvents.length} phishing/ad blocks (Leo) & ${todayEmilyEvents.length} content blocks (Emily)`;
              } else if (todayLeoEvents.length > 0) {
                todayCombinedEvent = `Leo: Blocked ${todayLeoEvents[0].category} attempt`;
              } else if (todayEmilyEvents.length > 0) {
                todayCombinedEvent = `Emily: Blocked ${todayEmilyEvents[0].category} attempt`;
              }

              // Trend data arrays
              const data7d = [
                { date: "Jul 01", label: "Jul 01", Leo: 24, Emily: 4, Family: 14, event: "Leo: Unverified proxy server detected", screenTime: 140 },
                { date: "Jul 02", label: "Jul 02", Leo: 12, Emily: 3, Family: 7.5, event: "None", screenTime: 130 },
                { date: "Jul 03", label: "Jul 03", Leo: 11, Emily: 3, Family: 7, event: "None", screenTime: 125 },
                { date: "Jul 04", label: "Jul 04", Leo: 14, Emily: 12, Family: 13, event: "Emily: Blocked adult forum link", screenTime: 110 },
                { date: "Jul 05", label: "Jul 05", Leo: 15, Emily: 4, Family: 9.5, event: "Leo: Flagged gaming server login blocked", screenTime: 145 },
                { date: "Jul 06", label: "Jul 06", Leo: 12, Emily: 5, Family: 8.5, event: "None", screenTime: 115 },
                { date: "Jul 07", label: "Jul 07 (Today)", Leo: leoRealScore, Emily: emilyRealScore, Family: familyRealScore, event: todayCombinedEvent, screenTime: profiles.reduce((sum, p) => sum + p.screenTimeToday, 0) }
              ];

              const data30d = [
                { date: "Jun 08", label: "Jun 08", Leo: 8, Emily: 2, Family: 5, event: "None", screenTime: 95 },
                { date: "Jun 11", label: "Jun 11", Leo: 15, Emily: 3, Family: 9, event: "Leo: Bypassed router DNS - Alert triggered", screenTime: 135 },
                { date: "Jun 14", label: "Jun 14", Leo: 10, Emily: 2, Family: 6, event: "None", screenTime: 120 },
                { date: "Jun 17", label: "Jun 17", Leo: 28, Emily: 5, Family: 16.5, event: "Leo: Scam server link blocked", screenTime: 180 },
                { date: "Jun 20", label: "Jun 20", Leo: 12, Emily: 14, Family: 13, event: "Emily: Blocked adult search redirect", screenTime: 95 },
                { date: "Jun 23", label: "Jun 23", Leo: 9, Emily: 3, Family: 6, event: "None", screenTime: 115 },
                { date: "Jun 26", label: "Jun 26", Leo: 11, Emily: 2, Family: 6.5, event: "None", screenTime: 125 },
                { date: "Jun 29", label: "Jun 29", Leo: 24, Emily: 4, Family: 14, event: "Leo: Flagged VPN usage detected", screenTime: 140 },
                { date: "Jul 02", label: "Jul 02", Leo: 12, Emily: 3, Family: 7.5, event: "None", screenTime: 130 },
                { date: "Jul 05", label: "Jul 05", Leo: 14, Emily: 5, Family: 9.5, event: "Emily: Unscheduled exit from soccer boundaries", screenTime: 110 },
                { date: "Jul 07", label: "Jul 07 (Today)", Leo: leoRealScore, Emily: emilyRealScore, Family: familyRealScore, event: todayCombinedEvent, screenTime: profiles.reduce((sum, p) => sum + p.screenTimeToday, 0) }
              ];

              const activeChartData = trendPeriod === "7d" ? data7d : data30d;

              // Compute stats based on the active dataset & filter
              const riskPoints = activeChartData.map(d => {
                if (trendFilter === "leo") return d.Leo;
                if (trendFilter === "emily") return d.Emily;
                return d.Family;
              });

              const currentScore = trendFilter === "leo" ? leoRealScore : trendFilter === "emily" ? emilyRealScore : familyRealScore;
              const maxScoreInPeriod = Math.max(...riskPoints);
              const avgScoreInPeriod = Math.round(riskPoints.reduce((sum, v) => sum + v, 0) / riskPoints.length);
              
              // Count blocked in active data logs
              const totalIncidentsInPeriod = activeChartData.filter(d => d.event !== "None").length;

              // Risk Rating text & colors
              const getRiskLevelDetails = (score: number) => {
                if (score < 10) return { text: "Highly Secure", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", description: "All active child node parameters are well within standard, non-threatening thresholds." };
                if (score < 25) return { text: "Moderate Caution", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", description: "Slight elevations detected due to recent unverified site entries or minor geofence boundary exits." };
                return { text: "Elevated Risk", color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/30", description: "Critical protection incidents or recursive blocked outbounds detected. Needs parental attention." };
              };

              const rating = getRiskLevelDetails(currentScore);

              // Detailed safety logs table data
              const staticSafetyLogs = [
                { id: "sl-1", date: "2026-07-06", childName: "Emily", level: "safe", category: "SafeSearch", target: "Google Search", desc: "Forced SafeSearch filters on query 'best multiplayer web games'", action: "Filtered 10 results" },
                { id: "sl-2", date: "2026-07-05", childName: "Emily", level: "warning", category: "Location Out of Zone", target: "Sunnyvale Soccer Fields", desc: "Unscheduled exit from soccer field boundary during study hours", action: "Triggered geofence notification" },
                { id: "sl-3", date: "2026-07-04", childName: "Emily", level: "warning", category: "Adult Content Blocked", target: "chatroulette-clone.xxx/stream", desc: "Redirect click to flagged adult chat server detected", action: "Blocked connection & logged" },
                { id: "sl-4", date: "2026-07-01", childName: "Leo", level: "severe", category: "Insecure Connection", target: "unverified-vpn-proxy.co", desc: "Attempted SSL handshake with blacklisted third-party proxy bypass server", action: "Dropped connection & temporary device lock" },
                { id: "sl-5", date: "2026-06-29", childName: "Leo", level: "warning", category: "File Download Prevented", target: "cheat-codes-hack.exe", desc: "Attempted executable download from unverified community server", action: "Blocked file execution" },
                { id: "sl-6", date: "2026-06-22", childName: "Emily", level: "warning", category: "Adult Content Blocked", target: "anime-mature-chat.ru", desc: "Blocked domain query containing mature peer-to-peer user text chats", action: "Dropped network packets" },
                { id: "sl-7", date: "2026-06-19", childName: "Leo", level: "severe", category: "Scam & Phishing Blocked", target: "robux-generator-rewards.net", desc: "Attempted submission of user token to high-pressure Roblox items scam site", action: "Dropped TCP packet & alerted parents" },
                { id: "sl-8", date: "2026-06-17", childName: "Leo", level: "safe", category: "SafeSearch Enforcement", target: "Bing Search", desc: "Enforced strict content ratings for all web searches", action: "Active Guarding" },
                { id: "sl-9", date: "2026-06-11", childName: "Leo", level: "warning", category: "Insecure Search Terms", target: "Google Search", desc: "Flagged query 'how to bypass parent lock on Android S9'", action: "Sent nudge warning & logged" }
              ];

              const dynamicEvents = dangerousEvents.map(e => ({
                id: e.id,
                date: new Date(e.timestamp).toISOString().split('T')[0],
                childName: e.childId === "child-1" ? "Leo" : "Emily",
                level: e.riskLevel === "critical" || e.riskLevel === "high" ? "severe" : "warning",
                category: e.category,
                target: e.target,
                desc: e.reason,
                action: e.actionTaken || "Blocked connection"
              }));

              const systemSafetyLogs = logs
                .filter(l => l.safetyLevel === "severe" || l.safetyLevel === "warning")
                .map(l => ({
                  id: l.id,
                  date: new Date(l.timestamp).toISOString().split('T')[0],
                  childName: l.childId === "child-1" ? "Leo" : "Emily",
                  level: l.safetyLevel === "severe" ? "severe" : "warning",
                  category: "System Action",
                  target: l.title,
                  desc: l.description,
                  action: "Alert Triggered"
                }));

              const allTableLogs = [...dynamicEvents, ...systemSafetyLogs, ...staticSafetyLogs];
              const uniqueTableLogs = allTableLogs.filter((item, index, self) => 
                self.findIndex(t => t.id === item.id) === index
              );

              // Filter table logs
              const filteredTableLogs = uniqueTableLogs.filter(item => {
                const matchesSearch = 
                  item.category.toLowerCase().includes(trendSearch.toLowerCase()) ||
                  item.target.toLowerCase().includes(trendSearch.toLowerCase()) ||
                  item.desc.toLowerCase().includes(trendSearch.toLowerCase()) ||
                  item.childName.toLowerCase().includes(trendSearch.toLowerCase());

                const matchesLevel = 
                  trendLevelFilter === "all" ||
                  (trendLevelFilter === "safe" && item.level === "safe") ||
                  (trendLevelFilter === "warning" && item.level === "warning") ||
                  (trendLevelFilter === "severe" && item.level === "severe");

                const matchesChild = 
                  trendFilter === "all" ||
                  (trendFilter === "leo" && item.childName.toLowerCase() === "leo") ||
                  (trendFilter === "emily" && item.childName.toLowerCase() === "emily");

                return matchesSearch && matchesLevel && matchesChild;
              });

              const CustomTooltip = ({ active, payload, label }: any) => {
                if (active && payload && payload.length) {
                  const dataPoint = payload[0].payload;
                  return (
                    <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-700/50 shadow-2xl space-y-2 max-w-[280px]">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 font-sans">
                        <span className="font-bold text-xs text-slate-300 font-mono">{label}</span>
                        <span className="text-[10px] bg-cyan-500/10 text-cyan-400 font-mono px-1.5 py-0.5 rounded border border-cyan-500/20">
                          {dataPoint.screenTime} mins screen
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {payload.map((entry: any) => {
                          const isLeo = entry.name.toLowerCase().includes("leo");
                          const isEmily = entry.name.toLowerCase().includes("emily");
                          const color = isLeo ? "text-cyan-400" : isEmily ? "text-fuchsia-400" : "text-emerald-400";
                          return (
                            <div key={entry.name} className="flex justify-between space-x-4">
                              <span className="text-slate-400 flex items-center space-x-1">
                                <span className={`h-1.5 w-1.5 rounded-full ${isLeo ? "bg-cyan-400" : isEmily ? "bg-fuchsia-400" : "bg-emerald-400"}`} />
                                <span>{entry.name}:</span>
                              </span>
                              <span className={`font-mono font-bold ${color}`}>
                                {entry.value} / 100
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {dataPoint.event && dataPoint.event !== "None" && (
                        <div className="pt-1.5 border-t border-slate-800 space-y-0.5 font-sans">
                          <span className="text-[10px] uppercase font-mono font-bold text-rose-400 flex items-center space-x-1">
                            <ShieldAlert className="h-3 w-3 shrink-0" />
                            <span>Incidents Logged</span>
                          </span>
                          <p className="text-[11px] text-slate-300 leading-normal">{dataPoint.event}</p>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              };

              return (
                <motion.div 
                  id="family-risk-trends-widget" 
                  variants={cardVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 p-6 rounded-[2rem] shadow-xl space-y-6 cursor-default"
                >
                  
                  {/* WIDGET HEADER */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span 
                          onClick={() => setShowAiHub(prev => !prev)}
                          className={`p-1.5 rounded-lg cursor-pointer transition-all duration-300 flex items-center justify-center ${
                            showAiHub 
                              ? "bg-teal-500/20 text-teal-500 dark:bg-teal-400/20 dark:text-teal-400 shadow-md shadow-teal-500/10 scale-110" 
                              : "bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-500/20"
                          }`}
                          title="Click to toggle Guardian AI Intelligence Hub"
                        >
                          <Shield id="guardian-shield-icon" className={`h-5 w-5 ${showAiHub ? "animate-pulse text-teal-500 dark:text-teal-400" : "animate-bounce text-rose-500 dark:text-rose-400"}`} />
                        </span>
                        <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">Family Safety & Risk Trends</h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl font-sans">
                        Interactive telemetry mapping risk scoring trends and critical filter actions across your children's devices.
                      </p>
                    </div>

                    {/* CONTROL TOGGLES */}
                    <div className="flex flex-wrap items-center gap-2 self-start md:self-center font-sans">
                      
                      {/* AI INTELLIGENCE HUB QUICK TRIGGER */}
                      <button
                        onClick={() => setShowAiHub(prev => !prev)}
                        className={`px-3 py-1 text-[11px] font-bold rounded-xl flex items-center space-x-1 transition duration-300 cursor-pointer border ${
                          showAiHub 
                            ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-teal-400 shadow-md shadow-teal-500/15 scale-105" 
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-teal-400 hover:text-teal-500"
                        }`}
                      >
                        <Sparkles className={`h-3 w-3 ${showAiHub ? "animate-spin" : "animate-pulse"}`} />
                        <span>AI Intelligence Hub</span>
                      </button>

                      {/* CHILD PROFILE FILTER */}
                      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200/50 dark:border-slate-800">
                        <button
                          onClick={() => setTrendFilter("all")}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition ${
                            trendFilter === "all" 
                              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                          }`}
                        >
                          All Profiles
                        </button>
                        <button
                          onClick={() => setTrendFilter("leo")}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition ${
                            trendFilter === "leo" 
                              ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold shadow-sm" 
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                          }`}
                        >
                          Leo
                        </button>
                        <button
                          onClick={() => setTrendFilter("emily")}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition ${
                            trendFilter === "emily" 
                              ? "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 font-bold shadow-sm" 
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                          }`}
                        >
                          Emily
                        </button>
                      </div>

                      {/* TIME RANGE FILTER */}
                      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200/50 dark:border-slate-800">
                        <button
                          onClick={() => setTrendPeriod("7d")}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition ${
                            trendPeriod === "7d" 
                              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                          }`}
                        >
                          7 Days
                        </button>
                        <button
                          onClick={() => setTrendPeriod("30d")}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition ${
                            trendPeriod === "30d" 
                              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                          }`}
                        >
                          30 Days
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* GUARDIAN AI INTELLIGENCE HUB PANEL */}
                  {showAiHub && (
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/80 space-y-4 animate-fade-in font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Sparkles className="h-5 w-5 text-teal-500 animate-pulse" />
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white">Guardian AI Intelligence Hub</h4>
                        </div>
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 font-mono font-bold">
                          ACTIVE NODE
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ask Guardian AI for grounded analyses using Live Web search and Maps telemetry or synthesize dynamic visual safety/focus/detox assets for {activeChild.name}.
                      </p>

                      {/* HUB MODE SWITCH */}
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
                        <button
                          onClick={() => {
                            setAiHubMode("grounding");
                            setAiHubPrompt("");
                            setAiHubResponse(null);
                            setAiHubImageUrl(null);
                          }}
                          className={`py-2 text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center space-x-1.5 cursor-pointer ${
                            aiHubMode === "grounding"
                              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          }`}
                        >
                          <Compass className="h-4 w-4" />
                          <span>Grounded Insight Analyzer</span>
                        </button>
                        <button
                          onClick={() => {
                            setAiHubMode("image");
                            setAiHubPrompt("");
                            setAiHubResponse(null);
                            setAiHubImageUrl(null);
                          }}
                          className={`py-2 text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center space-x-1.5 cursor-pointer ${
                            aiHubMode === "image"
                              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          }`}
                        >
                          <Camera className="h-4 w-4" />
                          <span>Creative Guard Poster Gen</span>
                        </button>
                      </div>

                      {/* QUICK CONTEXT TAGS */}
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Suggested AI Queries</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiHubMode === "grounding" ? (
                            <>
                              <button
                                onClick={() => setAiHubPrompt(`Analyze ${activeChild.name}'s screen time patterns and suggest educational study links.`)}
                                className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 hover:border-teal-500 hover:bg-teal-500/5 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 transition truncate max-w-xs cursor-pointer"
                              >
                                🎯 Analyze screen time & suggest study links
                              </button>
                              <button
                                onClick={() => setAiHubPrompt(`Find highly rated child-friendly recreational parks and libraries near my coordinates`)}
                                className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 hover:border-teal-500 hover:bg-teal-500/5 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 transition truncate max-w-xs cursor-pointer"
                              >
                                📍 Find kid-friendly parks/libraries nearby
                              </button>
                              <button
                                onClick={() => setAiHubPrompt(`What are the standard digital security protocols for protecting children from online malware?`)}
                                className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 hover:border-teal-500 hover:bg-teal-500/5 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 transition truncate max-w-xs cursor-pointer"
                              >
                                🛡️ Digital security protocols guidelines
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setAiHubPrompt(`Futuristic guardian robot guiding a kid safely through a clean digital grid, neon highlights`)}
                                className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 hover:border-teal-500 hover:bg-teal-500/5 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 transition truncate max-w-xs cursor-pointer"
                              >
                                🤖 Futuristic guardian robot poster
                              </button>
                              <button
                                onClick={() => setAiHubPrompt(`Warm study room full of books and cozy light, focus and creative learning theme`)}
                                className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 hover:border-teal-500 hover:bg-teal-500/5 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 transition truncate max-w-xs cursor-pointer"
                              >
                                📚 Cozy study & focus learning poster
                              </button>
                              <button
                                onClick={() => setAiHubPrompt(`Digital detox shield badge over a background of beautiful green forest trees`)}
                                className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 hover:border-teal-500 hover:bg-teal-500/5 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 transition truncate max-w-xs cursor-pointer"
                              >
                                🌲 Digital screen detox forest poster
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* PROMPT TEXTAREA */}
                      <div className="relative">
                        <textarea
                          rows={3}
                          value={aiHubPrompt}
                          onChange={(e) => setAiHubPrompt(e.target.value)}
                          placeholder={aiHubMode === "grounding" ? "Enter what you want Gemini to analyze or research..." : "Describe the safety or focus poster to generate..."}
                          className="w-full bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 pr-10 resize-none font-sans"
                        />
                      </div>

                      {/* SETTINGS ROW & SUBMIT BUTTON */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                        {aiHubMode === "grounding" ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-400">Grounding Source:</span>
                            <select
                              value={aiHubGroundingType}
                              onChange={(e) => setAiHubGroundingType(e.target.value as any)}
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                            >
                              <option value="search">🔍 Google Search Grounding</option>
                              <option value="maps">🗺️ Google Maps Location Grounding</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-400">Resolution Size:</span>
                            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-0.5 border border-slate-200/50 dark:border-slate-800/80">
                              {(["1K", "2K", "4K"] as const).map((sz) => (
                                <button
                                  key={sz}
                                  onClick={() => setAiHubImageSize(sz)}
                                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all duration-300 cursor-pointer ${
                                    aiHubImageSize === sz
                                      ? "bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm"
                                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  }`}
                                >
                                  {sz}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={handleAiHubSubmit}
                          disabled={aiHubLoading || !aiHubPrompt.trim()}
                          className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-teal-500/10 cursor-pointer disabled:opacity-50 disabled:pointer-events-none self-end sm:self-auto"
                        >
                          {aiHubLoading ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Synthesizing...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>{aiHubMode === "grounding" ? "Query Guardian Network" : "Synthesize Asset"}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* LOADING / ERROR STATE */}
                      {aiHubLoading && (
                        <div className="p-8 bg-white dark:bg-slate-950/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-3 animate-pulse text-center">
                          <Cpu className="h-8 w-8 text-teal-500 animate-spin" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Generating Safe Multi-Modal Syntheses...</p>
                            <p className="text-[10px] text-slate-400 max-w-sm">
                              {aiHubMode === "grounding" 
                                ? `Accessing Live ${aiHubGroundingType === "search" ? "Google Search" : "Google Maps"} grounding channels safely under offline encryption.`
                                : `Rendering high quality safety assets via gemini-3-pro-image-preview model.`}
                            </p>
                          </div>
                        </div>
                      )}

                      {aiHubError && (
                        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex items-start space-x-2 text-xs text-rose-800 dark:text-rose-400">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">Synthesis Alert</p>
                            <p className="text-[11px] leading-relaxed">{aiHubError}</p>
                          </div>
                        </div>
                      )}

                      {/* GROUNDED INSIGHT RESULTS VIEW */}
                      {aiHubResponse && !aiHubLoading && (
                        <div className="bg-white dark:bg-slate-950 p-5 rounded-3xl border border-slate-100 dark:border-slate-800/80 space-y-4 animate-fade-in font-sans">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Grounded Network Insight</p>
                            {aiHubIsFallback && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 font-bold uppercase">
                                High-Availability Advice
                              </span>
                            )}
                          </div>
                          
                          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans text-left">
                            {aiHubResponse}
                          </div>

                          {/* Render Grounding Chunks/Citations if available */}
                          {aiHubMetadata?.groundingChunks && aiHubMetadata.groundingChunks.length > 0 && (
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-900 space-y-2">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Verified References</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                                {aiHubMetadata.groundingChunks.map((chunk: any, i: number) => {
                                  const url = chunk.web?.uri || chunk.maps?.uri || "#";
                                  const title = chunk.web?.title || chunk.maps?.title || `Source [${i + 1}]`;
                                  return (
                                    <a 
                                      key={i} 
                                      href={url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      referrerPolicy="no-referrer"
                                      className="flex items-center space-x-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-teal-500 hover:bg-teal-500/5 transition text-xs truncate"
                                    >
                                      <ExternalLink className="h-3 w-3 text-teal-500 shrink-0" />
                                      <span className="truncate text-slate-700 dark:text-slate-200 font-medium">{title}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* IMAGE POSTER RESULTS VIEW */}
                      {aiHubImageUrl && !aiHubLoading && (
                        <div className="bg-white dark:bg-slate-950 p-5 rounded-3xl border border-slate-100 dark:border-slate-800/80 space-y-4 animate-fade-in text-center font-sans">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Dynamic Multi-Modal Asset</p>
                            <span className="text-[9px] bg-teal-500/10 text-teal-500 px-2 py-0.5 rounded border border-teal-500/20 font-bold uppercase font-mono">
                              {aiHubIsFallback ? "FALLBACK SVG" : `${aiHubImageSize} IMAGE`}
                            </span>
                          </div>

                          <div className="flex justify-center p-2 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 max-h-[380px] overflow-hidden">
                            <img 
                              src={aiHubImageUrl} 
                              alt="Guardian safety generated poster" 
                              className="max-h-[350px] object-contain rounded-xl shadow-md border dark:border-slate-800"
                              referrerPolicy="no-referrer"
                            />
                          </div>

                          {aiHubIsFallback && (
                            <p className="text-[10px] text-amber-500 font-medium italic">
                              Offline Mode: Rendered high-fidelity custom visual poster due to very high request rates on main cloud.
                            </p>
                          )}

                          <div className="flex justify-center">
                            <a
                              href={aiHubImageUrl}
                              download={`guardian_safety_poster_${aiHubImageSize}.png`}
                              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                            >
                              <Download className="h-3.5 w-3.5 text-slate-500" />
                              <span>Download High Quality Asset</span>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* METRIC BOXES HIGHLIGHT GRID */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">Active Risk Index</span>
                      <div className="flex items-baseline space-x-1.5 mt-1">
                        <p className={`text-2xl font-black ${currentScore > 30 ? "text-rose-500" : currentScore > 15 ? "text-amber-500" : "text-emerald-500"}`}>
                          {currentScore}
                        </p>
                        <span className="text-xs text-slate-400">/ 100</span>
                      </div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-1.5 ${rating.bg} ${rating.color}`}>
                        {rating.text}
                      </span>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">Average risk</span>
                      <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                        {avgScoreInPeriod} <span className="text-xs font-normal text-slate-400">/100</span>
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-2">Overall period mean score</span>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">Peak risk score</span>
                      <div className="flex items-baseline space-x-1 mt-1">
                        <p className="text-2xl font-black text-slate-800 dark:text-white">
                          {maxScoreInPeriod}
                        </p>
                        <span className="text-xs text-rose-500 font-semibold font-mono">Max Peak</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-2">Highest level registered</span>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">Threat Interceptions</span>
                      <p className="text-2xl font-black text-rose-500 mt-1">
                        {totalIncidentsInPeriod}
                      </p>
                      <span className="text-[10px] text-emerald-500 font-semibold block mt-2 flex items-center space-x-0.5">
                        <Check className="h-3 w-3 shrink-0" />
                        <span>100% Blocked & Safe</span>
                      </span>
                    </div>
                  </div>

                  {/* ACTIVE RISK DESCRIPTION BOX */}
                  <div className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs leading-relaxed font-sans ${rating.bg} ${rating.border}`}>
                    <Info className={`h-4 w-4 shrink-0 mt-0.5 ${rating.color}`} />
                    <div className="space-y-0.5">
                      <span className={`font-bold uppercase tracking-wider text-[10px] ${rating.color}`}>Protection Status: {rating.text}</span>
                      <p className="text-slate-600 dark:text-slate-300 font-medium">
                        {rating.description} {currentScore > 15 ? "We recommend checking the detailed audit log or discussing safe browsing norms." : "Keep up the healthy digital monitoring!"}
                      </p>
                    </div>
                  </div>

                  {/* RECHARTS PLOT FRAME */}
                  <div className="relative bg-slate-50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                    
                    {/* Background threshold bands indicator labels */}
                    <div className="absolute right-4 top-4 flex items-center space-x-3 text-[9px] font-mono text-slate-400 z-10">
                      <div className="flex items-center space-x-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>Safe (&lt;15)</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span>Caution (15-35)</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <span>Severe (&gt;35)</span>
                      </div>
                    </div>

                    <div className="h-[280px] w-full pt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={activeChartData}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorLeo" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorEmily" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#d946ef" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#d946ef" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorFamily" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(203, 213, 225, 0.15)" />
                          
                          <XAxis 
                            dataKey="date" 
                            tickLine={false} 
                            axisLine={false}
                            tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }} 
                          />
                          
                          <YAxis 
                            domain={[0, 100]} 
                            tickCount={6}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                          />

                          <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(148, 163, 184, 0.2)", strokeWidth: 1 }} />
                          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: "sans-serif", paddingBottom: 10 }} />
                          
                          {/* Reference limits */}
                          <ReferenceLine y={15} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.6} />
                          <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />

                          {/* Render selected line/area charts */}
                          {(trendFilter === "all" || trendFilter === "leo") && (
                            <Area
                              name="Leo's Risk Score"
                              type="monotone"
                              dataKey="Leo"
                              stroke="#06b6d4"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#colorLeo)"
                              activeDot={{ r: 6 }}
                            />
                          )}

                          {(trendFilter === "all" || trendFilter === "emily") && (
                            <Area
                              name="Emily's Risk Score"
                              type="monotone"
                              dataKey="Emily"
                              stroke="#d946ef"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#colorEmily)"
                              activeDot={{ r: 6 }}
                            />
                          )}

                          {trendFilter === "all" && (
                            <Line
                              name="Family Composite Risk"
                              type="monotone"
                              dataKey="Family"
                              stroke="#10b981"
                              strokeWidth={3}
                              strokeDasharray="4 4"
                              dot={{ r: 4, stroke: "#10b981", strokeWidth: 2, fill: "#fff" }}
                              activeDot={{ r: 7 }}
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* BOTTOM REOMMENDATIONS SECTION */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900 text-white rounded-2xl relative overflow-hidden font-sans">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl"></div>
                    <div className="space-y-1 relative z-10 max-w-lg">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span>Guardian AI Nudge Tip</span>
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {trendFilter === "leo" && currentScore > 10 
                          ? "Leo's risk index rose slightly due to unverified Minecraft multiplayer server lookups. We advise scheduling a quick 5-minute discussion on in-game safety and chat platforms."
                          : trendFilter === "emily" && currentScore > 10
                          ? "Emily's score experienced a warning spike due to unscheduled safe-zone departures. Please ensure her device has location settings set to High Precision."
                          : "Your overall Family Risk score is highly secure at 8/100. Routine screen discipline is optimal and SafeSearch continues protecting all query pipelines. Excellent work!"}
                      </p>
                    </div>

                    <button 
                      onClick={() => setShowTrendTable(!showTrendTable)}
                      className="shrink-0 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center space-x-1 font-sans"
                    >
                      <span>{showTrendTable ? "Hide Log Table" : "Detailed Audit Log"}</span>
                      <ChevronRight className={`h-3 w-3 transition transform ${showTrendTable ? "rotate-90" : ""}`} />
                    </button>
                  </div>

                  {/* DETAILED AUDIT LOG TABLE (COLLAPSIBLE) */}
                  {showTrendTable && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-fadeIn font-sans">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                          <History className="h-4 w-4 text-cyan-500" />
                          <span>Detailed Safety & Risk Audit Trail</span>
                        </h4>

                        {/* TABLE FILTERS */}
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder="Search incidents or urls..."
                            value={trendSearch}
                            onChange={(e) => setTrendSearch(e.target.value)}
                            className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl max-w-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none text-slate-800 dark:text-white"
                          />

                          <select
                            value={trendLevelFilter}
                            onChange={(e: any) => setTrendLevelFilter(e.target.value)}
                            className="text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-cyan-500 focus:outline-none text-slate-600 dark:text-slate-300"
                          >
                            <option value="all">All Levels</option>
                            <option value="safe">Safe Only</option>
                            <option value="warning">Warning Only</option>
                            <option value="severe">Severe Only</option>
                          </select>
                        </div>
                      </div>

                      {/* DATA TABLE */}
                      <div className="overflow-x-auto rounded-2xl border dark:border-slate-800">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 text-slate-400 font-bold border-b dark:border-slate-800">
                              <th className="p-3">Date</th>
                              <th className="p-3">Child</th>
                              <th className="p-3">Threat Category</th>
                              <th className="p-3">Target Endpoint</th>
                              <th className="p-3">Action Enforced</th>
                              <th className="p-3 text-right">Risk</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-slate-800/80">
                            {filteredTableLogs.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                                  No safety incidents found matching current filters.
                                </td>
                              </tr>
                            ) : (
                              filteredTableLogs.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                                  <td className="p-3 font-mono text-[11px] text-slate-400">{item.date}</td>
                                  <td className="p-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      item.childName.toLowerCase() === "leo" 
                                        ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" 
                                        : "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
                                    }`}>
                                      {item.childName}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-bold text-slate-800 dark:text-white">{item.category}</div>
                                    <div className="text-[10px] text-slate-400 font-medium max-w-[220px] truncate">{item.desc}</div>
                                  </td>
                                  <td className="p-3 font-mono text-[10px] text-slate-500 dark:text-slate-400 max-w-[160px] truncate">
                                    {item.target}
                                  </td>
                                  <td className="p-3 font-medium text-slate-600 dark:text-slate-300">{item.action}</td>
                                  <td className="p-3 text-right">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                                      item.level === "severe" ? "bg-rose-500/10 text-rose-500" :
                                      item.level === "warning" ? "bg-amber-500/10 text-amber-500" :
                                      "bg-emerald-500/10 text-emerald-500"
                                    }`}>
                                      {item.level}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </motion.div>
              );
            })()}

            {/* SEVERE WARNINGS BANNER IF APPLICABLE */}
            {childLogs.some(l => l.safetyLevel === "severe") && (
              <motion.div 
                variants={cardVariants}
                whileHover="hover"
                whileTap="tap"
                className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-start space-x-3 text-rose-800 dark:text-rose-300 cursor-default"
              >
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 animate-bounce text-rose-500" />
                <div className="space-y-1">
                  <h4 className="font-bold text-xs uppercase tracking-wider">Severe Safety Incident Logged</h4>
                  <p className="text-xs">
                    Guardian AI neutralized a severe risk target on {activeChild.name}'s tablet today. Check the **Dangerous Content Center** for logs and safety advice.
                  </p>
                </div>
              </motion.div>
            )}

            {/* SPLIT VIEW: RECENT ACTIONS VS FAMILY ASSISTANT CHATBOX MINI */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Recent Logs feed */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-base font-display">Recent Activity Timeline</h3>
                  <button onClick={() => setActiveTab("timeline")} className="text-xs text-cyan-600 hover:underline">View Full Log</button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto">
                  {childLogs.length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border text-slate-400 text-xs">
                      No recent events recorded for {activeChild.name}.
                    </div>
                  ) : (
                    childLogs.slice(0, 4).map(log => (
                      <motion.div 
                        key={log.id} 
                        variants={cardVariants}
                        whileHover={{
                          scale: 1.015,
                          x: 4,
                          boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.05)",
                          borderColor: "rgba(6, 182, 212, 0.2)"
                        }}
                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-start space-x-3 text-xs transition-colors duration-200 cursor-default"
                      >
                        <span className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${
                          log.safetyLevel === "safe" ? "bg-emerald-500" :
                          log.safetyLevel === "warning" ? "bg-amber-500 animate-pulse" : "bg-rose-500 animate-ping"
                        }`} />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">{log.title}</span>
                            <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400">{log.description}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Family Assistant chat snippet */}
              <div className="lg:col-span-6 space-y-4">
                <h3 className="font-bold text-base font-display flex items-center space-x-1.5">
                  <MessageSquare className="h-4 w-4 text-cyan-500" />
                  <span>Family AI Assistant (Gemini)</span>
                </h3>

                <motion.div 
                  variants={cardVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="bg-white dark:bg-slate-800 rounded-2xl border p-4 space-y-4 flex flex-col justify-between aspect-[4/3] max-h-[350px] cursor-default"
                >
                  
                  {/* Assistant message window snippet */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 text-xs">
                    <div className="bg-cyan-500/10 text-slate-700 dark:text-slate-200 p-3 rounded-2xl border border-cyan-500/20">
                      <Sparkles className="h-4 w-4 text-cyan-500 shrink-0 mb-1" />
                      <p>
                        Hi, I'm analyzing **{activeChild.name}**'s screen time patterns and security logs today. Click below to ask a direct telemetry diagnostic:
                      </p>
                      
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button 
                          onClick={() => {
                            setActiveTab("assistant");
                            handleAssistantSubmit("What did my child learn this week?");
                          }}
                          className="bg-white hover:bg-slate-50 dark:bg-slate-700 dark:hover:bg-slate-600 px-2.5 py-1 text-[10px] rounded border border-cyan-500/30 text-slate-800 dark:text-white"
                        >
                          "What did my child learn?"
                        </button>
                        <button 
                          onClick={() => {
                            setActiveTab("assistant");
                            handleAssistantSubmit("Why did screen time increase?");
                          }}
                          className="bg-white hover:bg-slate-50 dark:bg-slate-700 dark:hover:bg-slate-600 px-2.5 py-1 text-[10px] rounded border border-cyan-500/30 text-slate-800 dark:text-white"
                        >
                          "Why did screen time rise?"
                        </button>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab("assistant")}
                    className="w-full text-center py-2 bg-slate-900 hover:bg-slate-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 font-bold text-white text-xs rounded-xl"
                  >
                    Open Active Chat Sandbox
                  </button>

                </motion.div>
              </div>

            </div>

          </motion.div>
        )}

        {/* 2. CHILD HARDWARE DEVICES */}
        {activeTab === "devices" && (
          <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg font-display text-slate-800 dark:text-white">Enrolled Companion Devices</h3>
                <p className="text-xs text-slate-500">View real-time telemetry, remote lock/unlock, or pair new clients.</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-bold font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping mr-2"></span>
                LIVE GATEWAY ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {profiles.map(p => {
                const hasCompanion = !!p.deviceId;
                return (
                  <motion.div 
                    key={p.id} 
                    variants={cardVariants}
                    whileHover="hover"
                    whileTap="tap"
                    className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 cursor-default relative overflow-hidden shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img src={p.avatar} alt={p.name} className="h-12 w-12 rounded-full object-cover border" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold font-display text-slate-800 dark:text-white">{p.name}'s Profile Hardware</h4>
                            {hasCompanion && (
                              <span className="inline-flex items-center text-[9px] bg-teal-500/10 border border-teal-500/20 text-teal-500 rounded px-1 font-bold">
                                Companion Linked
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{p.device}</p>
                        </div>
                      </div>
                      
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        p.status === "locked" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400" :
                        p.status === "focus" ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-400" :
                        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                      }`}>
                        {p.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                      <div>
                        <p className="text-slate-400 text-[10px] uppercase font-mono">Battery Telemetry</p>
                        <p className="font-bold text-slate-700 dark:text-slate-200">{p.battery}% (Optimal health)</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px] uppercase font-mono">Connection Link</p>
                        <p className={`font-bold ${hasCompanion ? "text-emerald-500 animate-pulse" : "text-slate-500"}`}>
                          {hasCompanion ? "Real-Time Linked" : "Static Simulator Data"}
                        </p>
                      </div>
                    </div>

                    {hasCompanion && p.lastSeenLocation && (
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                        <span className="text-[9px] text-slate-400 uppercase font-mono block">Live Companion GPS</span>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[190px]">{p.lastSeenLocation.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.lastSeenLocation.timestamp ? new Date(p.lastSeenLocation.timestamp).toLocaleTimeString() : "Just now"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => toggleDeviceLock(p.id)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg cursor-pointer ${
                          p.status === "locked"
                            ? "bg-emerald-500 text-white"
                            : "bg-rose-500 text-white hover:bg-rose-600"
                        }`}
                      >
                        {p.status === "locked" ? "Unlock Profile Hardware" : "Remotely Lock Hardware"}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedChildId(p.id);
                          setActiveTab("controls");
                        }}
                        className="px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs rounded-lg font-bold text-slate-800 dark:text-white"
                      >
                        Configure Limits
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* SEPARATOR */}
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-6"></div>

            {/* PAIR NEW DEVICE SECTION */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-6">
              <div>
                <h3 className="font-bold text-lg font-display text-slate-800 dark:text-white">Pair New Companion Device</h3>
                <p className="text-xs text-slate-500">Securely connect an Android device running the Guardian AI Companion App.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Form fields column */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Select pairing mode */}
                  <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => {
                        setPairingMode("existing");
                        setPairingMessage(null);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pairingMode === "existing" 
                          ? "bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm" 
                          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      Link to Existing Child
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPairingMode("new");
                        setPairingMessage(null);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pairingMode === "new" 
                          ? "bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm" 
                          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      Register New Child
                    </button>
                  </div>

                  <form onSubmit={(e) => handlePairDevice(e)} className="space-y-4">
                    {/* Device ID block */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Companion Device ID</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={pairingDeviceId}
                          onChange={(e) => setPairingDeviceId(e.target.value.toUpperCase())}
                          placeholder="e.g. GUA-TRK819"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none text-sm font-mono tracking-wider font-bold text-slate-800 dark:text-white focus:border-cyan-500"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Get this unique code from the **Companion Client Simulator** header panel.
                      </span>
                    </div>

                    {pairingMode === "existing" ? (
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Assign to Profile</label>
                        <select
                          value={targetProfileId}
                          onChange={(e) => setTargetProfileId(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none text-sm font-bold text-slate-800 dark:text-white focus:border-cyan-500"
                        >
                          <option value="">-- Choose Profile --</option>
                          {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.name} {p.deviceId ? `(Already paired: ${p.deviceId})` : ""}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                        <h4 className="text-xs font-black uppercase text-slate-400 font-mono tracking-wider">New Profile Details</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Child's First Name</label>
                            <input
                              type="text"
                              value={newChildName}
                              onChange={(e) => setNewChildName(e.target.value)}
                              placeholder="e.g. Sophia"
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-xs text-white focus:border-cyan-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Age</label>
                            <input
                              type="number"
                              min="3"
                              max="18"
                              value={newChildAge}
                              onChange={(e) => setNewChildAge(Number(e.target.value))}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 outline-none text-xs text-white focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        {/* Avatar Picker Row */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-2">Select Profile Avatar</label>
                          <div className="flex gap-3">
                            {[
                              "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
                              "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150",
                              "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
                              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
                            ].map((url) => (
                              <button
                                key={url}
                                type="button"
                                onClick={() => setNewChildAvatar(url)}
                                className={`h-11 w-11 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                                  newChildAvatar === url ? "border-cyan-500 scale-110 shadow" : "border-transparent opacity-60"
                                }`}
                              >
                                <img src={url} alt="Avatar option" className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pairing Message Feedback */}
                    {pairingMessage && (
                      <div className={`p-4 rounded-xl text-xs font-bold leading-relaxed border ${
                        pairingMessage.type === "success" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                          : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                      }`}>
                        {pairingMessage.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isPairingLoading}
                      className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 dark:text-slate-950 text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isPairingLoading ? "Deploying Encrypted Connection Link..." : "Establish Real-Time Cloud Link"}
                    </button>
                  </form>
                </div>

                {/* Simulated scanner column */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-4 left-4 flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                    <span className="text-[9px] font-mono text-slate-500 uppercase">Scanner Gateway Feed</span>
                  </div>

                  {/* QR Code camera box mockup */}
                  <div className="h-[180px] w-[180px] border-2 border-slate-300 dark:border-slate-700 rounded-3xl relative flex items-center justify-center overflow-hidden bg-slate-950/40">
                    
                    {/* Futuristic scanner corners */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl"></div>
                    <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr"></div>
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl"></div>
                    <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br"></div>

                    {isQrScanning ? (
                      <>
                        <div className="absolute inset-x-2 h-0.5 bg-cyan-400 shadow-lg shadow-cyan-400/50 animate-[bounce_2s_infinite]"></div>
                        <QrCode className="h-14 w-14 text-slate-500 animate-pulse" />
                      </>
                    ) : (
                      <QrCode className="h-14 w-14 text-slate-600" />
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 text-center mt-4 max-w-[220px] leading-relaxed">
                    Instantly pair by scanning your child's companion screen using your camera feed.
                  </p>

                  <button
                    type="button"
                    onClick={handleSimulateQrScan}
                    disabled={isQrScanning}
                    className="mt-4 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-800 dark:text-white transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isQrScanning ? 'animate-spin' : ''}`} />
                    <span>{isQrScanning ? 'Scanning...' : 'Simulate Camera QR Scan'}</span>
                  </button>
                </div>

              </div>
            </div>

          </motion.div>
        )}

        {/* 3. LIVE MAP & SMART SAFE ZONES */}
        {activeTab === "map" && (
          <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base font-display">Interactive Geofences & Safe Zones</h3>
                <p className="text-xs text-slate-500">Adjust boundary radii and configure notification settings.</p>
              </div>

              {/* Dynamic boundary radius control */}
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex items-center space-x-3">
                <span className="font-semibold">Geofence Limit:</span>
                <input 
                  type="range" 
                  min="50" 
                  max="400" 
                  step="25" 
                  value={geofenceRadius}
                  onChange={(e) => setGeofenceRadius(parseInt(e.target.value))}
                  className="accent-cyan-500 cursor-pointer"
                />
                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{geofenceRadius}m</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Interactive Leaflet Map */}
              <motion.div variants={cardVariants} className="lg:col-span-8 space-y-4">
                <RealLeafletMap
                  profiles={profiles}
                  selectedChildId={selectedChildId}
                  safeZones={safeZones}
                  geofenceRadius={geofenceRadius}
                  draftZoneLat={draftZoneLat}
                  draftZoneLng={draftZoneLng}
                  setDraftZoneLat={setDraftZoneLat}
                  setDraftZoneLng={setDraftZoneLng}
                  activeMarkerId={activeMarkerId}
                  setActiveMarkerId={setActiveMarkerId}
                />
              </motion.div>

              {/* Right Column: Safe Zones administrator list */}
              <motion.div variants={cardVariants} className="lg:col-span-4 space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 font-mono">Enforced Safe Zones</h4>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {safeZones.map((zone, idx) => (
                    <div key={zone.id || idx} className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 dark:text-white">{zone.name}</span>
                        {zone.lat && zone.lng ? (
                          <p className="text-[9px] text-slate-400 font-mono">({zone.lat.toFixed(4)}, {zone.lng.toFixed(4)})</p>
                        ) : null}
                        <p className="text-[10px] text-slate-400">Boundary Radius: **{zone.radius || geofenceRadius}m**</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-400">
                          Enforced
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteSafeZoneInDb(zone.id)}
                          className="text-slate-400 hover:text-red-500 transition p-1 cursor-pointer"
                          title="Remove Geofence"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new mock geofence */}
                <form onSubmit={addNewZone} className="bg-slate-100 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800/50 space-y-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block font-mono">Add Safe Geofence Target</span>
                  
                  {draftZoneLat !== null && draftZoneLng !== null ? (
                    <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded-lg text-[10px] text-cyan-600 dark:text-cyan-400 space-y-1">
                      <p className="font-bold">📍 Map Location Selected:</p>
                      <p className="font-mono text-[9px]">Lat: {draftZoneLat.toFixed(5)}, Lng: {draftZoneLng.toFixed(5)}</p>
                      <button 
                        type="button" 
                        onClick={() => { setDraftZoneLat(null); setDraftZoneLng(null); }}
                        className="text-red-500 hover:underline font-semibold block"
                      >
                        Reset Selection
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-200/40 dark:bg-slate-800/40 p-2.5 rounded-lg text-[10px] text-slate-500 leading-relaxed">
                      💡 <strong>Tip:</strong> Click anywhere on the map to choose custom geofence coordinates, then name it below. Otherwise, a location near the active child will be used.
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Grandma's House"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-800 text-xs rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700"
                    />
                    <button type="submit" className="p-2 bg-cyan-500 text-slate-950 rounded-lg cursor-pointer hover:bg-cyan-600 transition">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </motion.div>

            </div>
          </motion.div>
        )}

        {/* 4. CHRONOLOGICAL ACTIVITY TIMELINE */}
        {activeTab === "timeline" && (
          <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-base font-display">Complete Activity Logs</h3>
                <p className="text-xs text-slate-500">Chronological telemetry feed filtered for {activeChild.name}.</p>
              </div>
              <button 
                onClick={() => setLogs(initialLogs)}
                className="text-xs flex items-center space-x-1 hover:underline text-cyan-600"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reset Logs</span>
              </button>
            </div>

            <div className="space-y-3 max-w-4xl">
              {childLogs.map(log => (
                <motion.div 
                  key={log.id} 
                  variants={cardVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className={`p-4 rounded-xl border flex gap-4 cursor-default ${
                    log.safetyLevel === "severe" ? "bg-rose-500/5 border-rose-500/30" :
                    log.safetyLevel === "warning" ? "bg-amber-500/5 border-amber-500/30" :
                    "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80"
                  }`}
                >
                  <div className="shrink-0 mt-1">
                    <span className={`h-3 w-3 rounded-full block ${
                      log.safetyLevel === "safe" ? "bg-emerald-500" :
                      log.safetyLevel === "warning" ? "bg-amber-500 animate-pulse" : "bg-rose-500 animate-ping"
                    }`} />
                  </div>

                  <div className="flex-1 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-1.5">
                        <span>{log.title}</span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 uppercase font-mono">
                          {log.type}
                        </span>
                      </h4>
                      <span className="text-slate-400 text-[10px] font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{log.description}</p>
                    
                    {log.safetyLevel !== "safe" && (
                      <div className="p-2 bg-slate-900 text-cyan-400 text-[10px] rounded border border-white/5 font-mono">
                        [Guardian Protection System Neutralization Verified]
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 5. AI WEEKLY REPORT PANEL */}
        {activeTab === "ai-report" && (
          <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            
            {/* Header section with print styles enabled */}
            <motion.div variants={cardVariants} className="rounded-[2rem] bg-gradient-to-tr from-slate-900 via-indigo-950 to-cyan-900 p-6 text-white border border-slate-800 relative overflow-hidden shadow-2xl">
              <div className="absolute top-[-20%] right-[-20%] w-[250px] h-[250px] bg-cyan-500/10 rounded-full blur-[80px]"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center space-x-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400 border border-cyan-500/20">
                    <Sparkles className="h-4 w-4" />
                    <span>AI Guardian Insights Platform</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black font-display tracking-tight leading-tight">
                    Weekly Digital Parenting Report
                  </h3>
                  <p className="text-slate-300 text-xs max-w-xl">
                    Telemetry analysis compiled securely on {new Date().toLocaleDateString()} for <strong className="text-cyan-400">{activeChild.name}</strong>. Data covers browsing heuristics, physical travel limits, and screen discipline index.
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => {
                      setIsRegeneratingReport(true);
                      setTimeout(() => {
                        setIsRegeneratingReport(false);
                        setActionFeedback("Weekly report updated with fresh real-time router packets.");
                      }, 1800);
                    }}
                    disabled={isRegeneratingReport}
                    className="no-print bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-lg shadow-cyan-500/10 cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRegeneratingReport ? "animate-spin" : ""}`} />
                    <span>{isRegeneratingReport ? "Analyzing..." : "Re-Scan History"}</span>
                  </button>
                  <button 
                    onClick={() => {
                      // Trigger custom print/PDF view
                      window.print();
                    }}
                    className="no-print bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 text-xs rounded-xl flex items-center space-x-1.5 transition-all border border-slate-700 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Print PDF</span>
                  </button>
                  <button 
                    onClick={() => {
                      // Trigger text report download
                      const downloadReportFile = () => {
                        const content = `GUARDIAN AI WEEKLY PARENTING REPORT
Child Name: ${activeChild.name}
Week Starting: ${activeReport.weekStarting}
-----------------------------------------
1. Screen Time Summary:
- Average Screen Time: ${selectedChildId === "child-1" ? "1 hour 45 mins/day" : "45 mins/day"}
- Today's Usage: ${activeChild.screenTimeToday} Mins / Limit: ${activeChild.screenTimeLimit} Mins
- Educational Ratio: ${selectedChildId === "child-1" ? "65% Educational, 25% Entertainment, 10% Other" : "75% Educational, 15% Entertainment, 10% Other"}

2. Most-Used Apps:
${activeReport.mostUsedApps.map(app => `- ${app.name}: ${app.duration} Mins`).join("\n")}

3. Behavioral Analytics:
- Daily Routine: ${selectedChildId === "child-1" ? "High post-school spike from 4:00 PM to 5:30 PM." : "Late morning weekend usage and early afternoons."}
- Sleep schedule index: ${activeReport.sleepScheduleInsights}
- Browsing trends: ${selectedChildId === "child-1" ? "Robotics, Python loops, Space rocket sandbox, Arduino hardware" : "Duolingo Kids stories, Spanish vocals, animal habitats"}

4. Geolocation & Travel Summary:
- School Zone: Arrived safely 14 times
- Soccer Field: Arrived safely 6 times
- Standard transport speed monitored inside safe limits.

5. Safe Web Protection & Network Scans:
- Scanned network packets: 14,840 sessions
- Flagged threat attempts: ${dangerousEvents.filter(e => e.childId === selectedChildId).length} neutralized
- Active installations: Scratch Junior (v2.4), Khan Academy Kids (v4.1)
- Active removals: None

6. AI Prescribed Recommendations:
${activeReport.personalizedRecommendations.map((r, i) => `${i+1}. ${r}`).join("\n")}
-----------------------------------------
Generated by Guardian AI Platform on ${new Date().toLocaleDateString()}`;
                        
                        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `Guardian_AI_Report_${activeChild.name}_${activeReport.weekStarting.replace(/\s+/g, "_")}.txt`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      };
                      downloadReportFile();
                    }}
                    className="no-print bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-lg shadow-indigo-600/10 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download TXT</span>
                  </button>
                </div>
              </div>

              {/* Date banner */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Active Week: <strong>{activeReport.weekStarting}</strong></span>
                <span className="font-mono text-[10px] text-cyan-400/80 uppercase tracking-widest bg-cyan-500/15 px-2 py-0.5 rounded">Heuristics: Active</span>
              </div>
            </motion.div>

            {isRegeneratingReport ? (
              <div className="bg-white dark:bg-slate-950 p-12 rounded-3xl border text-center space-y-4">
                <div className="flex justify-center">
                  <Brain className="h-12 w-12 text-cyan-500 animate-pulse" />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-wider font-mono text-cyan-500 animate-bounce">AI Diagnostics Compilation In Progress</h4>
                <div className="max-w-xs mx-auto space-y-2 text-xs text-slate-400">
                  <div className="flex items-center space-x-2 justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping"></span>
                    <span>Parsing outbound DNS requests (14,840 sessions)...</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 animate-[shimmer_1.5s_infinite]" style={{ width: "75%" }}></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print-container">
                
                {/* Left Columns - Narrative, Trends, routine */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Total screen time & ratio section */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700/60 shadow-md space-y-4">
                    <h4 className="font-bold font-display text-sm flex items-center space-x-1.5">
                      <Clock className="h-4 w-4 text-cyan-500" />
                      <span>Screen Time Overview</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border">
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Daily Average</span>
                        <p className="text-xl font-black text-slate-800 dark:text-white mt-1">
                          {selectedChildId === "child-1" ? "1 hr 45 min" : "45 min"}
                        </p>
                        <span className="text-[10px] text-emerald-500 font-semibold">↓ 12% drop vs last week</span>
                      </div>
                      
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border">
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Today's Total</span>
                        <p className="text-xl font-black text-slate-800 dark:text-white mt-1">
                          {activeChild.screenTimeToday} Mins
                        </p>
                        <span className="text-[10px] text-slate-400">Limit: {activeChild.screenTimeLimit} Mins</span>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border">
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Discipline Score</span>
                        <p className="text-xl font-black text-cyan-500 mt-1">
                          94 / 100
                        </p>
                        <span className="text-[10px] text-cyan-400 font-mono font-semibold">AI Class: Excellent</span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border space-y-3 text-xs leading-relaxed">
                      <h4 className="font-bold font-display text-xs text-slate-400 uppercase tracking-widest font-mono">Behavior Executive Summary</h4>
                      <p className="text-slate-600 dark:text-slate-300 font-sans">{activeReport.screenTimeSummary}</p>
                    </div>
                  </div>

                  {/* Sleeping & Daily Routine analysis */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md text-xs space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase text-slate-400 font-mono font-bold">Sleep schedule index</span>
                        <Moon className="h-4 w-4 text-indigo-400" />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{activeReport.sleepScheduleInsights}</p>
                      <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg text-[10px] font-mono">
                        [Downtime enforced from 8:30 PM]
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md text-xs space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase text-slate-400 font-mono font-bold">Daily Routine Analysis</span>
                        <TrendingUp className="h-4 w-4 text-cyan-400" />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{activeReport.dailyRoutineAnalysis}</p>
                      <div className="p-2 bg-cyan-500/10 text-cyan-500 rounded-lg text-[10px] font-mono">
                        [Sustained focus during homework hours]
                      </div>
                    </div>

                  </div>

                  {/* Geolocation and Web Trends */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md text-xs space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase text-slate-400 font-mono font-bold">Location & Geofence Logs</span>
                        <MapPin className="h-4 w-4 text-emerald-500" />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Estimated {activeChild.name} checked in safely at <strong>{selectedChildId === "child-1" ? "Oakridge Tech Academy" : "Sunnyvale Soccer Fields"}</strong>.
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] border-b pb-1 dark:border-slate-700">
                          <span>School safe zone check-ins</span>
                          <span className="font-bold">14 times</span>
                        </div>
                        <div className="flex justify-between text-[10px] border-b pb-1 dark:border-slate-700">
                          <span>Soccer safe zone check-ins</span>
                          <span className="font-bold">6 times</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span>Unscheduled geofence exits</span>
                          <span className="font-bold text-emerald-500">0 alerts</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md text-xs space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase text-slate-400 font-mono font-bold">Internet Browsing Heuristics</span>
                        <Globe className="h-4 w-4 text-cyan-400" />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{activeReport.browsingTrends}</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedChildId === "child-1" ? (
                          <>
                            <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded text-[9px] font-bold">#Robotics</span>
                            <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded text-[9px] font-bold">#PythonCoding</span>
                            <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded text-[9px] font-bold">#SpaceScience</span>
                          </>
                        ) : (
                          <>
                            <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded text-[9px] font-bold">#Linguistics</span>
                            <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded text-[9px] font-bold">#DuolingoKids</span>
                            <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded text-[9px] font-bold">#Acoustics</span>
                          </>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Safety Warnings Banner / Integration */}
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center space-x-1.5">
                        <Shield className="h-4.5 w-4.5 text-rose-500" />
                        <span>AI Web Protection Scan</span>
                      </h4>
                      <span className="bg-rose-500/10 text-rose-500 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                        {dangerousEvents.filter(e => e.childId === selectedChildId).length} Flagged Threats
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-normal">
                      Our real-time browser gateway scanned 14,840 DNS request packets on {activeChild.name}'s hardware. 
                      Neutralized attempts to launch scam trackers or access explicit categories. All incidents were automatically categorized.
                    </p>

                    <div className="space-y-2 pt-1">
                      {dangerousEvents.filter(e => e.childId === selectedChildId).slice(0, 2).map(e => (
                        <div key={e.id} className="flex justify-between items-center p-2.5 bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 rounded-xl text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{e.category} Detected</span>
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px] md:max-w-xs">{e.target}</span>
                          </div>
                          <button 
                            onClick={() => setActiveTab("danger-center")} 
                            className="text-xs text-rose-500 hover:underline font-bold uppercase font-mono text-[10px]"
                          >
                            Diagnose →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Software Installations / Removals */}
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md text-xs space-y-3">
                    <h4 className="font-bold font-display text-sm flex items-center space-x-1.5 text-slate-800 dark:text-white">
                      <PlusCircle className="h-4.5 w-4.5 text-cyan-500" />
                      <span>Software Configurations (This Week)</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/10 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest font-mono">App Installations Verified (2)</span>
                        <ul className="space-y-1 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          <li>• Scratch Junior (v2.4) - <i>July 5, 14:10</i></li>
                          <li>• Khan Academy Kids (v4.1) - <i>July 2, 09:30</i></li>
                        </ul>
                      </div>

                      <div className="p-3 bg-slate-500/5 dark:bg-slate-900/40 border border-slate-500/10 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">App Removals Logged (0)</span>
                        <p className="text-slate-500 italic">No applications were uninstalled or removed from device this week.</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Prescribed Recommendations */}
                  <div className="bg-gradient-to-tr from-slate-900 via-slate-950 to-indigo-950 p-6 rounded-[2rem] border border-slate-800/80 shadow-lg text-white space-y-4">
                    <h4 className="font-bold font-display text-base text-cyan-400 flex items-center space-x-1.5">
                      <Sparkles className="h-5 w-5 text-cyan-400" />
                      <span>Guardian AI Action Plan</span>
                    </h4>
                    <p className="text-xs text-slate-300">
                      Tailored guidance compiled based on {activeChild.name}'s digital signals:
                    </p>
                    <ul className="space-y-3 text-xs">
                      {activeReport.personalizedRecommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start space-x-2.5">
                          <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                          <span className="text-slate-200 leading-normal">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

                {/* Right Column - Educational vs Entertainment ratios, leaders list */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Activity ratio panel */}
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md space-y-4 text-xs">
                    <h4 className="font-bold font-display text-sm">Aesthetic Usage Ratio</h4>
                    
                    <div className="flex justify-center py-4">
                      {/* Simple visual semi-circular donut / ring representation */}
                      <div className="relative h-28 w-28 flex items-center justify-center">
                        <svg className="absolute inset-0 h-full w-full rotate-[-90deg]">
                          {/* Background ring */}
                          <circle cx="56" cy="56" r="48" fill="transparent" stroke="#f1f5f9" className="dark:stroke-slate-900" strokeWidth="8" />
                          
                          {/* Educational ring */}
                          <circle 
                            cx="56" 
                            cy="56" 
                            r="48" 
                            fill="transparent" 
                            stroke="#10b981" 
                            strokeWidth="8" 
                            strokeDasharray={`${2 * Math.PI * 48}`}
                            strokeDashoffset={`${2 * Math.PI * 48 * (1 - activeReport.educationalVsEntertainment.edu / 100)}`}
                          />
                        </svg>
                        <div className="text-center">
                          <p className="text-xl font-black text-slate-800 dark:text-white font-mono">{activeReport.educationalVsEntertainment.edu}%</p>
                          <p className="text-[10px] text-slate-400 uppercase font-mono">Learning focus</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-semibold text-emerald-500">Educational / Skill Building</span>
                          <span className="font-bold font-mono">{activeReport.educationalVsEntertainment.edu}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${activeReport.educationalVsEntertainment.edu}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-semibold text-indigo-500">Entertainment & Gaming</span>
                          <span className="font-bold font-mono">{activeReport.educationalVsEntertainment.ent}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${activeReport.educationalVsEntertainment.ent}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-400">Other / Utilities</span>
                          <span className="font-bold font-mono">{activeReport.educationalVsEntertainment.other}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-400" style={{ width: `${activeReport.educationalVsEntertainment.other}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Leaders panel */}
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md space-y-4 text-xs">
                    <h4 className="font-bold font-display text-sm">Most Active Software Platforms</h4>
                    
                    <div className="space-y-2">
                      {activeReport.mostUsedApps.map((app, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-2 border">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <div className="h-2 w-2 rounded-full bg-cyan-500"></div>
                              <span className="font-bold text-slate-800 dark:text-white">{app.name}</span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400 font-bold">{app.duration} mins</span>
                          </div>
                          
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500" 
                              style={{ width: `${(app.duration / 240) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}
          </motion.div>
        )}

        {/* 6. FUTURE POTENTIAL (INTEREST & TALENT DISCOVERY) */}
        {activeTab === "talent" && (
          <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            
            {/* Header detailing guidance vs predictor */}
            <motion.div variants={cardVariants} className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl relative overflow-hidden text-white">
              <div className="absolute top-[-20%] right-[-20%] w-[250px] h-[250px] bg-teal-500/10 rounded-full blur-[80px]"></div>
              
              <div className="relative z-10 space-y-3">
                <div className="inline-flex items-center space-x-1.5 rounded-full bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-400 border border-teal-500/20">
                  <Compass className="h-4 w-4 animate-spin-slow" />
                  <span>Interactive Development Mapping</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black font-display tracking-tight leading-none">
                  "Future Potential" Talent Discovery Dashboard
                </h3>
                
                {/* STRICT COMPLIANCE: PATTERN DISCOVERY DISCLAIMER */}
                <div className="p-3 bg-teal-500/10 border border-teal-400/20 rounded-xl text-xs text-slate-300 leading-relaxed max-w-2xl">
                  <strong>Guidance Notice:</strong> This mapping dashboard aggregates search queries, mathematical sandbox speeds, and educational app metrics. It provides <strong>guidance based on observed activity patterns</strong> to assist parents, and is not a definitive, deterministic prediction of your child's future path.
                </div>
              </div>
            </motion.div>

            {/* AI Summary Quote Panel as explicitly requested */}
            <motion.div variants={cardVariants} className="bg-slate-950 p-6 rounded-3xl border border-cyan-500/30 shadow-xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>
              <div className="flex items-start space-x-4">
                <Brain className="h-6 w-6 text-cyan-400 shrink-0 mt-1 animate-pulse" />
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold block">Guardian AI Observation Analysis</span>
                  <blockquote className="text-sm font-sans text-white font-medium leading-relaxed italic border-l-2 border-cyan-500 pl-4">
                    {selectedChildId === "child-1" 
                      ? '"Based on recent learning patterns, your child consistently explores AI, robotics, and mathematics. Consider encouraging coding competitions, robotics workshops, and STEM learning opportunities."'
                      : '"Based on recent learning patterns, Emily consistently explores language communication modules, auditory classical melody structures, and musical rhythm alignments. Consider encouraging conversational language drills, youth choir groups, and bilingual children’s storytelling."'
                    }
                  </blockquote>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left column: SVG Line chart & Skill Radar */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Curve area chart in SVG */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700/60 shadow-md space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">6-Month Aptitude Progression</h4>
                      <p className="text-[11px] text-slate-400">Progression rates inside top observed categories.</p>
                    </div>
                    <span className="bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded text-xs font-mono font-bold text-slate-500">
                      Score: +{activeInterest.talentScore}% Growth
                    </span>
                  </div>

                  {/* SVG CURVED LINE CHART */}
                  <div className="pt-4">
                    <div className="relative h-48 w-full">
                      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        
                        {/* Grid Lines */}
                        <line x1="0" y1="45" x2="500" y2="45" stroke="#cbd5e1" strokeDasharray="4" className="opacity-30" strokeWidth="1" />
                        <line x1="0" y1="90" x2="500" y2="90" stroke="#cbd5e1" strokeDasharray="4" className="opacity-30" strokeWidth="1" />
                        <line x1="0" y1="135" x2="500" y2="135" stroke="#cbd5e1" strokeDasharray="4" className="opacity-30" strokeWidth="1" />
                        
                        {/* Area Curve */}
                        {selectedChildId === "child-1" ? (
                          <>
                            {/* Area */}
                            <path 
                              d="M 10,130 C 100,115 150,90 250,75 C 350,60 410,40 490,20 L 490,160 L 10,160 Z" 
                              fill="url(#chartGrad)" 
                            />
                            {/* Line */}
                            <path 
                              d="M 10,130 C 100,115 150,90 250,75 C 350,60 410,40 490,20" 
                              fill="none" 
                              stroke="#06b6d4" 
                              strokeWidth="3.5" 
                              strokeLinecap="round" 
                            />
                            {/* Points dots */}
                            <circle cx="10" cy="130" r="5" fill="#ffffff" stroke="#06b6d4" strokeWidth="3" />
                            <circle cx="120" cy="112" r="5" fill="#ffffff" stroke="#06b6d4" strokeWidth="3" />
                            <circle cx="250" cy="75" r="5" fill="#ffffff" stroke="#06b6d4" strokeWidth="3" />
                            <circle cx="370" cy="50" r="5" fill="#ffffff" stroke="#06b6d4" strokeWidth="3" />
                            <circle cx="490" cy="20" r="5" fill="#ffffff" stroke="#06b6d4" strokeWidth="3" />
                          </>
                        ) : (
                          <>
                            {/* Emily Area */}
                            <path 
                              d="M 10,140 C 100,120 150,110 250,85 C 350,70 410,45 490,25 L 490,160 L 10,160 Z" 
                              fill="url(#chartGrad)" 
                            />
                            {/* Line */}
                            <path 
                              d="M 10,140 C 100,120 150,110 250,85 C 350,70 410,45 490,25" 
                              fill="none" 
                              stroke="#14b8a6" 
                              strokeWidth="3.5" 
                              strokeLinecap="round" 
                            />
                            <circle cx="10" cy="140" r="5" fill="#ffffff" stroke="#14b8a6" strokeWidth="3" />
                            <circle cx="120" cy="118" r="5" fill="#ffffff" stroke="#14b8a6" strokeWidth="3" />
                            <circle cx="250" cy="85" r="5" fill="#ffffff" stroke="#14b8a6" strokeWidth="3" />
                            <circle cx="370" cy="58" r="5" fill="#ffffff" stroke="#14b8a6" strokeWidth="3" />
                            <circle cx="490" cy="25" r="5" fill="#ffffff" stroke="#14b8a6" strokeWidth="3" />
                          </>
                        )}
                      </svg>
                      
                      {/* Months labels */}
                      <div className="absolute bottom-0 w-full flex justify-between px-2 text-[10px] font-mono font-bold text-slate-400">
                        <span>Feb</span>
                        <span>Mar</span>
                        <span>Apr</span>
                        <span>May</span>
                        <span>Jun</span>
                        <span>Jul</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Radar Chart Panel */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700/60 shadow-md flex flex-col md:flex-row items-center gap-6">
                  
                  {/* Skill Radar SVG */}
                  <div className="relative h-60 w-60 shrink-0">
                    <svg className="h-full w-full overflow-visible" viewBox="0 0 240 240">
                      {/* Grid polygons */}
                      {[1, 0.75, 0.5, 0.25].map((scale, i) => {
                        const radius = 80 * scale;
                        const points = Array.from({ length: 5 }).map((_, idx) => {
                          const angle = (Math.PI * 2 / 5) * idx - Math.PI / 2;
                          const x = 120 + Math.cos(angle) * radius;
                          const y = 120 + Math.sin(angle) * radius;
                          return `${x},${y}`;
                        }).join(" ");
                        
                        return (
                          <polygon 
                            key={i} 
                            points={points} 
                            fill="transparent" 
                            stroke="#cbd5e1" 
                            strokeDasharray={i === 0 ? "0" : "3"} 
                            className="dark:stroke-slate-700" 
                            strokeWidth="1" 
                          />
                        );
                      })}

                      {/* Axes lines */}
                      {Array.from({ length: 5 }).map((_, idx) => {
                        const angle = (Math.PI * 2 / 5) * idx - Math.PI / 2;
                        const x = 120 + Math.cos(angle) * 80;
                        const y = 120 + Math.sin(angle) * 80;
                        return (
                          <line 
                            key={idx} 
                            x1="120" 
                            y1="120" 
                            x2={x} 
                            y2={y} 
                            stroke="#cbd5e1" 
                            className="dark:stroke-slate-700" 
                            strokeWidth="1" 
                          />
                        );
                      })}

                      {/* Dynamic polyline showing skill points */}
                      <polygon 
                        points={selectedChildId === "child-1" 
                          ? "120,44 171,147 149,161 51,141 68,57" // Leo
                          : "120,88 188,131 202,152 79,149 101,101" // Emily
                        } 
                        fill="rgba(6, 182, 212, 0.15)" 
                        stroke="#06b6d4" 
                        strokeWidth="2.5" 
                      />

                      {/* Axis Labels */}
                      <text x="120" y="25" textAnchor="middle" className="text-[9px] font-bold font-mono fill-slate-500">Computational</text>
                      <text x="215" y="110" textAnchor="start" className="text-[9px] font-bold font-mono fill-slate-500">Creative</text>
                      <text x="180" y="210" textAnchor="middle" className="text-[9px] font-bold font-mono fill-slate-500">Linguistic</text>
                      <text x="60" y="210" textAnchor="middle" className="text-[9px] font-bold font-mono fill-slate-500">Analytical</text>
                      <text x="25" y="110" textAnchor="end" className="text-[9px] font-bold font-mono fill-slate-500">Speed</text>
                    </svg>
                  </div>

                  <div className="space-y-3 flex-1 text-xs text-slate-600 dark:text-slate-300">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Aesthetic Heuristic Aptitude Mapping</h4>
                    <p className="leading-relaxed">
                      Concentric metrics show high cognitive stability. Standard computational logic has seen a boost corresponding directly to active Scratch tutorials.
                    </p>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-slate-400 block font-bold font-mono">Verified Learning Style</span>
                      <p className="font-bold text-slate-800 dark:text-slate-100">{activeInterest.learningStyle}</p>
                    </div>
                  </div>

                </div>

                {/* Dynamic Interests Explorer with Bubble Chart and Tag Cloud */}
                <InterestsExplorer 
                  selectedChildId={selectedChildId} 
                  selectedChildName={activeChild.name} 
                />

              </div>

              {/* Right column: 11 Interests Select Grid & Detailed Pathway Roadmap */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Interest selection grid */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-md space-y-3">
                  <h4 className="font-bold font-display text-sm">Observed Interest Channels</h4>
                  <p className="text-[11px] text-slate-400">Click a subject channel to analyze dynamic Future Pathways.</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2">
                    {[
                      { name: "Artificial Intelligence", pct: selectedChildId === "child-1" ? 92 : 30, icon: Brain },
                      { name: "Programming", pct: selectedChildId === "child-1" ? 95 : 25, icon: Code },
                      { name: "Robotics", pct: selectedChildId === "child-1" ? 88 : 15, icon: Cpu },
                      { name: "Mathematics", pct: selectedChildId === "child-1" ? 85 : 40, icon: BarChart3 },
                      { name: "Science", pct: selectedChildId === "child-1" ? 82 : 30, icon: Atom },
                      { name: "Music", pct: selectedChildId === "child-1" ? 20 : 90, icon: Music },
                      { name: "Art & Design", pct: selectedChildId === "child-1" ? 30 : 84, icon: Compass },
                      { name: "Photography", pct: selectedChildId === "child-1" ? 15 : 60, icon: Camera },
                      { name: "Languages", pct: selectedChildId === "child-1" ? 40 : 88, icon: Globe },
                      { name: "Sports", pct: selectedChildId === "child-1" ? 50 : 70, icon: ChevronRight },
                      { name: "Engineering", pct: selectedChildId === "child-1" ? 80 : 25, icon: Sliders }
                    ].map(interest => {
                      const IconComp = interest.icon;
                      const isSel = activeSubInterest[selectedChildId] === interest.name;
                      return (
                        <button
                          key={interest.name}
                          onClick={() => setActiveSubInterest(prev => ({ ...prev, [selectedChildId]: interest.name }))}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between h-20 transition-all cursor-pointer ${
                            isSel 
                              ? "bg-cyan-500/10 text-cyan-600 border-cyan-400 dark:text-cyan-400" 
                              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex justify-between items-start w-full">
                            <IconComp className="h-4.5 w-4.5" />
                            <span className="font-mono text-[10px] font-black">{interest.pct}%</span>
                          </div>
                          <span className="text-[11px] font-bold block truncate w-full mt-1.5">{interest.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FUTURE BLUEPRINT ROADMAP IN DETAILS */}
                <div className="bg-slate-900 dark:bg-slate-950 text-white p-6 rounded-[2rem] border border-slate-800 shadow-xl space-y-4 relative overflow-hidden">
                  <div className="absolute top-[-20%] left-[-20%] w-[120px] h-[120px] bg-cyan-500/10 rounded-full blur-[40px]"></div>
                  
                  <div className="relative z-10 flex items-center space-x-2.5">
                    <Compass className="h-5 w-5 text-cyan-400" />
                    <h4 className="font-bold text-sm font-display uppercase tracking-wider text-cyan-400">
                      {activeSubInterest[selectedChildId] || "Talent Path"} Blueprint
                    </h4>
                  </div>

                  {/* Detailed pathways dictionary render */}
                  {(() => {
                    const selInt = activeSubInterest[selectedChildId] || (selectedChildId === "child-1" ? "Programming" : "Languages");
                    
                    const blueprints: Record<string, any> = {
                      "Artificial Intelligence": {
                        course: "AI & Machine Learning Foundations for Young Minds",
                        book: "AI for Kids: An Introduction to Neural Networks",
                        comp: "Global AI Junior Science Fair Initiative",
                        club: "Young AI Explorers Hub Sandbox",
                        scholarship: "Next-Gen AI Pioneers Grant ($1,200)",
                        career: "AI Ethics Specialist, Machine Learning Scientist"
                      },
                      "Programming": {
                        course: "Creative Coding with Scratch & Python Basics",
                        book: "Python for Kids: A Playful Introduction to Loops",
                        comp: "Congressional App Challenge (Local Level)",
                        club: "CoderDojo Coding Guild Saturday Workshop",
                        scholarship: "Grace Hopper Kids Fellowship Initiative",
                        career: "Full-Stack Software Engineer, Systems Architect"
                      },
                      "Robotics": {
                        course: "Arduino Robotics: Build Your First Autonomous Car",
                        book: "The LEGO MINDSTORMS EV3 Laboratory Guide",
                        comp: "First Lego League (FLL) State Tournament",
                        club: "Oakridge Robotics Academy Club (Enrolled)",
                        scholarship: "Minds-in-Motion Engineering Grant ($800)",
                        career: "Mechatronics Engineer, Automation Specialist"
                      },
                      "Mathematics": {
                        course: "Advanced Spatial Geometry & Logic Puzzles",
                        book: "The Grapes of Math: Mind-Stretching Riddles",
                        comp: "Bebras Computing & Mathematics Challenge",
                        club: "Math Olympiad Preparation Circle",
                        scholarship: "Gauss Mathematical Youth Scholarship ($1,000)",
                        career: "Cryptographer, Quantitative Systems Analyst"
                      },
                      "Science": {
                        course: "Astrophysics & Cosmic Astronomy Sandbox Lab",
                        book: "Astrophysics for Young People in a Hurry",
                        comp: "NASA Citizen Science Space Exploration Project",
                        club: "Young Naturalists Science Society Study",
                        scholarship: "Stephen Hawking Science Memorial Grant",
                        career: "Astrophysicist, Research Astrobiologist"
                      },
                      "Music": {
                        course: "Introductory Keyboard & Melody Improvisation",
                        book: "The Music Tree: Piano Lessons for Children",
                        comp: "National Youth Composer Initiative",
                        club: "Sunnyvale Youth Choir & Band",
                        scholarship: "Yamaha Young Artist Scholarship ($1,500)",
                        career: "Sound Designer, Film Composer"
                      },
                      "Art & Design": {
                        course: "Vector Character Illustration & UX Wireframing",
                        book: "Steal Like an Artist: 10 Things Unseen",
                        comp: "Scholastic Art & Writing Awards Competition",
                        club: "Digital Sketching & Illustration League",
                        scholarship: "Creative Minds Design Scholarship ($1,000)",
                        career: "UI/UX Designer, Creative Director"
                      },
                      "Photography": {
                        course: "Composition, Shutter Speeds, & Natural Lighting",
                        book: "National Geographic Kids Guide to Shutter Photography",
                        comp: "Sony World Photography Youth Competition",
                        club: "Young Shutterbug Outings Saturday Club",
                        scholarship: "Visual Arts Photography Grant ($500)",
                        career: "Photojournalist, Cinematographer"
                      },
                      "Languages": {
                        course: "Conversational Spanish Level 2 Storytelling",
                        book: "First Spanish Picture Dictionary & Drills",
                        comp: "National Spanish Examinations (NSE)",
                        club: "Polyglot Language Exchange Weekly Class",
                        scholarship: "Global Citizens Language Scholarship ($750)",
                        career: "International Liaison, Diplomat"
                      },
                      "Sports": {
                        course: "Tactical Spatial Awareness in Team Soccer",
                        book: "Soccer IQ: Things That Smart Players Do",
                        comp: "State Junior Olympic Soccer League Tournament",
                        club: "Sunnyvale Community Soccer Academy (Enrolled)",
                        scholarship: "All-Star Youth Athletic Sponsorship",
                        career: "Sports Biomechanist, Athletic Coach"
                      },
                      "Engineering": {
                        course: "Structural Bridges: Physics & Solid Foundations",
                        book: "How Things Work: Encyclopedia of Modern Tech",
                        comp: "NASA Kids Space Habitat Design Challenge",
                        club: "DIY Builders & Tinkering School Workshop",
                        scholarship: "Tinkerers Engineering Grant ($1,100)",
                        career: "Civil Engineer, Aerospace Architect"
                      }
                    };

                    const activeBlue = blueprints[selInt] || blueprints["Programming"];

                    return (
                      <div className="relative z-10 space-y-3 text-xs leading-normal">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-[10px] uppercase font-mono">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Suggested Course</span>
                          </div>
                          <p className="font-bold text-white">{activeBlue.course}</p>
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-[10px] uppercase font-mono">
                            <Book className="h-3.5 w-3.5" />
                            <span>Recommended Book</span>
                          </div>
                          <p className="font-bold text-white">{activeBlue.book}</p>
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-[10px] uppercase font-mono">
                            <Award className="h-3.5 w-3.5" />
                            <span>National Competitions</span>
                          </div>
                          <p className="font-bold text-white">{activeBlue.comp}</p>
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                          <div className="flex items-center space-x-2 text-amber-400 font-bold text-[10px] uppercase font-mono">
                            <Users className="h-3.5 w-3.5" />
                            <span>Community Clubs</span>
                          </div>
                          <p className="font-bold text-white">{activeBlue.club}</p>
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                          <div className="flex items-center space-x-2 text-teal-400 font-bold text-[10px] uppercase font-mono">
                            <GraduationCap className="h-3.5 w-3.5" />
                            <span>Available Scholarships</span>
                          </div>
                          <p className="font-bold text-white">{activeBlue.scholarship}</p>
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-[10px] uppercase font-mono">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span>Observed Career Projections</span>
                          </div>
                          <p className="font-bold text-white">{activeBlue.career}</p>
                        </div>
                      </div>
                    );
                  })()}

                </div>

              </div>

            </div>
          </motion.div>
        )}

        {/* 7. DANGEROUS CONTENT DETECTION CENTER */}
        {activeTab === "danger-center" && (
          <motion.div 
            className="space-y-6 animate-fadeIn"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            
            {/* Header Shield */}
            <motion.div variants={cardVariants} className="bg-gradient-to-tr from-slate-950 via-rose-950 to-slate-950 p-6 rounded-[2rem] border border-rose-950/60 shadow-2xl relative overflow-hidden text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="absolute top-[-20%] right-[-20%] w-[250px] h-[250px] bg-rose-500/10 rounded-full blur-[80px]"></div>
              
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center space-x-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-400 border border-rose-500/30">
                  <ShieldAlert className="h-4 w-4 animate-pulse" />
                  <span>AI Threat Analysis Gateway</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black font-display tracking-tight leading-none">
                  Harmful Content Protection Center
                </h3>
                <p className="text-xs text-slate-300 max-w-xl">
                  Intelligent real-time scanning for adult material, violence, gambling, scam redirects, malware packages, cyberbullying keywords, and social predat Heuristics.
                </p>
              </div>

              <div className="relative z-10 shrink-0">
                <button
                  onClick={() => {
                    setActionFeedback("Initiating deep memory network scan on child device...");
                    setTimeout(() => {
                      // Trigger a new mock threat discovery
                      const newThreat = {
                        id: `de-new-${Date.now()}`,
                        childId: selectedChildId,
                        category: "Suspicious Link" as any,
                        target: "unknown-socket-connect.xyz/direct-redirect",
                        riskLevel: "medium" as any,
                        confidence: 89,
                        reason: "Outbound socket bypass scan flagged unindexed hosting space querying user location metadata.",
                        actionTaken: "Blocked TCP connection instantly.",
                        suggestedAction: "Run deep system cleanup. Double check active companion DNS profile.",
                        timestamp: new Date().toISOString(),
                        status: "blocked"
                      };
                      setDangerousEvents(prev => [newThreat, ...prev]);
                      setActionFeedback("AI Deep Scan finished. Monitored 1 new suspicious redirect.");
                    }, 1500);
                  }}
                  className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center space-x-2 transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" />
                  <span>Run Live AI Network Scan</span>
                </button>
              </div>
            </motion.div>

            {/* Quick telemetry counter */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Total Scanned</span>
                  <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">14,840</p>
                </div>
                <Globe className="h-5 w-5 text-cyan-400" />
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Total Neutralized</span>
                  <p className="text-lg font-black text-rose-500 mt-0.5">
                    {dangerousEvents.filter(e => e.childId === selectedChildId).length}
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-rose-500" />
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Critical / High Alerts</span>
                  <p className="text-lg font-black text-rose-500 mt-0.5">
                    {dangerousEvents.filter(e => e.childId === selectedChildId && (e.riskLevel === "critical" || e.riskLevel === "high")).length}
                  </p>
                </div>
                <AlertOctagon className="h-5 w-5 text-rose-500 animate-pulse" />
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Scan Status</span>
                  <p className="text-lg font-black text-emerald-500 mt-0.5">Protected</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>

            {/* Main Events list */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Flagged Outbound Network Attempts</h4>
                <p className="text-xs text-slate-400 font-mono">Filtered for: {activeChild.name}</p>
              </div>

              <div className="space-y-3">
                {dangerousEvents.filter(e => e.childId === selectedChildId).map(event => (
                  <div 
                    key={event.id} 
                    className={`bg-white dark:bg-slate-800 p-5 rounded-3xl border transition-all relative overflow-hidden flex flex-col md:flex-row gap-5 justify-between items-start md:items-center ${
                      event.riskLevel === "critical" ? "border-rose-500/30 bg-rose-500/[0.01]" :
                      event.riskLevel === "high" ? "border-orange-500/20" : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Glowing threat indicator */}
                    {event.riskLevel === "critical" && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
                    )}
                    {event.riskLevel === "high" && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
                    )}

                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap gap-2 items-center text-xs">
                        {/* Risk Level Badge */}
                        <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wider font-mono ${
                          event.riskLevel === "critical" ? "bg-rose-500/10 text-rose-500 animate-pulse border border-rose-500/30" :
                          event.riskLevel === "high" ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" :
                          event.riskLevel === "medium" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                          "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}>
                          {event.riskLevel} Risk
                        </span>

                        {/* Category Badge */}
                        <span className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-semibold px-2.5 py-0.5 rounded-full text-[10px]">
                          Category: {event.category}
                        </span>

                        {/* AI Confidence */}
                        <span className="text-slate-400 font-mono text-[10px]">
                          🛡️ {event.confidence}% AI Confidence score
                        </span>

                        {/* Timestamp */}
                        <span className="text-slate-400 text-[10px] font-mono ml-auto">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5 text-slate-900 dark:text-white font-bold font-display text-sm break-all">
                          <Globe className="h-4 w-4 text-slate-400 shrink-0" />
                          <span>{event.target}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                          <strong>Scan Log Reason:</strong> {event.reason}
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed font-sans font-medium">
                          <strong>Automatic Action Taken:</strong> {event.actionTaken}
                        </p>
                      </div>

                      {/* Suggested actions tag */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs space-y-1 border border-slate-200/50 dark:border-slate-800/80">
                        <span className="text-[10px] uppercase font-mono font-black text-indigo-400 block tracking-widest">Recommended Parenting Action</span>
                        <p className="text-slate-600 dark:text-slate-300">{event.suggestedAction}</p>
                      </div>
                    </div>

                    {/* Operational buttons */}
                    <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          // Real save to timeline!
                          const newLog: ActivityLog = {
                            id: `log-threat-${Date.now()}`,
                            childId: event.childId,
                            type: "safety",
                            title: `AI Flagged: ${event.category}`,
                            description: `Blocked packet attempt to ${event.target}. Resolved and flagged in permanent activity log history.`,
                            timestamp: new Date().toISOString(),
                            safetyLevel: event.riskLevel === "critical" ? "severe" : "warning"
                          };
                          setLogs(prev => [newLog, ...prev]);
                          setActionFeedback(`Event successfully logged to ${activeChild.name}'s active history timeline.`);
                        }}
                        className="flex-1 md:w-44 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer border border-slate-700/50"
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>Log to Timeline</span>
                      </button>

                      <button
                        onClick={() => {
                          // Mock target domain block
                          setActionFeedback(`Domain "${event.target.split("/")[0]}" locked securely on hardware gateway.`);
                        }}
                        className="flex-1 md:w-44 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer border border-rose-500/20"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Strict Domain Block</span>
                      </button>

                      <button
                        onClick={() => {
                          // Remove or dismiss event
                          setDangerousEvents(prev => prev.filter(e => e.id !== event.id));
                          setActionFeedback(`Threat review completed. Cleared alert.`);
                        }}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl cursor-pointer"
                        title="Dismiss Threat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {dangerousEvents.filter(e => e.childId === selectedChildId).length === 0 && (
                  <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-[2rem] border text-slate-400 text-xs">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-slate-800 dark:text-white">Clean Threat Telemetry</p>
                    <p className="mt-1">All scanned DNS traffic inside standard guidelines. No threats logged.</p>
                  </div>
                )}
              </div>
            </div>

          </motion.div>
        )}


        {/* 8. APP & WEBSITE CONTROL SETTINGS */}
        {activeTab === "controls" && (
          <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <h3 className="font-bold text-base font-display">Configure App Limits & Filters</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Screen limits & Study Mode toggle */}
              <motion.div variants={cardVariants} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border space-y-6 text-xs">
                <h4 className="font-bold font-display text-sm">Active Restrictions Settings</h4>
                
                {/* Limit Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center font-semibold">
                    <span>Target Daily Limit:</span>
                    <span className="text-cyan-500 font-mono font-bold text-sm">{activeChild.screenTimeLimit} Mins</span>
                  </div>
                  <input 
                    type="range" 
                    min="30" 
                    max="180" 
                    step="15" 
                    value={activeChild.screenTimeLimit}
                    onChange={(e) => handleLimitChange(activeChild.id, parseInt(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>

                {/* Study Focus hours toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 dark:text-white">📚 Focus & Study Mode</span>
                    <p className="text-[10px] text-slate-500">Blocks non-educational games during school hours.</p>
                  </div>
                  <button
                    onClick={() => setStudyMode(prev => ({ ...prev, [activeChild.id]: !prev[activeChild.id] }))}
                    className={`px-3 py-1.5 font-bold rounded-lg ${
                      studyMode[activeChild.id] ? "bg-cyan-500 text-slate-950" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                    }`}
                  >
                    {studyMode[activeChild.id] ? "Active" : "Disabled"}
                  </button>
                </div>

                {/* Safe browsing toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 dark:text-white">🌐 Safe Search Enforce</span>
                    <p className="text-[10px] text-slate-500">Forces YouTube Kids and Google SafeSearch restrictions.</p>
                  </div>
                  <button
                    onClick={() => setSafeSearch(prev => ({ ...prev, [activeChild.id]: !prev[activeChild.id] }))}
                    className={`px-3 py-1.5 font-bold rounded-lg ${
                      safeSearch[activeChild.id] ? "bg-cyan-500 text-slate-950" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                    }`}
                  >
                    {safeSearch[activeChild.id] ? "Active" : "Disabled"}
                  </button>
                </div>

              </motion.div>

              {/* Right Column: Custom Web Whitelist / Blacklist simulator */}
              <motion.div variants={cardVariants} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border space-y-4 text-xs">
                <h4 className="font-bold font-display text-sm">Blocked Website Categories</h4>
                
                <div className="space-y-2.5">
                  {[
                    "Adult & Explicit Content",
                    "Violence & Hate Speech",
                    "Gambling & Lottery",
                    "Unverified Torrent & P2P",
                    "Robux & Gaming Scams",
                    "Phishing & Malware Links"
                  ].map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <span className="font-semibold text-slate-800 dark:text-white">{category}</span>
                      <span className="text-[10px] bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded font-bold font-mono">ENFORCED BLOCK</span>
                    </div>
                  ))}
                </div>

              </motion.div>

            </div>
          </motion.div>
        )}

        {/* 9. SECURE CONVERSATIONAL FAMILY AI ASSISTANT CHAT PANEL */}
        {activeTab === "assistant" && (
          <motion.div 
            className="space-y-4 flex flex-col h-[calc(100vh-140px)]"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base font-display flex items-center space-x-1.5">
                  <Brain className="h-5 w-5 text-cyan-500 shrink-0" />
                  <span>Guardian Family Assistant</span>
                </h3>
                <p className="text-xs text-slate-500">Ask customized diagnostics. AI analyzes {activeChild.name}'s active history secure inside cloud.</p>
              </div>

              <span className="inline-flex items-center rounded-full bg-cyan-100 dark:bg-cyan-950/40 px-2.5 py-0.5 text-xs font-semibold text-cyan-800 dark:text-cyan-400">
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Powered by Gemini
              </span>
            </div>

            {/* AI Settings Panel */}
            <motion.div variants={cardVariants} className="bg-slate-100 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Model Selector */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Cognitive Intelligence Model</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", speed: "Deep strategy, planning", color: "border-indigo-500/30 hover:bg-indigo-500/5" },
                      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", speed: "Balanced expert", color: "border-cyan-500/30 hover:bg-cyan-500/5" },
                      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", speed: "Instant, rapid replies", color: "border-emerald-500/30 hover:bg-emerald-500/5" }
                    ].map(model => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setSelectedModel(model.id as any)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer flex flex-col items-start ${
                          selectedModel === model.id
                            ? "bg-slate-900 text-white border-slate-900 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-500 shadow-md shadow-cyan-500/15"
                            : `bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 ${model.color}`
                        }`}
                      >
                        <span>{model.label}</span>
                        <span className="text-[8px] font-normal opacity-75">{model.speed}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grounding Controls */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Grounding Sources & Telemetry Sync</span>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={enableSearch}
                        onChange={(e) => setEnableSearch(e.target.checked)}
                        className="rounded text-cyan-500 focus:ring-cyan-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="flex items-center"><Globe className="h-3.5 w-3.5 mr-1 text-cyan-500" /> Web Search</span>
                    </label>
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={enableMaps}
                        onChange={(e) => setEnableMaps(e.target.checked)}
                        className="rounded text-cyan-500 focus:ring-cyan-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="flex items-center"><Map className="h-3.5 w-3.5 mr-1 text-cyan-500" /> Google Maps</span>
                    </label>
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={enableMemory}
                        onChange={(e) => setEnableMemory(e.target.checked)}
                        className="rounded text-cyan-500 focus:ring-cyan-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="flex items-center"><Brain className="h-3.5 w-3.5 mr-1 text-cyan-500" /> Conversation Memory</span>
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
 
            {/* Conversational Window */}
            <motion.div variants={cardVariants} className="flex-1 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between overflow-hidden">
              
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {(() => {
                  const seen = new Set();
                  const uniqueMsgs = (chatHistory[selectedChildId] || []).filter(msg => {
                    if (seen.has(msg.id)) return false;
                    seen.add(msg.id);
                    return true;
                  });
                  return uniqueMsgs.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`flex items-start gap-3 text-xs max-w-2xl ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === "user" ? "bg-slate-200 text-slate-800" : "bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white"
                      }`}>
                        {msg.role === "user" ? "P" : "AI"}
                      </div>
                      
                      <div className={`p-3.5 rounded-2xl border ${
                        msg.role === "user" 
                          ? "bg-slate-900 text-white border-slate-950 dark:bg-slate-800" 
                          : "bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800 leading-relaxed space-y-2"
                      }`}>
                        {/* Text content rendered with normal formatting */}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
 
                        {/* Grounding references citation */}
                        {msg.groundingMetadata?.groundingChunks && msg.groundingMetadata.groundingChunks.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1.5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-cyan-500 font-mono flex items-center">
                              <Globe className="h-3 w-3 mr-1 text-cyan-500" /> Grounded References & Citations:
                            </span>
                            <div className="flex flex-col gap-1.5">
                              {msg.groundingMetadata.groundingChunks.map((chunk: any, idx: number) => {
                                const title = chunk.web?.title || chunk.maps?.title || "Grounded Resource Link";
                                const url = chunk.web?.uri || chunk.maps?.uri;
                                if (!url) return null;
                                return (
                                  <a 
                                    key={idx} 
                                    href={url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="inline-flex items-center text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline font-mono"
                                  >
                                    <ExternalLink className="h-2.5 w-2.5 mr-1 shrink-0" />
                                    {title}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
 
                        <span className="text-[9px] text-slate-400 block text-right mt-1 font-mono leading-none">{msg.timestamp}</span>
                      </div>
                    </div>
                  ));
                })()}
                
                {/* Chat Loading indicator */}
                {chatLoading && (
                  <div className="flex items-start gap-3 text-xs animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white flex items-center justify-center animate-spin">
                      AI
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border flex items-center space-x-1.5 text-slate-400 font-medium">
                      <span className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce"></span>
                      <span className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.2s]"></span>
                      <span className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]"></span>
                      <span className="font-mono text-[10px]">GEMINI SYNTHESIZING RECOMMENDATION...</span>
                    </div>
                  </div>
                )}

                {/* Error & Retry banner */}
                {assistantError && (
                  <div className="flex items-start gap-3 text-xs">
                    <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="p-3.5 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/40 text-slate-800 dark:text-slate-100 flex-1 space-y-2">
                      <p className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> {assistantError.text}
                      </p>
                      <button
                        onClick={() => handleAssistantSubmit(assistantError.lastMessage)}
                        className="bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900 text-red-800 dark:text-red-200 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center inline-flex"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Retry Last Question
                      </button>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Suggestions Quick Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-[10px] text-slate-400 font-mono">Suggested diagnostic questions:</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    disabled={chatLoading}
                    onClick={() => handleAssistantSubmit("What did my child learn this week?")}
                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50 dark:disabled:hover:bg-slate-900"
                  >
                    "What did my child learn this week?"
                  </button>
                  <button
                    disabled={chatLoading}
                    onClick={() => handleAssistantSubmit("Why did screen time increase?")}
                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50 dark:disabled:hover:bg-slate-900"
                  >
                    "Why did screen time increase?"
                  </button>
                  <button
                    disabled={chatLoading}
                    onClick={() => handleAssistantSubmit("Which apps are helping with education?")}
                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50 dark:disabled:hover:bg-slate-900"
                  >
                    "Which apps are helping with education?"
                  </button>
                  <button
                    disabled={chatLoading}
                    onClick={() => handleAssistantSubmit("What interests is my child developing?")}
                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50 dark:disabled:hover:bg-slate-900"
                  >
                    "What interests is my child developing?"
                  </button>
                </div>

                {/* Input block */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    required
                    disabled={chatLoading}
                    placeholder={`Ask AI details regarding ${activeChild.name}'s digital activities...`}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAssistantSubmit();
                      }
                    }}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={() => handleAssistantSubmit()}
                    disabled={chatLoading}
                    className="bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 p-2.5 rounded-xl hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}

        {/* 10. SETTINGS & PLATFORM SETUP */}
        {activeTab === "settings" && (
          <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <h3 className="font-bold text-base font-display">Guardian Shield Configuration</h3>

            <motion.div variants={cardVariants} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border space-y-4 text-xs max-w-2xl">
              <h4 className="font-bold text-sm">Parent Admin Profile</h4>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold font-mono uppercase">Primary Administrator Name</label>
                    <input type="text" disabled value="Elijah Stephen" className="w-full bg-slate-50 dark:bg-slate-900 p-2 rounded border cursor-not-allowed" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold font-mono uppercase">Email Address</label>
                    <input type="text" disabled value="elijahstephenpaul03@gmail.com" className="w-full bg-slate-50 dark:bg-slate-900 p-2 rounded border cursor-not-allowed" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold font-mono uppercase">Guardian Device Sync Code</label>
                  <p className="bg-slate-950 text-cyan-400 p-3 rounded font-mono font-bold tracking-widest text-center text-sm border">
                    GRD-842-SHLD
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">Download the Guardian AI Companion app on the child tablet and scan or enter this code to bind sync limits.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                <span className="inline-flex items-center rounded-full bg-cyan-100 dark:bg-cyan-950/40 px-3 py-1 text-xs font-bold text-cyan-800 dark:text-cyan-300">
                  <ShieldCheck className="mr-1 h-4 w-4" /> SECURED END-TO-END VIA SHIELD CRYPTOGRAPHY
                </span>
              </div>
            </motion.div>


          </motion.div>
        )}

      </main>

    </div>
  );
}
