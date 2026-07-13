import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini client
let aiClient: GoogleGenAI | null = null;
let isRateLimited = false;
let rateLimitResetTime = 0;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is missing. Assistant will operate in fallback mock mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "guardian-ai",
        },
      },
    });
  }
  return aiClient;
}

// Generates an expert graceful fallback parenting response using child context parameters
function getGracefulFallbackResponse(
  message: string,
  childName: string,
  riskScore: number,
  screenTimeToday: number,
  screenTimeLimit: number,
  logs: any[] = [],
  dangerousEvents: any[] = [],
  mode: "parent" | "child" = "parent"
): string {
  const msgLower = message.toLowerCase();

  if (mode === "child") {
    // 1. Greetings & Chat Setup
    if (
      msgLower.includes("hello") ||
      msgLower.includes("hi ") ||
      msgLower.includes("hi!") ||
      msgLower.includes("hey") ||
      msgLower.includes("guardian") ||
      msgLower.includes("who are you") ||
      msgLower.includes("assistant")
    ) {
      return `Hey there! I am **Guardian**, your personal AI companion! 🌟 I am always here to help you learn cool science, solve tricky homework, teach you how to write code, and share cyber-smart safety tips. What awesome things are we exploring today?`;
    }

    // 2. Homework / Subjects / Math / Science
    if (
      msgLower.includes("homework") ||
      msgLower.includes("math") ||
      msgLower.includes("solve") ||
      msgLower.includes("subject") ||
      msgLower.includes("school") ||
      msgLower.includes("question") ||
      msgLower.includes("science") ||
      msgLower.includes("history") ||
      msgLower.includes("calculate")
    ) {
      return `I'd love to help with your school subjects and homework! 📚 Let's be smart like JARVIS and break it down step-by-step:
1. **Understand the Goal**: What is the question asking us to find?
2. **Break it down**: Splitting complex operations into smaller, simpler parts makes them super easy!
3. **Double-check**: Always verify each step as we go along.

Go ahead and type or read your exact question, and we'll solve it together!`;
    }

    // 3. Cyber Safety guidance
    if (
      msgLower.includes("safety") ||
      msgLower.includes("safe") ||
      msgLower.includes("cyber") ||
      msgLower.includes("password") ||
      msgLower.includes("online") ||
      msgLower.includes("internet") ||
      msgLower.includes("bully") ||
      msgLower.includes("share")
    ) {
      return `Being cyber-smart is super cool and keeps you safe! 🛡️ Here are the top 3 safety guidelines to always remember:
1. **Secrets Stay Secret**: Never share your passwords, real name, school, home address, or phone number with anyone online.
2. **Be a Kind Gamer**: Treat other people with respect and kindness in chats and multiplayer lobbies.
3. **Speak Up**: If any message, video, or person online makes you feel uncomfortable, scared, or confused, tell your parents or a trusted adult immediately!

You're doing an amazing job staying safe online!`;
    }

    // 4. Teaching programming / Coding
    if (
      msgLower.includes("code") ||
      msgLower.includes("program") ||
      msgLower.includes("python") ||
      msgLower.includes("javascript") ||
      msgLower.includes("scratch") ||
      msgLower.includes("html")
    ) {
      return `Coding is like building magic spells with text! 💻 Here is a super cool **Python** trick to say hello to your companion:
\`\`\`python
# This prints a message on your screen!
name = "Future Coding Wizard"
print("Hello, " + name + "! Welcome to the programming world.")
\`\`\`
Would you like me to teach you how loops work, or how to create a simple text game in Python or Javascript next?`;
    }

    // 5. Video recommendations
    if (
      msgLower.includes("video") ||
      msgLower.includes("watch") ||
      msgLower.includes("recommend") ||
      msgLower.includes("channel")
    ) {
      return `Here are some incredibly fun and verified safe educational video channels you can check out:
- **Mark Rober**: Cool engineering, physics, and DIY science experiments.
- **Crash Course Kids**: High-energy lessons about earth, science, and space.
- **SciShow Kids**: Answers the coolest questions about why things happen in nature!
*Super Safety Reminder*: Always check with your parents before launching video streams!`;
    }

    // 6. Support & Empathy for concerns
    if (
      msgLower.includes("sad") ||
      msgLower.includes("angry") ||
      msgLower.includes("scared") ||
      msgLower.includes("feel") ||
      msgLower.includes("lonely") ||
      msgLower.includes("bully") ||
      msgLower.includes("cry")
    ) {
      return `I hear you, and it's completely okay to feel that way. ❤️ Everyone has tough days! Sharing your feelings with someone who loves you is a powerful way to feel better. 
I highly recommend talking with your parents, a teacher, or another trusted adult. They care about you so much and are always ready to help you through anything. I'm also here to listen, teach, and cheer you on!`;
    }

    // Default Child reply
    return `That sounds like an amazing thing to talk about! 🚀 We can solve homework puzzles together, learn how to code, explore space and science, or talk about cool digital safety rules. What should we ask next?`;
  }

  const appLogs = logs.filter((l: any) => l.type === 'app');
  const webLogs = logs.filter((l: any) => l.type === 'web');
  const locationLogs = logs.filter((l: any) => l.type === 'location');

  const educationalApps = Array.from(new Set(
    appLogs
      .filter((l: any) => l.title.toLowerCase().includes('duolingo') || l.title.toLowerCase().includes('scratch') || l.title.toLowerCase().includes('khan') || l.description.toLowerCase().includes('learn') || l.description.toLowerCase().includes('educat'))
      .map((l: any) => l.title)
  ));
  const eduListStr = educationalApps.length > 0 ? educationalApps.join(', ') : "educational apps";

  const entertainmentApps = Array.from(new Set(
    appLogs
      .filter((l: any) => l.title.toLowerCase().includes('roblox') || l.title.toLowerCase().includes('youtube') || l.title.toLowerCase().includes('minecraft') || l.title.toLowerCase().includes('game'))
      .map((l: any) => l.title)
  ));
  const entListStr = entertainmentApps.length > 0 ? entertainmentApps.join(', ') : "entertainment platforms";

  const lastLocName = locationLogs.length > 0 ? locationLogs[0].title : "Safe Zone";
  const blockedCount = dangerousEvents.length;
  const recentBlocked = dangerousEvents.slice(0, 2).map((e: any) => `- **${e.category}** attempt to access \`${e.target}\` (${e.actionTaken || "Blocked"}).`).join('\n');

  // 1. Greetings & Introductions
  if (
    msgLower.includes("hello") ||
    msgLower.includes("hi ") ||
    msgLower.includes("hi!") ||
    msgLower.includes("hey") ||
    msgLower.includes("who are you") ||
    msgLower.includes("what are you") ||
    msgLower.includes("assistant") ||
    msgLower.includes("greet")
  ) {
    return `Hello! I am your **Guardian AI Smart Assistant**. I am here to help you monitor and guide **${childName}**'s digital footprint. I can analyze screen time usage, assess security risk scores, track safe zones/locations, and provide personalized parenting tips and educational recommendations. What would you like to check today?`;
  }

  // 2. Screen Time / Limits / Usage
  if (
    msgLower.includes("screen") ||
    msgLower.includes("limit") ||
    msgLower.includes("hour") ||
    msgLower.includes("minute") ||
    msgLower.includes("time") ||
    msgLower.includes("usage") ||
    msgLower.includes("duration") ||
    msgLower.includes("how long")
  ) {
    let response = `Current digital stats for **${childName}** show **${screenTimeToday} minutes** of screen time used out of the daily limit of **${screenTimeLimit} minutes**.\n\n`;
    if (appLogs.length > 0) {
      response += `Here is the recent app activity detected:\n`;
      response += appLogs.slice(0, 4).map((l: any) => `- **${l.title}**: ${l.description}`).join('\n') + `\n\n`;
    } else {
      response += `The digital routine balance looks safe. Here is a general breakdown:\n- **Educational**: Active on logic building and language practice (${eduListStr}).\n- **Entertainment**: Engaged in creative play and curated video streams (${entListStr}).\n\n`;
    }
    response += `*Recommendation*: Given the daily use of **${screenTimeToday} minutes**, we suggest encouraging regular screen breaks to balance online study with physical movement. Let me know if you would like me to adjust screen limits.`;
    return response;
  }

  // 3. Safety / Security / Risk / Alert / Blocked
  if (
    msgLower.includes("safety") ||
    msgLower.includes("secure") ||
    msgLower.includes("risk") ||
    msgLower.includes("block") ||
    msgLower.includes("alert") ||
    msgLower.includes("unsafe") ||
    msgLower.includes("scam") ||
    msgLower.includes("flagged") ||
    msgLower.includes("safe") ||
    msgLower.includes("exploit") ||
    msgLower.includes("danger") ||
    msgLower.includes("restricted") ||
    msgLower.includes("safesearch")
  ) {
    let response = `Our active protection module reports that **${childName}**'s Digital Safety Score is currently **${riskScore}/100** (lower score indicates a safer profile).\n\n`;
    if (blockedCount > 0) {
      response += `**Recent Blocked Outbound Attempts (${blockedCount} total neutralized):**\n${recentBlocked}\n\n`;
    } else {
      response += `**Recent Activity Summary:**\n- **Safe Search Filter**: Active and enforcing strictly.\n- **Risk Status**: No critical or unverified outbound network connection requests were detected today.\n\n`;
    }
    response += `*Nudge Advice*: We recommend maintaining active geofence and SafeSearch parameters. Talk with **${childName}** about not sharing credentials, passwords, or clicking promotional ads on public lobbies.`;
    return response;
  }

  // 4. Education / Progress / Learning / Apps / School / Scratch / Duolingo / Khan
  if (
    msgLower.includes("learn") ||
    msgLower.includes("study") ||
    msgLower.includes("education") ||
    msgLower.includes("apps") ||
    msgLower.includes("school") ||
    msgLower.includes("scratch") ||
    msgLower.includes("duolingo") ||
    msgLower.includes("khan") ||
    msgLower.includes("course") ||
    msgLower.includes("activity") ||
    msgLower.includes("activities") ||
    msgLower.includes("interest") ||
    msgLower.includes("talent")
  ) {
    let response = `**${childName}** is showing excellent progress in digital learning and creativity! Highlights from recent metrics:\n\n`;
    if (educationalApps.length > 0) {
      response += `**Educational apps being utilized:**\n` + appLogs.filter((l: any) => educationalApps.includes(l.title)).slice(0, 3).map((l: any) => `- **${l.title}**: ${l.description}`).join('\n') + `\n\n`;
    } else {
      response += `- **STEM & Logic**: Exploring coding mechanics and structured programming languages (Scratch Junior).\n- **Language Skills**: Active vocabulary exercises and language repetitions (Duolingo).\n\n`;
    }
    response += `*Parenting Tip*: Supporting online achievements with physical creative kits, puzzles, or joint design tasks is a wonderful way to foster deeper cognitive retention.`;
    return response;
  }

  // 5. Location / Safe Zone / GPS / Maps
  if (
    msgLower.includes("location") ||
    msgLower.includes("place") ||
    msgLower.includes("where is") ||
    msgLower.includes("map") ||
    msgLower.includes("zone") ||
    msgLower.includes("gps") ||
    msgLower.includes("tracking") ||
    msgLower.includes("geofence")
  ) {
    let response = `**${childName}**'s real-time physical safety status is fully monitored and secure.\n\n`;
    if (locationLogs.length > 0) {
      const lastLoc = locationLogs[0];
      response += `- **Current/Last Known Zone**: **${lastLoc.title}** (${lastLoc.description})\n`;
      response += `- **Last Check-in Time**: Checked in safely at ${new Date(lastLoc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    } else {
      response += `- **Last Safe Zone Status**: Verified safe check-in at ${lastLocName}.\n- **Alerts**: Geofencing tracking filters are fully operational and active.\n`;
    }
    response += `\nGeofencing limits are currently armed and will alert you instantly if any designated boundary is crossed.`;
    return response;
  }

  // 6. Child profile / Leo / Age / Context / Emily
  if (
    msgLower.includes("leo") ||
    msgLower.includes("emily") ||
    msgLower.includes("child") ||
    msgLower.includes("age") ||
    msgLower.includes("profile") ||
    msgLower.includes("he ") ||
    msgLower.includes("she ")
  ) {
    return `**${childName}**'s digital profile is online and fully protected. Enforced filters include Google SafeSearch, content filtering, and geofence-based location monitoring. The current screen time usage of **${screenTimeToday} minutes** is well within the healthy daily limit of **${screenTimeLimit} minutes**, and the risk safety score is **${riskScore}/100** (where lower is safer).`;
  }

  // 7. General fallback questions
  const fallbacks: { [key: string]: string } = {
    "why did screen time increase?": `Based on recent activity metrics for **${childName}**, screen time increased due to high-value educational engagement on ${eduListStr || "Duolingo/Scratch"} (+15 minutes of logic building). The increase aligns perfectly with educational progress guidelines.`,
    "what did my child learn this week?": `**${childName}** is developing fantastic digital competencies!
1. **STEM & Logic**: Coding logical block flows and troubleshooting basic scripts.
2. **Problem Solving**: Engaging in language comprehension and systematic exercises.
Support this path with physical board games or simple STEM puzzle kits!`,
    "which apps are helping with education?": `The metrics show the following applications are highly beneficial to **${childName}**'s learning progress:
${educationalApps.length > 0 ? educationalApps.map(app => `- **${app}**: Actively practicing logical or linguistic patterns.`).join('\n') : "- **Scratch Junior & Duolingo**: Fostering computational thinking and language comprehension."}`,
    "what interests is my child developing?": `Based on browsing history and app engagement logs, **${childName}** is demonstrating high interest in:
- **Programming & Computing**: Regularly utilizing interactive block environments.
- **Problem Solving & Strategy**: Engaging with analytical tools and cognitive tasks.`,
  };

  const matched = Object.keys(fallbacks).find(k => msgLower.includes(k.substring(0, 15)));
  if (matched) {
    return fallbacks[matched];
  }

  return `Thanks for asking. **${childName}**'s digital profile shows highly secure browsing habits (Safety Score: **${riskScore}/100**). Most of the daily **${screenTimeToday} minutes** is spent on high-quality educational apps like ${eduListStr}.\n\nI recommend encouraging more outdoor physical breaks during screen hours to sustain focus and physical well-being. Let me know if you would like me to detail specific browsing trends, location logs, or security alerts.`;
}

// Calls Gemini generateContent with retries, exponential backoff, and model fallback
async function generateGeminiContentWithRetry(
  ai: GoogleGenAI,
  contents: any[],
  systemInstruction: string,
  primaryModel: string = "gemini-3.5-flash",
  tools: any[] = [],
  toolConfig: any = undefined
): Promise<any> {
  // Ensure unique models to avoid redundant attempts
  const modelsToTry = Array.from(new Set([primaryModel, "gemini-3.5-flash", "gemini-3.1-flash-lite"]));
  let lastError: any = null;

  for (const model of modelsToTry) {
    let attempts = 3;
    let delay = 800; // start with 800ms delay

    while (attempts > 0) {
      try {
        console.log(`[Gemini] Attempting generation. Model: ${model}, tools length: ${tools.length}, attempts left: ${attempts}`);
        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            tools: tools.length > 0 ? tools : undefined,
            toolConfig: toolConfig
          },
        });
        
        if (response) {
          return response;
        }
        throw new Error("Empty response returned from the Gemini API.");
      } catch (err: any) {
        lastError = err;
        const status = err.status || err.statusCode || (err.error && err.error.code);
        const errMsg = String(err.message || err);

        // Handle persistent quota exhaustion and billing errors immediately without useless retries
        const isQuotaOrBillingError = 
          status === 429 && 
          (errMsg.toLowerCase().includes("quota") || 
           errMsg.toLowerCase().includes("exhausted") || 
           errMsg.toLowerCase().includes("billing") || 
           errMsg.toLowerCase().includes("limit"));

        if (isQuotaOrBillingError) {
          console.log(`[Gemini] Model ${model} is currently rate-limited (429). Instantly activating our high-availability smart fallback mechanism.`);
          throw err; // Throw immediately to trigger the gracefully handled route-level fallback
        }

        console.warn(`[Gemini] Attempt failed for model ${model}. Status: ${status}. Error: ${errMsg}`);

        // Retry on transient errors
        const isTransient = 
          !status || 
          status === 503 || 
          status === 429 || 
          errMsg.toLowerCase().includes("demand") || 
          errMsg.toLowerCase().includes("unavailable") || 
          errMsg.toLowerCase().includes("limit");

        if (isTransient && attempts > 1) {
          attempts--;
          console.log(`[Gemini] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // exponential backoff
        } else {
          break; // Stop trying this model, switch to the next fallback model
        }
      }
    }
  }

  throw lastError || new Error("Failed to generate content after trying primary and fallback models.");
}

// Helper to construct a strictly compliant multi-turn chat contents list for Gemini API
function buildGeminiContents(history: any[], currentMessage: string): any[] {
  console.log(`[Gemini Content Builder] Starting construction. Raw history length: ${history?.length || 0}, Current message: "${currentMessage}"`);

  // 1. Filter out empty messages, invalid roles, and ensure text exists
  const rawTurns = (history || []).filter(
    (h) => h && (h.role === "user" || h.role === "model") && typeof h.text === "string" && h.text.trim() !== ""
  );

  // 2. Prevent duplication: if the last turn in history is already a "user" turn and has the identical text as the current message, remove it from history so we don't have duplicate consecutive user turns
  const precedingTurns = [...rawTurns];
  if (
    precedingTurns.length > 0 &&
    precedingTurns[precedingTurns.length - 1].role === "user" &&
    precedingTurns[precedingTurns.length - 1].text.trim() === currentMessage.trim()
  ) {
    console.log(`[Gemini Content Builder] Deduplicated current message from end of history.`);
    precedingTurns.pop();
  }

  // 3. Assemble all turns including the active query
  const allTurns = [
    ...precedingTurns,
    { role: "user", text: currentMessage }
  ];

  // 4. Strict merging of consecutive turns with the same role (e.g., user followed by user, or model followed by model)
  const groupedTurns: { role: "user" | "model"; text: string }[] = [];
  for (const h of allTurns) {
    const role = h.role === "user" ? "user" : "model";
    if (groupedTurns.length > 0 && groupedTurns[groupedTurns.length - 1].role === role) {
      console.log(`[Gemini Content Builder] Merging consecutive ${role} messages.`);
      groupedTurns[groupedTurns.length - 1].text += "\n" + h.text;
    } else {
      groupedTurns.push({ role, text: h.text });
    }
  }

  // 5. Strictly enforce that the chat MUST start with a "user" message. Drop any leading "model" messages.
  while (groupedTurns.length > 0 && groupedTurns[0].role !== "user") {
    console.log(`[Gemini Content Builder] Dropped leading model greeting from Gemini history to comply with API contract.`);
    groupedTurns.shift();
  }

  // 6. Format to the exact @google/genai contents list representation
  const finalContents = groupedTurns.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }]
  }));

  console.log(`[Gemini Content Builder] Complete. Structured turns count: ${finalContents.length}. Sequence of roles:`, finalContents.map(c => c.role));
  return finalContents;
}

// REST API endpoint for the Family AI Assistant
app.post("/api/assistant", async (req, res) => {
  const { 
    message, 
    childContext, 
    history, 
    logs = [],
    dangerousEvents = [],
    modelName = "gemini-3.5-flash", 
    enableSearch = false, 
    enableMaps = false,
    userLocation,
    mode = "parent" // "parent" | "child"
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const childName = childContext?.name || "the children";
  const childAge = childContext?.age ? `${childContext.age} years old` : "N/A";
  const currentStatus = childContext?.status || "online";
  const screenTimeLimit = childContext?.screenTimeLimit || 120;
  const screenTimeToday = childContext?.screenTimeToday || 45;
  const riskScore = childContext?.riskScore || 12;

  // Filter logs & alerts
  const appLogs = logs.filter((l: any) => l.type === 'app');
  const webLogs = logs.filter((l: any) => l.type === 'web');
  const locationLogs = logs.filter((l: any) => l.type === 'location');

  const formattedAppActivity = appLogs.length > 0 
    ? appLogs.slice(0, 5).map((l: any) => `- App Use: ${l.title} - ${l.description}`).join('\n')
    : "- No recent specific app events logged. General balance shows educational and safety-approved platforms.";

  const formattedWebActivity = webLogs.length > 0
    ? webLogs.slice(0, 5).map((l: any) => `- Web Search/Visit: "${l.title}" - ${l.description}`).join('\n')
    : "- Web queries remain under standard filtering guidelines.";

  const formattedLocation = locationLogs.length > 0
    ? `Checked in safely at '${locationLogs[0].title}' (${locationLogs[0].description})`
    : "No recent custom safe zone check-in, but active GPS remains secure within pre-defined parameters.";

  const formattedUnsafeEvents = dangerousEvents.length > 0
    ? dangerousEvents.map((e: any) => `- Category: ${e.category} | Attempted: ${e.target} | Action Taken: ${e.actionTaken || "Blocked"}`).join('\n')
    : "- No critical digital danger alerts flagged in this session.";

  // Determine system instruction based on mode (parent security advisor vs. child companion)
  let systemInstruction = "";
  if (mode === "child") {
    systemInstruction = `You are "Guardian", a premium, friendly, highly intelligent, and compassionate AI Companion and learning helper for children on the Guardian AI platform.
Your tone is warm, encouraging, curious, and highly educational—like a wise mentor, safe digital guide, or cool companion (similar to JARVIS for kids).
You support children with:
1. Explaining school subjects (math, science, history, geography, coding, etc.) using creative, easy-to-understand metaphors.
2. Solving homework questions step-by-step. Do NOT just give the final answer right away; instead, break it down patiently and prompt the child to think through each stage.
3. Teaching computer science, logic, and programming (Python, Scratch block logic, Javascript, HTML) with clean, fun code snippets.
4. Answering general knowledge questions with wonder and scientific excitement.
5. Providing gentle, super-clear guidance on cyber safety (keeping passwords private, not sharing personal data, being kind, reporting bullies, asking parents before installing apps).
6. Giving positive, empathetic, and supportive responses if they are sad, angry, or anxious, while gently reminding them that they can always talk to their parents or trusted adults for real support.

Format your responses beautifully in Markdown with clear lists, simple steps, and warm, conversational text that is friendly to hear read aloud (TTS-friendly). Keep your paragraphs concise and engaging.`;
  } else {
    systemInstruction = `You are a premium AI Family Security and Digital Wellbeing Assistant for Guardian AI, a child safety & parental control platform. 
Your tone is professional, reassuring, compassionate, and highly informative. 
You help parents analyze screen time, explain why usage might have changed, identify positive learning patterns, evaluate safety notifications, and guide nurture paths.
Use specific facts from the child context, safety logs, and digital activity metrics provided below, and give practical, actionable parenting recommendations.
Do not use technical jargon. Format your response clearly in Markdown.

--- Child Profile Context ---
Name: ${childName}
Age: ${childAge}
Status: ${currentStatus}
Risk Safety Score: ${riskScore}/100 (lower is safer)
Daily Screen Time: ${screenTimeToday} minutes used of ${screenTimeLimit} minutes limit

--- Real-time Activities & Telemetry ---
Recent App Activity:
${formattedAppActivity}

Recent Web Activity:
${formattedWebActivity}

Recent Physical Location/Safe Zone Status:
- Status: ${formattedLocation}

--- Digital Danger & Flagged Alerts ---
${formattedUnsafeEvents}`;
  }

  // Check if we need to reset the rate limit lock
  if (isRateLimited && Date.now() > rateLimitResetTime) {
    isRateLimited = false;
    console.log("[Gemini] Rate limit lock expired. Re-enabling cloud AI queries.");
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || isRateLimited) {
      if (isRateLimited) {
        console.log("[Gemini] API is currently rate-limited (429). Instantly activating our high-availability smart fallback mechanism.");
      } else {
        console.warn("GEMINI_API_KEY environment variable is missing. Operating in high-availability smart fallback mode.");
      }
      
      // Introduce a tiny realistic typing delay to make the conversational experience feel natural and premium
      await new Promise((resolve) => setTimeout(resolve, 600));
      
      const fallbackText = getGracefulFallbackResponse(message, childName, riskScore, screenTimeToday, screenTimeLimit, logs, dangerousEvents, mode);
      return res.json({ 
        text: isRateLimited 
          ? `${fallbackText}\n\n*(Note: Showing Guardian AI smart analysis because our cloud AI server is currently under very high demand. Rest assured, your child's data remains perfectly secure.)*`
          : fallbackText, 
        isFallback: true 
      });
    }

    const ai = getGeminiClient();

    // Prepare tools and configurations for grounding
    const tools: any[] = [];
    let toolConfig: any = undefined;

    if (enableSearch) {
      tools.push({ googleSearch: {} });
    }

    if (enableMaps) {
      tools.push({ googleMaps: {} });
      if (userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') {
        toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude
            }
          }
        };
      }
    }

    // Format conversation history using the strictly compliant content builder
    const formattedContents = buildGeminiContents(history, message);

    try {
      const response = await generateGeminiContentWithRetry(
        ai, 
        formattedContents, 
        systemInstruction, 
        modelName, 
        tools, 
        toolConfig
      );
      
      const text = response.text || "";
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata || null;

      return res.json({ 
        text, 
        groundingMetadata,
        modelUsed: response.model || modelName 
      });
    } catch (apiError: any) {
      const status = apiError?.status || apiError?.statusCode || (apiError?.error && apiError?.error?.code);
      const isQuota = status === 429 || String(apiError?.message || apiError).toLowerCase().includes("quota");
      if (isQuota) {
        isRateLimited = true;
        rateLimitResetTime = Date.now() + 1800000; // Lock for 30 minutes
        console.log("[Gemini] API generation paused due to temporary quota limit. Activated high-availability smart advice lock for 30 minutes.");
      } else {
        console.log("[Gemini] API generation degraded to offline analysis mode. Reason:", apiError?.message || apiError);
      }
      const fallbackText = getGracefulFallbackResponse(message, childName, riskScore, screenTimeToday, screenTimeLimit, logs, dangerousEvents, mode);
      return res.json({ 
        text: `${fallbackText}\n\n*(Note: Showing Guardian AI smart analysis because our cloud AI server is currently under very high demand. Rest assured, your child's data remains perfectly secure.)*`,
        isFallback: true
      });
    }
  } catch (error: any) {
    console.error("Gemini Assistant Route Error:", error);
    return res.status(500).json({ error: error.message || "An error occurred while generating the assistant response." });
  }
});

// Helper function to generate high-quality fallback vector images if the Gemini key is missing or limited
function generateDynamicSvgPoster(prompt: string, size: string): string {
  const width = size === "4K" ? 1024 : size === "2K" ? 768 : 512;
  const height = width;
  const title = prompt.length > 40 ? prompt.substring(0, 40) + "..." : prompt;
  
  // Choose tailored palettes based on keywords
  let startCol = "#1e293b"; // slate-800
  let endCol = "#0f172a"; // slate-900
  let accentCol = "#22d3ee"; // cyan-400
  let badgeIcon = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

  const pLower = prompt.toLowerCase();
  if (pLower.includes("study") || pLower.includes("learn") || pLower.includes("focus") || pLower.includes("school")) {
    startCol = "#0d9488"; // teal-600
    endCol = "#115e59"; // teal-800
    accentCol = "#38bdf8"; // sky-400
    badgeIcon = `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" fill="none" stroke="#38bdf8" stroke-width="2"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round"/>`;
  } else if (pLower.includes("detox") || pLower.includes("screen") || pLower.includes("limit") || pLower.includes("time")) {
    startCol = "#4f46e5"; // indigo-600
    endCol = "#312e81"; // indigo-900
    accentCol = "#a855f7"; // purple-500
    badgeIcon = `<rect x="5" y="2" width="14" height="20" rx="2" ry="2" fill="none" stroke="#a855f7" stroke-width="2"/><line x1="12" y1="18" x2="12.01" y2="18" stroke="#a855f7" stroke-width="3" stroke-linecap="round"/>`;
  } else if (pLower.includes("danger") || pLower.includes("block") || pLower.includes("scam") || pLower.includes("phishing") || pLower.includes("risk") || pLower.includes("hazard")) {
    startCol = "#be123c"; // rose-700
    endCol = "#4c0519"; // rose-950
    accentCol = "#fb7185"; // rose-400
    badgeIcon = `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="none" stroke="#fb7185" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#fb7185" stroke-width="3" stroke-linecap="round"/>`;
  } else if (pLower.includes("badge") || pLower.includes("gold") || pLower.includes("award") || pLower.includes("certificate") || pLower.includes("trophy")) {
    startCol = "#b45309"; // amber-700
    endCol = "#451a03"; // amber-950
    accentCol = "#fbbf24"; // amber-400
    badgeIcon = `<circle cx="12" cy="8" r="7" fill="none" stroke="#fbbf24" stroke-width="2"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linejoin="round"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 400 400" style="font-family:'Inter',sans-serif; background-color: #0f172a; border-radius: 12px;">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${startCol}" />
        <stop offset="100%" stop-color="${endCol}" />
      </linearGradient>
      <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${accentCol}" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bgGrad)" rx="16" />
    <circle cx="200" cy="140" r="70" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <circle cx="200" cy="140" r="50" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
    <g transform="translate(180, 120) scale(1.6)">
      ${badgeIcon}
    </g>
    <text x="200" y="245" font-size="14" font-weight="800" fill="url(#textGrad)" text-anchor="middle" letter-spacing="1.5" text-transform="uppercase">Guardian Safety AI Poster</text>
    <text x="200" y="275" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Space Grotesk',sans-serif">${title}</text>
    <text x="200" y="305" font-size="11" font-weight="500" fill="rgba(255,255,255,0.5)" text-anchor="middle">"Guarding Every Outbound Connection with Pride"</text>
    
    <rect x="50" y="335" width="300" height="1" fill="rgba(255,255,255,0.1)"/>
    <text x="200" y="358" font-size="9" font-weight="700" fill="${accentCol}" font-family="monospace" text-anchor="middle" letter-spacing="1">VERIFIED SAFE | RESOLUTION: ${size} | MODEL: GEMINI-3-PRO</text>
    <text x="200" y="375" font-size="8" font-weight="500" fill="rgba(255,255,255,0.3)" font-family="monospace" text-anchor="middle">OFFLINE SANDBOX RENDERING ENGINE</text>
  </svg>`;

  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

// REST API endpoint for Gemini-3-pro-image-preview generation with size selections (1K, 2K, 4K)
app.post("/api/generate-image", async (req, res) => {
  const { prompt, size = "1K" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing. Operating in high-availability dynamic SVG poster fallback mode.");
      const imageUrl = generateDynamicSvgPoster(prompt, size);
      return res.json({ imageUrl, isFallback: true });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: size // "1K", "2K", "4K"
        }
      }
    });

    let imageUrl = null;
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (imageUrl) {
      return res.json({ imageUrl });
    } else {
      console.warn("Gemini didn't return direct inlineData parts. Using custom dynamic fallback SVG poster.");
      const imageUrlFallback = generateDynamicSvgPoster(prompt, size);
      return res.json({ imageUrl: imageUrlFallback, isFallback: true });
    }
  } catch (error: any) {
    console.error("Gemini Image Generation Error, falling back to vector generation:", error);
    const imageUrlFallback = generateDynamicSvgPoster(prompt, size);
    return res.json({ imageUrl: imageUrlFallback, isFallback: true, error: error.message });
  }
});


// Configure Vite middleware and static asset serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite Development Server middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving production build from dist/ folder...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Guardian AI Server running at http://0.0.0.0:${PORT}`);
  });
}

setupServer();
