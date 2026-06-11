import { useEffect, useState } from "react";

const HELP_VIEWED_KEY = "democracy.helpViewed";

export function useHelpTracking() {
  const [viewedTopics, setViewedTopics] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(HELP_VIEWED_KEY);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  const markViewed = (topicId: string) => {
    setViewedTopics((prev) => {
      const updated = new Set(prev);
      updated.add(topicId);
      localStorage.setItem(HELP_VIEWED_KEY, JSON.stringify([...updated]));
      return updated;
    });
  };

  const hasViewed = (topicId: string): boolean => {
    return viewedTopics.has(topicId);
  };

  const getViewedCount = (): number => {
    return viewedTopics.size;
  };

  const getViewedTopics = (): string[] => {
    return [...viewedTopics];
  };

  return {
    viewedTopics,
    markViewed,
    hasViewed,
    getViewedCount,
    getViewedTopics
  };
}

// Singleton instance for global help state
let globalHelpTracking: ReturnType<typeof useHelpTracking> | null = null;

export function initializeHelpTracking() {
  try {
    const stored = localStorage.getItem(HELP_VIEWED_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

export function markHelpViewedGlobal(topicId: string) {
  try {
    const viewed = new Set(
      JSON.parse(localStorage.getItem(HELP_VIEWED_KEY) || "[]")
    );
    viewed.add(topicId);
    localStorage.setItem(HELP_VIEWED_KEY, JSON.stringify([...viewed]));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function getHelpViewedGlobal(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HELP_VIEWED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function getHelpViewedCountGlobal(): number {
  return getHelpViewedGlobal().size;
}
