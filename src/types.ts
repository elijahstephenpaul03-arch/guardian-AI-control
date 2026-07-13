export type SafetyLevel = 'safe' | 'warning' | 'severe';

export interface ChildProfile {
  id: string;
  deviceId?: string;
  name: string;
  age: number;
  avatar: string;
  device: string;
  battery: number;
  status: 'online' | 'offline' | 'locked' | 'focus';
  screenTimeLimit: number; // in minutes
  screenTimeToday: number; // in minutes
  riskScore: number; // out of 100
  lastSeenLocation: {
    lat: number;
    lng: number;
    name: string;
    timestamp: string;
  };

}

export interface ActivityLog {
  id: string;
  childId: string;
  type: 'app' | 'web' | 'location' | 'sos' | 'safety' | 'system';
  title: string;
  description: string;
  timestamp: string;
  safetyLevel: SafetyLevel;
  duration?: number; // in minutes
}

export interface AdvancedAIReport {
  weekStarting: string;
  screenTimeSummary: string;
  mostUsedApps: { name: string; duration: number; icon: string }[];
  educationalVsEntertainment: { edu: number; ent: number; other: number };
  dailyRoutineAnalysis: string;
  sleepScheduleInsights: string;
  browsingTrends: string;
  safetyAlertsCount: number;
  personalizedRecommendations: string[];
}

export interface InterestTalentData {
  growthTimeline: { month: string; coding: number; art: number; music: number; science: number }[];
  talents: {
    name: string;
    score: number;
    description: string;
    careerSuggestions: string[];
    resources: string[];
  }[];
  learningStyle: string;
  talentScore: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  groundingMetadata?: any;
}
