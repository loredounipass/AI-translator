import React from "react";

interface GlassTooltipProps {
  label: string;
  children: React.ReactNode;
}

// GLASS TOOLTIP: floating label shown on hover, styled with the app's glass palette
const GlassTooltip = ({ label, children }: GlassTooltipProps) => (
  <div className="relative group flex items-center shrink-0">
    {children}
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
      <div className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-[#161b22]/95 backdrop-blur-xl border border-white/60 dark:border-[#30363d] shadow-lg shadow-black/10">
        {label}
      </div>
      <div className="w-2 h-2 rotate-45 mx-auto -mt-1 bg-white/80 dark:bg-[#161b22]/95 border-r border-b border-white/60 dark:border-[#30363d]" />
    </div>
  </div>
);

export default GlassTooltip;
