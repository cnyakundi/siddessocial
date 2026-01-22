"use client";

import React from "react";
import Link from "next/link";
import { TrendingUp, Sparkles, Camera, Clock, ArrowRight, X, Shield } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import type { FeedModule } from "@/src/lib/feedModules";
import { dismissFeedModule, undismissFeedModule } from "@/src/lib/feedModules";
import { toast } from "@/src/lib/toast";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function DismissButton({ id }: { id: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissFeedModule(id);
        toast.undo("Hidden card.", () => undismissFeedModule(id));
      }}
      className="absolute top-2 right-2 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-gray-300 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900/20"
      aria-label="Dismiss card"
      title="Dismiss"
    >
      <X size={14} />
    </button>
  );
}

function CardShell({
  side,
  children,
  className,
}: {
  side: SideId;
  children: React.ReactNode;
  className?: string;
}) {
  const theme = SIDE_THEMES[side];
  return (
    <div className={cn("relative group bg-white p-4 lg:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 border-l-2 transition-shadow hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)]", theme.accentBorder, className)}>
      {children}
    </div>
  );
}

export function FeedModuleCard({ module }: { module: FeedModule }) {
  const side = module.side;
  const theme = SIDE_THEMES[side];
  const sideLabel = SIDES[side].label;

  if (module.kind === "public_today") {
    const trends = (module.payload?.trends || []) as Array<{ tag: string; count: string }>;
    return (
      <CardShell side={side} className={cn(theme.lightBg)}>
        <DismissButton id={module.id} />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className={theme.text} />
            <div>
              <div className={cn("text-xs font-bold uppercase tracking-widest", theme.text)}>{module.title}</div>
              <div className="text-xs text-gray-500">{module.subtitle}</div>
            </div>
          </div>
          <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} />
        </div>

        <div className="flex flex-wrap gap-2" role="list" aria-label="Topics">
          {trends.map((t) => (
            <div
              key={t.tag}
              role="listitem"
              className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700"
              title={`${t.tag} (${t.count})`}
            >
              {t.tag} <span className="ml-2 text-[10px] text-gray-400">{t.count}</span>
            </div>
          ))}
        </div>
      </CardShell>
    );
  }

  if (module.kind === "side_health") {
    const stat = (module.payload?.stat || "") as string;
    const label = (module.payload?.label || "") as string;
    const insight = (module.payload?.insight || "") as string;

    return (
      <CardShell side={side} className={cn(theme.lightBg)}>
        <DismissButton id={module.id} />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className={theme.text} />
              <span className={cn("text-xs font-bold uppercase tracking-widest", theme.text)}>{module.title}</span>
            </div>
            <div className="text-3xl font-black text-gray-900 leading-none">{stat}</div>
            <div className="text-xs text-gray-600 mt-1">{label}</div>
            {insight ? <div className="text-xs text-gray-500 mt-2">{insight}</div> : null}
          </div>

          <div className={cn("w-10 h-10 rounded-full bg-white border flex items-center justify-center", theme.border)}>
            <Shield size={18} className={cn("opacity-70", theme.text)} />
          </div>
        </div>
      </CardShell>
    );
  }

  if (module.kind === "set_prompt") {
    const prompt = (module.payload?.prompt || "") as string;
    const cta = (module.payload?.ctaLabel || "Post now") as string;
    const href = `/siddes-compose?prompt=${encodeURIComponent(prompt)}&side=${encodeURIComponent(side)}`;

    return (
      <div className="relative group rounded-[2.5rem] p-5 bg-gray-900 text-white shadow-xl overflow-hidden">
        <DismissButton id={module.id} />
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <Sparkles size={64} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Camera size={16} className="text-yellow-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{module.title}</span>
          </div>

          <h3 className="text-lg font-bold leading-snug mb-4">“{prompt}”</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} />
              <span>{sideLabel} only</span>
            </div>

            <Link
              href={href}
              className="px-4 py-2 rounded-full text-xs font-bold text-gray-900 bg-white hover:bg-gray-100 active:scale-95 transition-transform flex items-center gap-2"
              aria-label={`${cta} in ${sideLabel}`}
            >
              {cta} <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (module.kind === "memory") {
    const time = (module.payload?.time || "On this day") as string;
    const text = (module.payload?.text || "") as string;
    const img = (module.payload?.image || "") as string;

    return (
      <CardShell side={side} className="p-0 overflow-hidden">
        <DismissButton id={module.id} />
        <div className="flex gap-4 p-4">
          <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden border border-gray-100 shrink-0">
            {img ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt="Memory"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover opacity-90"
                />
              </>
            ) : null}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={12} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{time}</span>
            </div>
            <div className="text-sm font-bold text-gray-900 leading-tight">{text}</div>
            <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-2">
              <Shield size={10} /> Only visible in {sideLabel}
            </div>
          </div>
        </div>
      </CardShell>
    );
  }

  if (module.kind === "work_triage") {
    // Unfinished: hide until tasks are real (no dead UI on main paths).
    return null;
  }

  return null;
}
