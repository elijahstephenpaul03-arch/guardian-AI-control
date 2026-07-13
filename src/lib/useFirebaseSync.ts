import { useState, useEffect } from "react";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  User
} from "./firebase";
import { onSnapshot, writeBatch } from "firebase/firestore";
import { ChildProfile, ActivityLog, ChatMessage } from "../types";
import { initialProfiles, initialLogs } from "../data";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function useFirebaseSync() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);

  // Sync state variables
  const [profiles, setProfiles] = useState<ChildProfile[]>(initialProfiles);
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [dangerousEvents, setDangerousEvents] = useState<any[]>([]);
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({
    "child-1": [
      { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Leo's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
    ],
    "child-2": [
      { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Emily's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
    ]
  });

  // Default dangerous events
  const initialDangerousEvents = [
    {
      id: "de-1",
      childId: "child-1",
      category: "Scam & Phishing",
      target: "free-robux-clicker.com/claim-reward",
      riskLevel: "high",
      confidence: 94,
      reason: "Attempts to harvest user credential tokens via high-pressure phishing banners promising virtual Roblox currency.",
      actionTaken: "Blocked connection instantly & routed alert to Guardian parent dashboard.",
      suggestedAction: "Have a talk with Leo about in-game item scams. Restrict third-party Google auth logins.",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: "blocked"
    },
    {
      id: "de-2",
      childId: "child-1",
      category: "Adult Content",
      target: "chatroulette-clone.xxx/stream",
      riskLevel: "critical",
      confidence: 99,
      reason: "TCP/IP handshake established with domain containing adult video streaming scripts and mature content ratings.",
      actionTaken: "Secured hardware, dropped network packets immediately, and initiated 15-minute temporary device lock.",
      suggestedAction: "Review tablet's web history. Ensure Leo uses Google SafeSearch on all web browsers.",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      status: "blocked"
    }
  ];

  // Default safe zones
  const initialSafeZones = [
    { name: "Home Safe Zone", active: true, radius: 100, lat: 37.7790, lng: -122.4180 },
    { name: "Oakridge Tech Academy", active: true, radius: 200, lat: 37.7749, lng: -122.4194 },
    { name: "Sunnyvale Soccer Fields", active: true, radius: 150, lat: 37.7833, lng: -122.4167 }
  ];

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        setIsGuestMode(false);
        setDbLoading(true);
        try {
          await ensureUserSeeded(currentUser);
        } catch (err) {
          console.error("Seeding error:", err);
        } finally {
          setDbLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Ensure that initial configurations are seeded in Firestore under the logged in user
  const ensureUserSeeded = async (u: User) => {
    try {
      const userDocRef = doc(db, "users", u.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // Create primary user document
        await setDoc(userDocRef, {
          email: u.email,
          displayName: u.displayName,
          createdAt: new Date().toISOString()
        });

        // Seed profiles
        for (const profile of initialProfiles) {
          await setDoc(doc(db, "users", u.uid, "profiles", profile.id), profile);
        }

        // Seed logs (limit to first 10 for speed)
        for (const log of initialLogs.slice(0, 10)) {
          await setDoc(doc(db, "users", u.uid, "logs", log.id), log);
        }

        // Seed dangerous events
        for (const de of initialDangerousEvents) {
          await setDoc(doc(db, "users", u.uid, "dangerousEvents", de.id), de);
        }

        // Seed safe zones
        for (const idx in initialSafeZones) {
          const sz = initialSafeZones[idx];
          await setDoc(doc(db, "users", u.uid, "safeZones", `zone-${idx}`), sz);
        }

        // Seed chat messages
        const initialChats = [
          { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Leo's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM", childId: "child-1" },
          { id: "m-2", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Emily's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM", childId: "child-2" }
        ];
        for (const chat of initialChats) {
          await setDoc(doc(db, "users", u.uid, "chats", chat.id), chat);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
    }
  };

  // Real-time listen to user Firestore subcollections
  useEffect(() => {
    if (!user) {
      if (!isGuestMode) {
        // Reset states if logged out and not in guest mode
        setProfiles(initialProfiles);
        setLogs(initialLogs);
        setDangerousEvents(initialDangerousEvents);
        setSafeZones(initialSafeZones);
        setChatHistory({
          "child-1": [
            { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Leo's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
          ],
          "child-2": [
            { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Emily's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
          ]
        });
      }
      return;
    }

    // Listener for Profiles
    const unsubscribeProfiles = onSnapshot(collection(db, "users", user.uid, "profiles"), (snapshot) => {
      const projs: ChildProfile[] = [];
      snapshot.forEach((d) => {
        projs.push({ id: d.id, ...d.data() } as ChildProfile);
      });
      if (projs.length > 0) {
        setProfiles(projs);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/profiles`);
    });

    // Listener for Logs
    const unsubscribeLogs = onSnapshot(collection(db, "users", user.uid, "logs"), (snapshot) => {
      const lgs: ActivityLog[] = [];
      snapshot.forEach((d) => {
        lgs.push({ id: d.id, ...d.data() } as ActivityLog);
      });
      // Sort logs by timestamp descending
      lgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(lgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/logs`);
    });

    // Listener for Dangerous Events
    const unsubscribeDE = onSnapshot(collection(db, "users", user.uid, "dangerousEvents"), (snapshot) => {
      const des: any[] = [];
      snapshot.forEach((d) => {
        des.push({ id: d.id, ...d.data() });
      });
      des.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setDangerousEvents(des);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/dangerousEvents`);
    });

    // Listener for Safe Zones
    const unsubscribeZones = onSnapshot(collection(db, "users", user.uid, "safeZones"), (snapshot) => {
      const zones: any[] = [];
      snapshot.forEach((d) => {
        zones.push({ id: d.id, ...d.data() });
      });
      setSafeZones(zones);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/safeZones`);
    });

    // Listener for Chats
    const unsubscribeChats = onSnapshot(collection(db, "users", user.uid, "chats"), (snapshot) => {
      const messagesByChild: Record<string, ChatMessage[]> = {
        "child-1": [],
        "child-2": []
      };

      snapshot.forEach((d) => {
        const data = d.data();
        const childId = data.childId || "child-1";
        if (!messagesByChild[childId]) {
          messagesByChild[childId] = [];
        }
        messagesByChild[childId].push({
          id: d.id,
          role: data.role,
          text: data.text,
          timestamp: data.timestamp,
          groundingMetadata: data.groundingMetadata || null
        } as ChatMessage);
      });

      setChatHistory(prev => {
        const merged: Record<string, ChatMessage[]> = {};
        
        // Ensure child-1 and child-2 keys always exist at minimum
        const keys = new Set(["child-1", "child-2", ...Object.keys(messagesByChild), ...Object.keys(prev)]);
        
        keys.forEach((cid) => {
          const snapshotMsgs = messagesByChild[cid] || [];
          const localMsgs = prev[cid] || [];
          
          const snapshotIds = new Set(snapshotMsgs.map(m => m.id));
          const pending = localMsgs.filter(m => !snapshotIds.has(m.id));
          
          let combined = [...snapshotMsgs, ...pending];
          
          if (combined.length === 0) {
            combined = [
              { id: "m-1", role: "model", text: `Hello! I am your Guardian AI family counselor. Ask me anything about ${cid === "child-1" ? "Leo" : "Emily"}'s digital habits, educational focus, or safety logs.`, timestamp: "09:00 AM" }
            ];
          } else {
            const getTimestamp = (id: string): number => {
              if (id === "m-1" || id === "m-2") return 0;
              const match = id.match(/\d+/g);
              if (match && match.length > 0) {
                // Return the last numeric segment (the timestamp)
                return parseInt(match[match.length - 1], 10);
              }
              return 0;
            };

            combined.sort((a, b) => {
              if (a.id === "m-1" || a.id === "m-2") return -1;
              if (b.id === "m-1" || b.id === "m-2") return 1;
              const tA = getTimestamp(a.id);
              const tB = getTimestamp(b.id);
              if (tA !== tB) {
                return tA - tB;
              }
              return a.id.localeCompare(b.id);
            });
          }
          
          merged[cid] = combined;
        });
        
        return merged;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/chats`);
    });

    return () => {
      unsubscribeProfiles();
      unsubscribeLogs();
      unsubscribeDE();
      unsubscribeZones();
      unsubscribeChats();
    };
  }, [user]);

  // Real-time listener for companion devices linked to the parent's profiles
  useEffect(() => {
    const activeListeners: Record<string, () => void> = {};

    profiles.forEach((profile) => {
      if (profile.deviceId && !activeListeners[profile.deviceId]) {
        const devId = profile.deviceId;
        const devRef = doc(db, "devices", devId);
        
        activeListeners[devId] = onSnapshot(devRef, async (snap) => {
          if (snap.exists()) {
            const devData = snap.data();
            
            const updatedStatus = devData.screenOn 
              ? (profile.status === 'locked' ? 'locked' : 'online') 
              : 'offline';

            const updatedFields = {
              battery: typeof devData.battery === 'number' ? devData.battery : profile.battery,
              device: devData.deviceName && devData.deviceModel 
                ? `${devData.deviceModel} (${devData.deviceName})` 
                : profile.device,
              status: updatedStatus as any,
              lastSeenLocation: devData.gps ? {
                lat: typeof devData.gps.lat === 'number' ? devData.gps.lat : (profile.lastSeenLocation?.lat ?? 37.7749),
                lng: typeof devData.gps.lng === 'number' ? devData.gps.lng : (profile.lastSeenLocation?.lng ?? -122.4194),
                name: devData.gps.name ?? (profile.lastSeenLocation?.name ?? "Unknown Location"),
                timestamp: devData.lastSeen || new Date().toISOString()
              } : profile.lastSeenLocation
            };

            // Only update if something is actually different to avoid infinite trigger loops
            const hasChanged = 
              profile.battery !== updatedFields.battery ||
              profile.device !== updatedFields.device ||
              profile.status !== updatedFields.status ||
              profile.lastSeenLocation?.name !== updatedFields.lastSeenLocation?.name ||
              profile.lastSeenLocation?.lat !== updatedFields.lastSeenLocation?.lat ||
              profile.lastSeenLocation?.lng !== updatedFields.lastSeenLocation?.lng;

            if (hasChanged) {
              if (user) {
                try {
                  const profileRef = doc(db, "users", user.uid, "profiles", profile.id);
                  await updateDoc(profileRef, updatedFields);
                } catch (error) {
                  console.error("Failed to sync device updates to profile document:", error);
                }
              } else {
                setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, ...updatedFields } : p));
              }
            }
          }
        });
      }
    });

    return () => {
      Object.values(activeListeners).forEach((unsub) => unsub());
    };
  }, [user, profiles]);

  // Sync operations helpers
  const handleLogin = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google login failed:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsGuestMode(false);
    } catch (err) {
      console.error("Signout failed:", err);
    }
  };

  const addProfileInDb = async (profile: ChildProfile) => {
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "profiles", profile.id), profile);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/profiles/${profile.id}`);
      }
    } else {
      setProfiles(prev => [...prev, profile]);
    }
  };

  const updateProfileInDb = async (profileId: string, fields: Partial<ChildProfile>) => {
    if (user) {
      try {
        const profileRef = doc(db, "users", user.uid, "profiles", profileId);
        await updateDoc(profileRef, fields);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/profiles/${profileId}`);
      }
    } else {
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...fields } : p));
    }
  };

  const addLogInDb = async (log: ActivityLog) => {
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "logs", log.id), log);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/logs/${log.id}`);
      }
    } else {
      setLogs(prev => [log, ...prev]);
    }
  };

  const addDangerousEventInDb = async (de: any) => {
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "dangerousEvents", de.id), de);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/dangerousEvents/${de.id}`);
      }
    } else {
      setDangerousEvents(prev => [de, ...prev]);
    }
  };

  const deleteDangerousEventInDb = async (id: string) => {
    if (user) {
      try {
        const deRef = doc(db, "users", user.uid, "dangerousEvents", id);
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(deRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/dangerousEvents/${id}`);
      }
    } else {
      setDangerousEvents(prev => prev.filter(e => e.id !== id));
    }
  };

  const addSafeZoneInDb = async (zone: any) => {
    const id = `zone-${Date.now()}`;
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "safeZones", id), { ...zone, id });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/safeZones/${id}`);
      }
    } else {
      setSafeZones(prev => [...prev, { ...zone, id }]);
    }
  };

  const deleteSafeZoneInDb = async (id: string) => {
    if (user) {
      try {
        const zoneRef = doc(db, "users", user.uid, "safeZones", id);
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(zoneRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/safeZones/${id}`);
      }
    } else {
      setSafeZones(prev => prev.filter(z => z.id !== id));
    }
  };

  const addChatMessageInDb = async (childId: string, message: ChatMessage) => {
    // Optimistically update the local chat history immediately
    setChatHistory(prev => {
      const currentList = prev[childId] || [];
      if (currentList.some(m => m.id === message.id)) return prev;
      return {
        ...prev,
        [childId]: [...currentList, message]
      };
    });

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "chats", message.id), {
          ...message,
          childId
        });
      } catch (error) {
        console.warn("[FirebaseSync] Failed to save chat to Firestore:", error);
      }
    }
  };

  return {
    user,
    authLoading,
    isGuestMode,
    setIsGuestMode,
    dbLoading,
    profiles,
    setProfiles,
    logs,
    setLogs,
    dangerousEvents,
    setDangerousEvents,
    safeZones,
    setSafeZones,
    chatHistory,
    setChatHistory,
    handleLogin,
    handleLogout,
    addProfileInDb,
    updateProfileInDb,
    addLogInDb,
    addDangerousEventInDb,
    deleteDangerousEventInDb,
    addSafeZoneInDb,
    deleteSafeZoneInDb,
    addChatMessageInDb
  };
}
