import { createContext, useState } from "react";

const TimerStateContext = createContext(null);

const readTimerStorage = (storageKey, fallbackState) => {
  if (!storageKey) {
    return fallbackState;
  }

  try {
    const savedState = window.localStorage.getItem(storageKey);

    if (!savedState) {
      return fallbackState;
    }

    return {
      ...fallbackState,
      ...JSON.parse(savedState),
    };
  } catch (error) {
    console.error(error);
    return fallbackState;
  }
};

function TimerStateProvider({ children }) {
  const [timerStates, setTimerStates] = useState({});

  const getTimerState = (storageKey, fallbackState) => {
    if (!storageKey) {
      return fallbackState;
    }

    return timerStates[storageKey] ?? readTimerStorage(storageKey, fallbackState);
  };

  const updateTimerState = (storageKey, updater, fallbackState) => {
    if (!storageKey) {
      return;
    }

    setTimerStates((currentStates) => {
      const currentState = currentStates[storageKey] ?? readTimerStorage(storageKey, fallbackState);
      const nextState =
        typeof updater === "function" ? updater(currentState) : { ...currentState, ...updater };

      window.localStorage.setItem(storageKey, JSON.stringify(nextState));

      return {
        ...currentStates,
        [storageKey]: nextState,
      };
    });
  };

  const value = {
    getTimerState,
    updateTimerState,
  };

  return <TimerStateContext.Provider value={value}>{children}</TimerStateContext.Provider>;
}

export { TimerStateContext, TimerStateProvider };
