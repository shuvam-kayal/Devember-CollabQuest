"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Users,
  Search,
  MessageSquare,
  Zap,
  CheckCircle,
  X,
} from "lucide-react";
import api from "@/lib/api";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string;
}

export default function OnboardingTutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

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
    },
    {
      id: 3,
      title: "Manage Your Projects",
      description:
        "Create and manage your projects in the Projects section. Define your team structure, set milestones, and track progress.",
      icon: <Users className="w-12 h-12 text-green-400" />,
      highlight: "myproject",
    },
    {
      id: 4,
      title: "Communicate & Collaborate",
      description:
        "Use the Chat feature to communicate with your team members. Stay connected and share ideas in real-time.",
      icon: <MessageSquare className="w-12 h-12 text-pink-400" />,
      highlight: "chat",
    },
    {
      id: 5,
      title: "You're All Set!",
      description:
        "You now have access to all CollabQuest features. Start exploring and find amazing teammates to build with!",
      icon: <CheckCircle className="w-12 h-12 text-emerald-400" />,
    },
  ];

  useEffect(() => {
    // Check if user has already completed onboarding
    const checkOnboarding = async () => {
      try {
        const response = await api.get("/auth/profile");
        if (!response.data.is_onboarded) {
          setIsVisible(true);
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      }
    };

    checkOnboarding();
  }, []);

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4 border border-slate-700"
          >
            {/* Header */}
            <div className="relative h-2 bg-slate-700 rounded-t-xl overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
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
                {steps.map((_, index) => (
                  <motion.div
                    key={index}
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
      )}
    </AnimatePresence>
  );
}
