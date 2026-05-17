import { Link } from "react-router-dom";
import { Sparkles, Timer } from "lucide-react";

export default function TimerSelection() {
  return (
    <main className="min-h-screen pt-32 pb-20 px-4 md:px-margin-desktop flex items-center justify-center relative z-10">
      <div className="w-full max-w-[480px]">
        
        <div className="bg-[#141A28] border border-white/5 rounded-[2.5rem] p-10 md:p-14 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[300px] bg-blue-500/10 blur-[100px] pointer-events-none rounded-full" />
          
          <h2 className="text-3xl font-semibold text-white tracking-wide relative z-10 mb-10">Choose your timer</h2>
          
          <div className="flex flex-col gap-4 w-full relative z-10">
            <Link 
              to="/timer/default"
              className="w-full bg-[#2563EB] hover:bg-blue-500 text-white font-medium py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2"
            >
              <Timer className="w-5 h-5" />
              Default Timer
            </Link>
            
            <Link 
              to="/timer/custom"
              className="w-full bg-[#1E2638] hover:bg-[#2A344A] border border-white/5 text-slate-300 hover:text-white font-medium py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Custom Timer
            </Link>
          </div>

        </div>

      </div>
    </main>
  );
}
