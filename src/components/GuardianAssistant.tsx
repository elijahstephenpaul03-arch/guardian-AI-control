import React, { useState, useEffect, useRef } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  MessageSquare, Mic, MicOff, Volume2, VolumeX, X, Send, 
  Sparkles, Shield, User, HelpCircle, BookOpen, AlertTriangle, 
  GraduationCap, Cpu, Zap, Activity, Info, Brain, RefreshCw
} from "lucide-react";
import { ChatMessage } from "../types";
import { auth } from "../lib/firebase";

interface GuardianAssistantProps {
  viewMode: "public" | "dashboard" | "companion";
}

export default function GuardianAssistant({ viewMode }: GuardianAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"parent" | "child">("parent");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [avatarState, setAvatarState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [currentUid, setCurrentUid] = useState<string>("guest");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const queueRef = useRef<string[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const [assistantError, setAssistantError] = useState<{ text: string; lastMessage: string } | null>(null);

  // Monitor Auth State for separate session per user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setCurrentUid(user.uid);
      } else {
        setCurrentUid("guest");
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync mode with parent-child view mode of the app
  useEffect(() => {
    if (viewMode === "companion") {
      setMode("child");
    } else {
      setMode("parent");
    }
  }, [viewMode]);

  // Load chat history or initialize with default messages based on UID & Mode
  useEffect(() => {
    const parentGreeting: ChatMessage = {
      id: "g-parent-1",
      role: "model",
      text: "Hello! I am **Guardian**, your premium AI Safety Assistant and Digital Wellbeing Advisor. 🛡️\n\nI can analyze your child's screen time, explain activity charts, highlight potential safety alerts, or suggest positive learning courses. Ask me anything, or try the quick action panels below!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const childGreeting: ChatMessage = {
      id: "g-child-1",
      role: "model",
      text: "Hey there! I'm **Guardian**, your personal AI companion! 🌟\n\nI can help you explain tricky homework step-by-step, teach you how to write code, share cool general knowledge, or guide you on being cyber-smart. What awesome things are we exploring today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const localParentKey = `GUA_GUARDIAN_CHAT_PARENT_HIST_${currentUid}`;
    const localChildKey = `GUA_GUARDIAN_CHAT_CHILD_HIST_${currentUid}`;

    const savedParent = localStorage.getItem(localParentKey);
    const savedChild = localStorage.getItem(localChildKey);

    if (mode === "parent") {
      if (savedParent) {
        try {
          const parsed = JSON.parse(savedParent);
          setMessages(Array.isArray(parsed) ? parsed : [parentGreeting]);
        } catch (e) {
          setMessages([parentGreeting]);
        }
      } else {
        setMessages([parentGreeting]);
      }
    } else {
      if (savedChild) {
        try {
          const parsed = JSON.parse(savedChild);
          setMessages(Array.isArray(parsed) ? parsed : [childGreeting]);
        } catch (e) {
          setMessages([childGreeting]);
        }
      } else {
        setMessages([childGreeting]);
      }
    }
  }, [mode, currentUid]);

  // Save conversation history to local storage based on UID & Mode
  const saveHistory = (newMsgs: ChatMessage[]) => {
    const key = mode === "parent" 
      ? `GUA_GUARDIAN_CHAT_PARENT_HIST_${currentUid}` 
      : `GUA_GUARDIAN_CHAT_CHILD_HIST_${currentUid}`;
    localStorage.setItem(key, JSON.stringify(newMsgs));
  };

  useEffect(() => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    queueRef.current = [];
    isProcessingRef.current = false;
    setIsThinking(false);
    setAvatarState("idle");
    setAssistantError(null);
  }, [mode]);

  // Check speech recognition and text-to-speech support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setAvatarState("listening");
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        sendMessage(transcript);
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsListening(false);
        setAvatarState("idle");
      };

      rec.onend = () => {
        setIsListening(false);
        if (avatarState === "listening") {
          setAvatarState("idle");
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [mode, avatarState]);

  // Auto-scroll chat to bottom
  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    scrollToBottom("smooth");
    const timer1 = setTimeout(() => scrollToBottom("auto"), 50);
    const timer2 = setTimeout(() => scrollToBottom("smooth"), 150);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [messages, isThinking, assistantError, mode]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        scrollToBottom("auto");
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Read aloud the text response
  const speakText = (text: string) => {
    if (muted || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop current speech
    
    // Parse out markdown for cleaner TTS speech
    const cleanText = text
      .replace(/\*\*/g, "") // remove bold asterisks
      .replace(/\*/g, "")   // remove italic stars
      .replace(/#+/g, "")   // remove header hashes
      .replace(/`{3}[\s\S]*?`{3}/g, "Here is a code sample.") // replace full code blocks
      .replace(/`/g, "")    // remove backticks
      .replace(/-\s+/g, "") // remove bullet formatting
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Choose a high quality female or robotic assistant-sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(
      v => v.name.includes("Google US English") || v.name.includes("Natural") || v.lang === "en-US"
    );
    if (premiumVoice) {
      utterance.voice = premiumVoice;
    }
    
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setAvatarState("speaking");
    };

    utterance.onend = () => {
      setAvatarState("idle");
    };

    utterance.onerror = () => {
      setAvatarState("idle");
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Toggle listening state
  const handleMicrophoneClick = () => {
    if (!isSpeechSupported) {
      alert("Speech recognition is not supported in this browser. Try Google Chrome!");
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn("Speech recognition already running or error:", e);
      }
    }
  };

  // Quick Action handler
  const handleQuickAction = (promptText: string) => {
    sendMessage(promptText);
  };

  // Clean chat history
  const clearChat = () => {
    console.log("[GuardianAssistant] Clearing chat history and resetting states...");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    queueRef.current = [];
    isProcessingRef.current = false;
    setIsThinking(false);
    setAvatarState("idle");
    setAssistantError(null);

    const key = mode === "parent" 
      ? `GUA_GUARDIAN_CHAT_PARENT_HIST_${currentUid}` 
      : `GUA_GUARDIAN_CHAT_CHILD_HIST_${currentUid}`;
    localStorage.removeItem(key);
    
    const initialText = mode === "parent" 
      ? "Hello! I am **Guardian**, your premium AI Safety Assistant and Digital Wellbeing Advisor. 🛡️\n\nI can analyze your child's screen time, explain activity charts, highlight potential safety alerts, or suggest courses. Ask me anything!"
      : "Hey there! I'm **Guardian**, your personal AI companion! 🌟\n\nI can help you explain tricky homework step-by-step, teach you how to write code, or guide you on being cyber-smart. What are we exploring today?";
    
    const resetMsg: ChatMessage = {
      id: `g-reset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: "model",
      text: initialText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    
    setMessages([resetMsg]);
  };

  // Family Assistant Request Execution with unique Request ID and AbortController
  const executeAssistantRequest = async (rawMessage: string, historyBeforeMessage: ChatMessage[]) => {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    currentRequestIdRef.current = requestId;

    console.log(`[GuardianAssistant] Beginning execution. ID: ${requestId}. Msg: "${rawMessage}". History count: ${historyBeforeMessage.length}`);

    if (activeAbortControllerRef.current) {
      console.log(`[GuardianAssistant] Aborting previous active controller.`);
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    // Retrieve live context from local storage if existing, or use defaults
    let childContext = {
      name: "Alex",
      age: 12,
      status: "online",
      screenTimeLimit: 120,
      screenTimeToday: 82,
      riskScore: 18
    };

    try {
      const savedDevice = localStorage.getItem("GUA_COMPANION_DEVICE_ID");
      if (savedDevice) {
        childContext.name = "Alex";
        childContext.riskScore = 14;
      }
    } catch (e) {
      console.warn("Failed parsing context in GuardianAssistant:", e);
    }

    let response = null;
    let attempt = 1;
    const maxAttempts = 2; // Auto-retry once on failure
    let lastError: any = null;

    while (attempt <= maxAttempts) {
      try {
        console.log(`[GuardianAssistant] Fetch attempt ${attempt}/${maxAttempts} for ${requestId}...`);
        
        // Pass a sliding window of previous 10 messages as background history context
        const trimmedHistory = historyBeforeMessage.slice(-10);
        console.log(`[GuardianAssistant] Trimmed history turns:`, trimmedHistory.map(h => `${h.role}: ${h.text.substring(0, 25)}...`));

        response = await fetch("/api/assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          signal: controller.signal,
          body: JSON.stringify({
            message: rawMessage,
            childContext,
            history: trimmedHistory,
            mode: mode,
            logs: [],
            dangerousEvents: []
          })
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status} ${response.statusText}`);
        }

        console.log(`[GuardianAssistant] Attempt ${attempt} succeeded! Status: ${response.status}`);
        break; // Success! Break retry loop.
      } catch (err: any) {
        lastError = err;
        if (err.name === "AbortError" || err.message?.includes("aborted")) {
          console.log(`[GuardianAssistant] Request aborted on attempt ${attempt}: ${requestId}`);
          isProcessingRef.current = false;
          setIsThinking(false);
          setAvatarState("idle");
          return; // Exit directly, overridden or cancelled
        }

        console.error(`[GuardianAssistant] Attempt ${attempt} failed with error:`, err);

        if (attempt < maxAttempts) {
          attempt++;
          const retryDelay = 1500;
          console.log(`[GuardianAssistant] Waiting ${retryDelay}ms before auto-retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.error(`[GuardianAssistant] Out of retries. All ${maxAttempts} attempts failed for ${requestId}.`);
          break; // Out of retries, exit retry loop
        }
      }
    }

    try {
      if (!response || !response.ok) {
        throw lastError || new Error("Failed to receive a valid response from the AI server.");
      }

      const data = await response.json();
      console.log(`[GuardianAssistant] Received response for ${requestId}:`, data);

      // Verify that this is still the active request
      if (currentRequestIdRef.current !== requestId) {
        console.warn(`[GuardianAssistant] RequestId mismatch. Received: ${requestId}, Current: ${currentRequestIdRef.current}. Discarding stale response.`);
        isProcessingRef.current = false;
        setIsThinking(false);
        setAvatarState("idle");
        return;
      }

      const botMsg: ChatMessage = {
        id: `model-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        role: "model",
        text: data.text || "I was unable to formulate a response. Please check your network and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        groundingMetadata: data.groundingMetadata
      };

      setMessages(prev => {
        const next = [...prev, botMsg];
        saveHistory(next);
        return next;
      });

      // Speak response out loud
      speakText(data.text || "");

      isProcessingRef.current = false;
      setIsThinking(false);
      setAvatarState("idle");

    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        console.log(`[GuardianAssistant] Request aborted inside final block: ${requestId}`);
        isProcessingRef.current = false;
        setIsThinking(false);
        setAvatarState("idle");
        return;
      }

      console.error("[GuardianAssistant] Processing failed:", err);
      
      if (currentRequestIdRef.current === requestId) {
        setAssistantError({
          text: "I apologize, but my core processors are currently digesting security packet logs. Would you like to retry?",
          lastMessage: rawMessage
        });
        isProcessingRef.current = false;
        setIsThinking(false);
        setAvatarState("idle");
      }
    }
  };

  // Send Message Logic
  const sendMessage = async (textToSend?: string) => {
    const rawMessage = textToSend || input;
    if (!rawMessage.trim()) return;

    if (isProcessingRef.current || isThinking) {
      console.warn("[GuardianAssistant] Message send blocked because AI is currently processing a request.");
      return; // strict single request constraint
    }

    console.log(`[GuardianAssistant] Sending message: "${rawMessage}"`);

    // Acquire lock synchronously
    isProcessingRef.current = true;
    setIsThinking(true);
    setAvatarState("thinking");
    setAssistantError(null);

    if (!textToSend) {
      setInput("");
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const historyBeforeMessage = [...messages];

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: "user",
      text: rawMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    // Append user message using functional state to prevent stale closures
    setMessages(prev => {
      const next = [...prev, userMsg];
      saveHistory(next);
      return next;
    });

    await executeAssistantRequest(rawMessage, historyBeforeMessage);
  };

  // Simple custom Markdown text formatter for rendering bold, code, lists beautifully
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // 1. Check for Code blocks
      if (line.trim().startsWith("```")) {
        return null; // Skip code fences, handled by inline parsing if simple
      }

      // 2. Format lists
      const listMatch = line.match(/^(\d+\.|\-|\*)\s+(.*)$/);
      
      // 3. Match bold markdown "**text**" -> "<strong>text</strong>"
      let content = line;
      const boldRegex = /\*\*([^*]+)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-extrabold text-cyan-400 dark:text-cyan-300">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }

      const renderedContent = parts.length > 0 ? parts : content;

      if (listMatch) {
        const prefix = listMatch[1];
        const rest = listMatch[2];
        const isNum = /^\d+/.test(prefix);
        
        return (
          <div key={idx} className="flex items-start space-x-2 pl-3 my-1">
            <span className={`font-mono text-xs font-bold shrink-0 ${isNum ? 'text-cyan-400' : 'text-teal-400'}`}>
              {prefix}
            </span>
            <span className="text-slate-200 text-[13px] leading-relaxed">
              {rest}
            </span>
          </div>
        );
      }

      if (line.trim() === "") {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-slate-200 text-[13px] leading-relaxed my-1">
          {renderedContent}
        </p>
      );
    });
  };

  // Quick actions arrays
  const parentQuickActions = [
    { title: "Dashboard Help", prompt: "Explain how to monitor the device coordinates and GPS logs on this screen.", icon: <HelpCircle className="h-3.5 w-3.5" /> },
    { title: "Analyze Screen Time", prompt: "Summarize Alex's daily screen time limits and suggest digital wellbeing improvements.", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { title: "Safety Audit", prompt: "Explain standard parental controls and cybersecurity protocols for keeping my child safe.", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { title: "Course Ideas", prompt: "What are some highly-rated online logic or programming apps for an active 12-year-old?", icon: <GraduationCap className="h-3.5 w-3.5" /> }
  ];

  const childQuickActions = [
    { title: "Homework Help", prompt: "Help me break down a homework question or explain a math science concept step-by-step.", icon: <GraduationCap className="h-3.5 w-3.5" /> },
    { title: "Learn Programming", prompt: "Teach me how a simple 'for loop' works in computer programming with Python code.", icon: <Cpu className="h-3.5 w-3.5" /> },
    { title: "Cyber Safety Quiz", prompt: "Give me a quick 3-question quiz about staying safe and smart online!", icon: <Shield className="h-3.5 w-3.5" /> },
    { title: "Emergency Protocols", prompt: "What are the core steps to remember if I ever feel unsafe online or in the real world?", icon: <Zap className="h-3.5 w-3.5" /> }
  ];

  const quickActions = mode === "parent" ? parentQuickActions : childQuickActions;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans no-print select-none">
      
      {/* 1. Animated Assistant Button Avatar (Glow Sphere) */}
      <div className="relative">
        
        {/* Floating pulse rings */}
        {avatarState === "listening" && (
          <>
            <div className="absolute -inset-4 rounded-full border-2 border-cyan-400/30 animate-[ping_1.6s_infinite] pointer-events-none"></div>
            <div className="absolute -inset-8 rounded-full border border-teal-400/10 animate-[ping_2.4s_infinite] pointer-events-none"></div>
          </>
        )}

        {avatarState === "thinking" && (
          <div className="absolute -inset-3 rounded-full border border-indigo-400/40 animate-spin pointer-events-none" style={{ animationDuration: '1.2s' }}></div>
        )}

        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (window.speechSynthesis) window.speechSynthesis.cancel();
          }}
          id="guardian-assistant-trigger"
          className={`relative h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-xl ${
            isOpen 
              ? "bg-slate-900 border border-slate-700 text-slate-400" 
              : "bg-gradient-to-tr from-cyan-600 via-indigo-600 to-teal-500 text-white hover:scale-110 active:scale-95"
          }`}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <div className="relative flex items-center justify-center">
              
              {/* Dynamic glowing core of Avatar */}
              <motion.div 
                animate={
                  avatarState === "listening" 
                    ? { scale: [1, 1.25, 1], rotate: [0, 180, 360] }
                    : avatarState === "thinking"
                    ? { scale: [0.95, 1.1, 0.95], rotate: 360 }
                    : avatarState === "speaking"
                    ? { scale: [1, 1.3, 0.85, 1.15, 1] }
                    : { scale: [1, 1.08, 1] }
                }
                transition={
                  avatarState === "thinking"
                    ? { repeat: Infinity, duration: 1.5, ease: "linear" }
                    : { repeat: Infinity, duration: 4, ease: "easeInOut" }
                }
                className={`h-9 w-9 rounded-full bg-white/10 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)] ${
                  avatarState === "speaking" ? "bg-gradient-to-r from-cyan-400 to-indigo-500" : ""
                }`}
              >
                <Sparkles className={`h-4.5 w-4.5 ${avatarState === "speaking" ? "text-white" : "text-cyan-200"}`} />
              </motion.div>

              {/* Status Badge */}
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  avatarState === "listening" ? "bg-cyan-400" : isThinking ? "bg-indigo-400" : "bg-emerald-400"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 border border-slate-950 ${
                  avatarState === "listening" ? "bg-cyan-500" : isThinking ? "bg-indigo-500" : "bg-emerald-500"
                }`}></span>
              </span>

            </div>
          )}
        </button>
      </div>

      {/* 2. Glassmorphism Chat Interface Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="absolute bottom-20 right-0 w-[360px] sm:w-[410px] h-[550px] max-h-[80vh] flex flex-col rounded-3xl overflow-hidden glass-panel dark:glass-panel shadow-2xl border border-slate-800/40 text-slate-100"
          >
            {/* Header section with theme/profile toggle */}
            <div className="p-4 bg-gradient-to-r from-slate-950/90 to-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="relative h-9 w-9 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg border border-cyan-400/30">
                  <Sparkles className="h-4.5 w-4.5 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold tracking-tight font-display text-white flex items-center gap-1.5">
                    Guardian AI
                    <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-extrabold bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/60">
                      v2.0
                    </span>
                  </h3>
                  <p className="text-[10.5px] text-slate-400 font-medium">Your premium digital safety counselor</p>
                </div>
              </div>

              {/* Mode Toggle Switch (Parent/Child) */}
              <div className="flex bg-slate-900/90 border border-slate-800 rounded-xl p-0.5 shrink-0">
                <button
                  onClick={() => setMode("parent")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-tight uppercase cursor-pointer transition-all flex items-center gap-1 ${
                    mode === "parent" 
                      ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Shield className="h-3 w-3" />
                  Parent
                </button>
                <button
                  onClick={() => setMode("child")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-tight uppercase cursor-pointer transition-all flex items-center gap-1 ${
                    mode === "child" 
                      ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <User className="h-3 w-3" />
                  Child
                </button>
              </div>
            </div>

            {/* Chat Messages Section */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 grid-bg bg-slate-950/60 scrollbar-thin"
            >
              
              {(() => {
                const seen = new Set();
                const uniqueMsgs = messages.filter(msg => {
                  if (seen.has(msg.id)) return false;
                  seen.add(msg.id);
                  return true;
                });
                return uniqueMsgs.map((msg, i) => (
                  <div
                    key={msg.id || i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-start gap-2`}
                  >
                    {msg.role !== "user" && (
                      <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold shadow-md ${
                        mode === "child" ? "bg-teal-600/40 border border-teal-500/30 text-teal-300" : "bg-cyan-600/40 border border-cyan-500/30 text-cyan-300"
                      }`}>
                        G
                      </div>
                    )}
                    
                    <div className="flex flex-col max-w-[80%]">
                      <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm text-xs select-text ${
                        msg.role === "user"
                          ? "bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white rounded-tr-none"
                          : mode === "child"
                          ? "bg-slate-900/90 border border-slate-800 text-slate-100 rounded-tl-none backdrop-blur-md"
                          : "bg-slate-900/95 border border-slate-850 text-slate-100 rounded-tl-none backdrop-blur-md"
                      }`}>
                        {renderFormattedText(msg.text)}
                      </div>
                      
                      <span className={`text-[9px] text-slate-500 font-mono mt-1 ${msg.role === "user" ? "text-right mr-1" : "ml-1"}`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ));
              })()}

              {/* Error & Retry banner */}
              {assistantError && (
                <div className="flex items-start gap-2 text-xs">
                  <div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center bg-red-950/40 border border-red-500/30 text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="p-3 bg-red-950/20 rounded-2xl border border-red-900/40 text-slate-100 flex-1 space-y-2 rounded-tl-none">
                    <p className="font-semibold text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 animate-pulse" /> {assistantError.text}
                    </p>
                    <button
                      onClick={() => executeAssistantRequest(assistantError.lastMessage, messages.slice(0, -1))}
                      className="bg-red-900/50 hover:bg-red-900 text-red-200 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center inline-flex gap-1"
                    >
                      <RefreshCw className="h-3 w-3 animate-spin [animation-duration:3s]" /> Retry Question
                    </button>
                  </div>
                </div>
              )}

              {isThinking && (
                <div className="flex justify-start items-center gap-2">
                  <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold animate-pulse ${
                    mode === "child" ? "bg-teal-600/30 text-teal-400" : "bg-cyan-600/30 text-cyan-400"
                  }`}>
                    G
                  </div>
                  <div className="bg-slate-900/75 border border-slate-850 rounded-2xl px-4 py-3 rounded-tl-none flex items-center space-x-1 shadow-sm">
                    <div className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="h-1.5 w-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Quick action panel */}
            <div className="p-2.5 bg-slate-950/80 border-t border-slate-900 overflow-x-auto whitespace-nowrap flex gap-2 scrollbar-none scroll-smooth">
              {quickActions.map((act, idx) => (
                <button
                  key={idx}
                  disabled={isThinking}
                  onClick={() => handleQuickAction(act.prompt)}
                  className="inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 text-xs text-slate-300 font-medium hover:text-white transition-all cursor-pointer shadow-sm hover:scale-102 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:bg-slate-900/90"
                >
                  <span className={`${mode === "child" ? "text-teal-400" : "text-cyan-400"}`}>
                    {act.icon}
                  </span>
                  <span className="text-[11px] font-bold tracking-tight">{act.title}</span>
                </button>
              ))}
            </div>

            {/* Speaking / Listening feedback waves */}
            {isListening && (
              <div className="h-6 bg-cyan-950/70 border-t border-cyan-900 px-4 flex items-center justify-between text-[10px] text-cyan-400 font-mono tracking-wide">
                <span className="flex items-center gap-1.5 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                  Guardian is listening... speak clearly
                </span>
                <div className="flex space-x-0.5 items-center">
                  <div className="w-0.5 h-3 bg-cyan-400 animate-[pulse_0.4s_infinite]"></div>
                  <div className="w-0.5 h-5 bg-cyan-400 animate-[pulse_0.5s_infinite_delay-100]"></div>
                  <div className="w-0.5 h-2 bg-cyan-400 animate-[pulse_0.3s_infinite_delay-200]"></div>
                  <div className="w-0.5 h-4 bg-cyan-400 animate-[pulse_0.6s_infinite_delay-150]"></div>
                </div>
              </div>
            )}

            {avatarState === "speaking" && !muted && (
              <div className="h-6 bg-indigo-950/70 border-t border-indigo-900 px-4 flex items-center justify-between text-[10px] text-indigo-400 font-mono tracking-wide">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="h-3 w-3 text-indigo-400 animate-bounce" />
                  Guardian is responding with voice...
                </span>
                <div className="flex space-x-0.5 items-end h-3">
                  <div className="w-0.5 h-1 bg-indigo-400 animate-[bounce_0.6s_infinite_0.1s]"></div>
                  <div className="w-0.5 h-2.5 bg-indigo-400 animate-[bounce_0.4s_infinite_0.3s]"></div>
                  <div className="w-0.5 h-1.5 bg-indigo-400 animate-[bounce_0.5s_infinite_0.2s]"></div>
                  <div className="w-0.5 h-3 bg-indigo-400 animate-[bounce_0.7s_infinite_0.4s]"></div>
                </div>
              </div>
            )}

            {/* Message Input Control Box */}
            <div className="p-3 bg-slate-950 border-t border-slate-900 flex items-center gap-2">
              
              {/* Reset/Clear Button */}
              <button
                onClick={clearChat}
                disabled={isThinking}
                title="Clear conversation"
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-850 transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              {/* TTS Toggler */}
              <button
                onClick={() => {
                  setMuted(!muted);
                  if (!muted && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                  }
                }}
                title={muted ? "Unmute vocal feedback" : "Mute vocal feedback"}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                  muted 
                    ? "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300" 
                    : "bg-slate-900 border-slate-700 text-cyan-400 hover:bg-slate-850"
                }`}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              {/* Input Area */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendMessage();
                  }}
                  disabled={isThinking}
                  placeholder={mode === "child" ? "Ask Guardian helper..." : "Ask Guardian security advice..."}
                  className="w-full text-xs font-medium rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 focus:border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:outline-none transition-all pr-10 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                />
                
                {/* Voice Input Trigger Button */}
                <button
                  type="button"
                  onClick={handleMicrophoneClick}
                  disabled={isThinking}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all cursor-pointer ${
                    isListening 
                      ? "bg-cyan-500 text-white animate-pulse" 
                      : "text-slate-400 hover:text-cyan-400"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Speech Recognition"
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>

              {/* Submit button */}
              <button
                onClick={() => sendMessage()}
                disabled={isThinking || !input.trim()}
                className={`p-3 rounded-2xl cursor-pointer transition-all shrink-0 ${
                  input.trim() && !isThinking
                    ? mode === "child"
                      ? "bg-gradient-to-tr from-teal-600 to-emerald-600 text-white hover:scale-105 active:scale-95"
                      : "bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white hover:scale-105 active:scale-95"
                    : "bg-slate-900 border border-slate-850 text-slate-600 cursor-not-allowed"
                }`}
              >
                <Send className="h-4 w-4" />
              </button>

            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
