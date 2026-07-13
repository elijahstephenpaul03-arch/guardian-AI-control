import React, { useState } from "react";
import { Shield, Sun, Moon, Menu, X, ArrowRight, LayoutDashboard, Globe, Smartphone } from "lucide-react";

interface NavbarProps {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  viewMode: "public" | "dashboard" | "companion";
  setViewMode: (mode: "public" | "dashboard" | "companion") => void;
  scrollToSection: (id: string) => void;
}

export default function Navbar({
  isDarkMode,
  setIsDarkMode,
  viewMode,
  setViewMode,
  scrollToSection,
}: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          
          {/* Logo */}
          <div 
            onClick={() => setViewMode("public")}
            className="flex cursor-pointer items-center space-x-3"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-teal-400 text-white shadow-sm shadow-blue-500/10">
              <Shield className="h-5 w-5" />
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-ping rounded-full bg-teal-400"></div>
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-slate-800 dark:text-white">
                Guardian<span className="text-blue-600 dark:text-teal-400">AI</span>
              </span>
              <p className="text-[9px] font-mono tracking-wider leading-none text-slate-400 dark:text-slate-500">PARENTAL TRUST SHIELD</p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          {viewMode === "public" ? (
            <div className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => scrollToSection("features")} 
                className="text-sm font-medium text-slate-600 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400 transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection("ai-features")} 
                className="text-sm font-medium text-slate-600 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400 transition-colors"
              >
                Advanced AI
              </button>
              <button 
                onClick={() => scrollToSection("testimonials")} 
                className="text-sm font-medium text-slate-600 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400 transition-colors"
              >
                Testimonials
              </button>
              <button 
                onClick={() => scrollToSection("faq")} 
                className="text-sm font-medium text-slate-600 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400 transition-colors"
              >
                FAQ
              </button>
            </div>
          ) : viewMode === "companion" ? (
            <div className="hidden md:flex items-center space-x-4">
              <span className="inline-flex items-center rounded-full bg-teal-100 dark:bg-teal-950 px-2.5 py-0.5 text-xs font-medium text-teal-800 dark:text-teal-300">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                Companion Link Sandbox: Simulating background updates
              </span>
            </div>
          ) : (
            <div className="hidden md:flex items-center space-x-4">
              <span className="inline-flex items-center rounded-full bg-cyan-100 dark:bg-cyan-950 px-2.5 py-0.5 text-xs font-medium text-cyan-800 dark:text-cyan-300">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                Secure Cloud Sync: Listening in Real-Time
              </span>
            </div>
          )}

          {/* Right Action buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Dark Mode toggle hidden for permanent dark theme */}
            <button
              onClick={() => setIsDarkMode(true)}
              className="hidden"
              aria-label="Toggle Theme"
              id="theme-toggle-btn"
            >
              <Sun className="h-5 w-5 text-amber-400" />
            </button>

            {viewMode === "public" ? (
              <button
                onClick={() => setViewMode("dashboard")}
                className="inline-flex items-center space-x-2 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 px-5 py-2.5 text-sm font-semibold text-white transition-all cursor-pointer shadow-sm"
                id="enter-dashboard-btn"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Parent Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : viewMode === "companion" ? (
              <button
                onClick={() => setViewMode("dashboard")}
                className="inline-flex items-center space-x-2 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 px-5 py-2.5 text-sm font-semibold text-white transition-all cursor-pointer shadow-sm"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Parent Dashboard</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => setViewMode("companion")}
                  className="inline-flex items-center space-x-2 rounded-full bg-teal-500 hover:bg-teal-400 hover:scale-105 duration-200 text-slate-950 px-4.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Launch Child Companion</span>
                </button>
                <button
                  onClick={() => setViewMode("public")}
                  className="inline-flex items-center space-x-2 rounded-full border border-slate-200 dark:border-slate-800 px-4.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer bg-white/50 backdrop-blur-sm"
                  id="view-public-site-btn"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>View Public Site</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              onClick={() => setIsDarkMode(true)}
              className="hidden"
              id="mobile-theme-toggle"
            >
              <Sun className="h-5 w-5 text-amber-400" />
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              id="mobile-menu-toggle"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden border-t bg-white dark:bg-slate-950 px-4 py-4 space-y-3 shadow-lg">
          {viewMode === "public" ? (
            <div className="flex flex-col space-y-2.5">
              <button
                onClick={() => {
                  scrollToSection("features");
                  setIsOpen(false);
                }}
                className="text-left py-2 text-base font-medium text-slate-700 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400"
              >
                Features
              </button>
              <button
                onClick={() => {
                  scrollToSection("ai-features");
                  setIsOpen(false);
                }}
                className="text-left py-2 text-base font-medium text-slate-700 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400"
              >
                Advanced AI
              </button>
              <button
                onClick={() => {
                  scrollToSection("testimonials");
                  setIsOpen(false);
                }}
                className="text-left py-2 text-base font-medium text-slate-700 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400"
              >
                Testimonials
              </button>
              <button
                onClick={() => {
                  scrollToSection("faq");
                  setIsOpen(false);
                }}
                className="text-left py-2 text-base font-medium text-slate-700 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400"
              >
                FAQ
              </button>
              <button
                onClick={() => {
                  setViewMode("dashboard");
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 rounded-full bg-slate-900 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Enter Parent Dashboard</span>
              </button>
            </div>
          ) : viewMode === "companion" ? (
            <div className="flex flex-col space-y-2.5">
              <div className="py-2 text-xs font-mono text-teal-400 uppercase tracking-widest font-bold">
                Companion App Simulator
              </div>
              <button
                onClick={() => {
                  setViewMode("dashboard");
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 rounded-full bg-slate-900 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Return to Parent Dashboard</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col space-y-2.5">
              <div className="py-2 text-xs font-medium text-blue-600 dark:text-teal-400">
                Connected Parent Session
              </div>
              <button
                onClick={() => {
                  setViewMode("companion");
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 rounded-full bg-teal-500 py-3 text-sm font-semibold text-slate-950 hover:opacity-95"
              >
                <Smartphone className="h-4 w-4" />
                <span>Launch Child Companion</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("public");
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Globe className="h-4 w-4" />
                <span>View Public Site</span>
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
