import { Link } from "react-router-dom";
import { CheckCircle, Timer as TimerIcon, BarChart2, List, Waves } from "lucide-react";

export default function Landing() {
  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="flex justify-between items-center h-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="text-headline-lg-mobile font-headline-lg-mobile font-bold tracking-tighter text-on-surface">FlowTime</div>
          <Link
            to="/auth"
            className="bg-primary hover:bg-blue-500 text-white px-6 py-2 rounded-full font-semibold text-sm hover:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20"
          >
            Start Session
          </Link>
        </div>
      </header>

      <main className="relative pt-16">
        <section className="hero-mesh min-h-[85vh] flex flex-col items-center justify-center text-center px-margin-mobile py-24">
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary font-label-sm text-label-sm mb-8">
            <span className="mr-2">✨</span> NOW IN EARLY ACCESS
          </div>
          <h1 className="font-display-xl text-5xl md:text-7xl lg:text-8xl font-bold max-w-5xl mx-auto mb-8 text-on-surface tracking-tighter leading-[1.1]">
            Turn minutes into <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">real progress</span>
          </h1>
          <p className="text-on-surface-variant text-body-md max-w-xl mx-auto mb-10 opacity-80 leading-relaxed">
            Experience the productivity tool built for deep focus. Simple, powerful, and designed to keep you in the zone without the distractions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/auth" className="bg-primary hover:bg-blue-500 text-white px-8 py-4 rounded-full font-semibold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform">
              Start Yours — Free
            </Link>
            <button className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-full font-semibold border border-white/10 transition-all">
              Watch Demo
            </button>
          </div>
        </section>

        <section className="py-24 border-y border-white/5 bg-surface-container-lowest">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <p className="text-center font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-12 opacity-50">Trusted by modern professionals at</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale contrast-125 mb-24">
              <span className="text-2xl font-bold tracking-widest">LUMINA</span>
              <span className="text-2xl font-bold tracking-widest">VORTEX</span>
              <span className="text-2xl font-bold tracking-widest">NEOCODE</span>
              <span className="text-2xl font-bold tracking-widest">AETHER</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-8 rounded-xl flex flex-col justify-between">
                <p className="text-on-surface-variant italic mb-6">"FlowTime changed how I approach my coding blocks. The precision is unmatched."</p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-bright flex items-center justify-center font-bold text-primary">AM</div>
                  <div>
                    <h4 className="font-bold text-sm">Aarav Mehta</h4>
                    <p className="text-xs text-on-surface-variant">Senior Engineer</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-8 rounded-xl flex flex-col justify-between md:scale-105 border-primary/20 ambient-glow">
                <p className="text-on-surface mb-6 font-medium">"The only tool that actually helps me find my rhythm without cluttering my screen."</p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center font-bold text-white">RS</div>
                  <div>
                    <h4 className="font-bold text-sm">Riya Sharma</h4>
                    <p className="text-xs text-on-surface-variant">Product Designer</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-8 rounded-xl flex flex-col justify-between">
                <p className="text-on-surface-variant italic mb-6">"The analytics provide real insights into my weekly deep work patterns."</p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-bright flex items-center justify-center font-bold text-primary">KL</div>
                  <div>
                    <h4 className="font-bold text-sm">Kevin Low</h4>
                    <p className="text-xs text-on-surface-variant">Data Analyst</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-32 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="text-center mb-20">
            <h2 className="font-headline-lg text-headline-lg mb-4">Everything you need without the noise</h2>
            <p className="text-on-surface-variant opacity-70">Focus on the work that matters with precision-engineered tools.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-8 rounded-xl hover:border-primary/40 transition-all group">
              <TimerIcon className="text-primary-container w-8 h-8 mb-6" />
              <h3 className="font-bold mb-3 text-lg">Focus Sessions</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Timed sprints designed to maximize cognitive throughput and reduce mental fatigue.</p>
            </div>
            <div className="glass-card p-8 rounded-xl hover:border-primary/40 transition-all group">
              <BarChart2 className="text-primary-container w-8 h-8 mb-6" />
              <h3 className="font-bold mb-3 text-lg">Analytics</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Visualize your flow state patterns with minimalist sparklines and heatmaps.</p>
            </div>
            <div className="glass-card p-8 rounded-xl hover:border-primary/40 transition-all group">
              <List className="text-primary-container w-8 h-8 mb-6" />
              <h3 className="font-bold mb-3 text-lg">Presets</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Save custom work-rest intervals for different tasks like deep work or light admin.</p>
            </div>
            <div className="glass-card p-8 rounded-xl hover:border-primary/40 transition-all group">
              <Waves className="text-primary-container w-8 h-8 mb-6" />
              <h3 className="font-bold mb-3 text-lg">Simple Flow</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">A distraction-free interface that fades into the background while you focus.</p>
            </div>
          </div>

          <div className="mt-20 glass-card rounded-2xl overflow-hidden grid md:grid-cols-2">
            <div className="p-12 flex flex-col justify-center">
              <h3 className="font-headline-lg text-headline-lg mb-6 leading-tight">Designed for the high-performance mindset</h3>
              <p className="text-on-surface-variant mb-8 leading-relaxed">FlowTime isn't just a timer. It's a mental framework for achieving more in less time. We remove the clutter so you can reach your peak state faster.</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle className="text-primary w-5 h-5 fill-primary text-background" />
                  No notification pings during sessions
                </li>
                <li className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle className="text-primary w-5 h-5 fill-primary text-background" />
                  Ambient soundscapes (Coffee Shop, Rain)
                </li>
                <li className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle className="text-primary w-5 h-5 fill-primary text-background" />
                  Cross-platform synchronization
                </li>
              </ul>
            </div>
            <div className="bg-surface-container relative min-h-[400px]">
              <div className="absolute inset-0 bg-gradient-to-r from-surface-container to-transparent z-10 hidden md:block"></div>
              <div className="absolute inset-0 bg-primary/5"></div>
            </div>
          </div>
        </section>

        <section className="py-32 px-margin-mobile">
          <div className="max-w-4xl mx-auto glass-card rounded-3xl p-16 text-center ambient-glow border-primary/20 relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full"></div>
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full"></div>
            <h2 className="font-headline-lg text-headline-lg mb-6 relative z-10">Ready to start?</h2>
            <p className="text-on-surface-variant text-body-md mb-10 max-w-md mx-auto opacity-80 relative z-10">Join 15,000+ professionals who are reclaiming their focus today.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
              <Link to="/auth" className="bg-primary hover:bg-blue-500 text-white px-10 py-4 rounded-full font-semibold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform">
                Get Started for Free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full py-12 border-t border-white/5 bg-surface">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto space-y-4 md:space-y-0">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="font-headline-lg-mobile text-on-surface opacity-50">FlowTime</div>
            <p className="text-on-surface-variant text-label-sm font-label-sm opacity-50">© 2026 FlowTime. All rights reserved. Designed for Deep Work.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
