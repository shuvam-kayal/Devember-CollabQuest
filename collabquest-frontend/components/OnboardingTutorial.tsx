"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Users,
  Search,
  MessageSquare,
  Zap,
  CheckCircle,
  X,
  Star,
  Clock,
} from "lucide-react";
import api from "@/lib/api";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string;
  selectorId?: string; // ID of the element to highlight on the page
}

export default function OnboardingTutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [highlightPos, setHighlightPos] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const searchParams = useSearchParams();
  const forceShowOnboarding = searchParams.get("showOnboarding") === "true";

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: "Welcome to CollabQuest!",
      description:
        "Find teammates and collaborate on exciting projects. Let's get you started with a quick tour.",
      icon: <Zap className="w-12 h-12 text-blue-400" />,
    },
    {
      id: 2,
      title: "Find Your Dream Team",
      description:
        "Use the Find Team feature to discover teammates with matching skills and interests. Browse profiles and connect with collaborators.",
      icon: <Search className="w-12 h-12 text-purple-400" />,
      highlight: "find-team",
      selectorId: "onboarding-find-team",
    },
    {
      id: 3,
      title: "Manage Your Projects",
      description:
        "Create and manage your projects in the Projects section. Define your team structure, set milestones, and track progress.",
      icon: <Users className="w-12 h-12 text-green-400" />,
      highlight: "myproject",
      selectorId: "onboarding-projects",
    },
    {
      id: 4,
      title: "Communicate & Collaborate",
      description:
        "Use the Chat feature to communicate with your team members. Stay connected and share ideas in real-time.",
      icon: <MessageSquare className="w-12 h-12 text-pink-400" />,
      highlight: "chat",
      selectorId: "onboarding-chat",
    },
    {
      id: 5,
      title: "Save Your Favorites",
      description:
        "Use the Saved feature to bookmark teams and projects you're interested in. Build your personalized collection of favorites.",
      icon: <Star className="w-12 h-12 text-yellow-400" />,
      highlight: "saved",
      selectorId: "onboarding-saved",
    },
    {
      id: 6,
      title: "Track Your Activity",
      description:
        "Check your History to see all your past interactions, applications, and collaborations. Keep track of your journey on CollabQuest.",
      icon: <Clock className="w-12 h-12 text-orange-400" />,
      highlight: "history",
      selectorId: "onboarding-history",
    },
    {
      id: 7,
      title: "You're All Set!",
      description:
        "You now have access to all CollabQuest features. Start exploring, find amazing teammates, and build incredible projects together!",
      icon: <CheckCircle className="w-12 h-12 text-emerald-400" />,
    },
  ];

  useEffect(() => {
    // Check if user has already completed onboarding
    const checkOnboarding = async () => {
      try {
        const response = await api.get("/auth/profile");
        // Show tutorial if:
        // 1. User hasn't completed onboarding OR
        // 2. Developer has ?showOnboarding=true in URL (for testing)
        if (!response.data.is_onboarded || forceShowOnboarding) {
          setIsVisible(true);
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      }
    };

    checkOnboarding();
  }, [forceShowOnboarding]);

  // Update highlight position when step changes
  useEffect(() => {
    const updateHighlightPosition = () => {
      const step = steps[currentStep];
      if (step?.selectorId) {
        const element = document.getElementById(step.selectorId);
        if (element) {
          const rect = element.getBoundingClientRect();
          setHighlightPos({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          });
        } else {
          setHighlightPos(null);
        }
      } else {
        setHighlightPos(null);
      }
    };

    updateHighlightPosition();
    window.addEventListener("resize", updateHighlightPosition);
    return () => window.removeEventListener("resize", updateHighlightPosition);
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await api.post("/auth/complete-onboarding");
      setIsVisible(false);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSkip = async () => {
    setIsCompleting(true);
    try {
      await api.post("/auth/complete-onboarding");
      setIsVisible(false);
    } catch (error) {
      console.error("Error skipping onboarding:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Spotlight Overlay */}
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: highlightPos
                ? `radial-gradient(circle ${Math.max(
                    highlightPos.width,
                    highlightPos.height
                  ) / 2 + 40}px at ${highlightPos.x +
                    highlightPos.width / 2}px ${highlightPos.y +
                    highlightPos.height / 2}px, transparent 0%, rgba(0, 0, 0, 0.85) 100%)`
                : "rgba(0, 0, 0, 0.85)",
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4 border border-slate-700 pointer-events-auto"
            >
            {/* Header */}
            <div className="relative h-2 bg-slate-700 rounded-t-xl overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
              />
            </div>

            {/* Close Button */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="p-8">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center"
              >
                <div className="flex justify-center mb-6">{step.icon}</div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  {step.title}
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  {step.description}
                </p>
              </motion.div>

              {/* Step Indicator */}
              <div className="flex justify-center gap-2 my-6">
                {steps.map((s, index) => (
                  <motion.div
                    key={s.id}
                    className={`h-2 rounded-full transition-all ${
                      index === currentStep
                        ? "bg-blue-500 w-6"
                        : index < currentStep
                          ? "bg-green-500 w-2"
                          : "bg-slate-600 w-2"
                    }`}
                  />
                ))}
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3 mt-8">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrev}
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                  >
                    Back
                  </button>
                )}
                {currentStep < steps.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all flex items-center justify-center gap-2"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleComplete}
                    disabled={isCompleting}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCompleting ? "Starting..." : "Get Started"}
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Skip Link */}
              <button
                onClick={handleSkip}
                className="w-full mt-3 text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                Skip tutorial
              </button>
            </div>
            </motion.div>
          </motion.div>

          {/* Highlighted Element Border */}
          {highlightPos && (
            <motion.div
              className="fixed border-2 border-cyan-400 rounded-lg pointer-events-none z-50"
              style={{
                left: highlightPos.x - 8,
                top: highlightPos.y - 8,
                width: highlightPos.width + 16,
                height: highlightPos.height + 16,
              }}
              animate={{
                boxShadow: [
                  "0 0 0 2px rgba(34, 211, 238, 0.3), 0 0 20px rgba(34, 211, 238, 0.5)",
                  "0 0 0 8px rgba(34, 211, 238, 0.2), 0 0 30px rgba(34, 211, 238, 0.7)",
                  "0 0 0 2px rgba(34, 211, 238, 0.3), 0 0 20px rgba(34, 211, 238, 0.5)",
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            />
          )}
        </>      )}
    </AnimatePresence>
  );
}