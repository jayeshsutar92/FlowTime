import { useContext } from "react";
import { TimerStateContext } from "./TimerStateContext";

function useTimerStateContext() {
  const context = useContext(TimerStateContext);

  if (!context) {
    throw new Error("useTimerStateContext must be used within TimerStateProvider");
  }

  return context;
}

export default useTimerStateContext;
