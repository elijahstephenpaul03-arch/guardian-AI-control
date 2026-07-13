import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import PublicHome from "./components/PublicHome";
import Dashboard from "./components/Dashboard";
import Footer from "./components/Footer";
import CompanionSimulator from "./components/CompanionSimulator";
import GuardianAssistant from "./components/GuardianAssistant";

export default function App() {
  const [viewMode, setViewMode] = useState<"public" | "dashboard" | "companion">("public");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Sync dark mode class on document element
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Smooth scrolling to landing page sections
  const scrollToSection = (id: string) => {
    setViewMode("public");
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Universal header with navigation and view switches */}
      <Navbar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode} 
        viewMode={viewMode} 
        setViewMode={(mode) => setViewMode(mode)} 
        scrollToSection={scrollToSection}
      />

      {/* Main Views */}
      <main className="flex-1 flex flex-col">
        {viewMode === "public" ? (
          <>
            <PublicHome setViewMode={setViewMode} />
            <Footer />
          </>
        ) : viewMode === "dashboard" ? (
          <Dashboard />
        ) : (
          <CompanionSimulator onBackToDashboard={() => setViewMode("dashboard")} />
        )}
      </main>

      {/* Premium Floating AI Assistant */}
      <GuardianAssistant viewMode={viewMode} />
    </div>
  );
}
