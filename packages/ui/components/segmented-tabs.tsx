"use client";

import React from "react";

export interface TabItem<T extends string = string> {
  key: T;
  label: string;
  icon?: React.ReactNode;
  desc?: string;
}

interface SegmentedTabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "emerald";
  className?: string;
}

export function SegmentedTabs<T extends string = string>({
  items,
  value,
  onChange,
  size = "md",
  variant = "primary",
  className = "",
}: SegmentedTabsProps<T>) {
  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-1.5 text-xs font-semibold",
    lg: "px-4 py-2 text-sm font-semibold",
  };

  const activeVariantClasses = {
    primary: "segmented-tab-active-primary bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30 scale-[1.02]",
    emerald: "segmented-tab-active-emerald bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/30 scale-[1.02]",
  };

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-xl bg-default-100/90 dark:bg-default-100/40 border border-default-200/60 dark:border-white/10 backdrop-blur-md shadow-inner flex-wrap ${className}`}
    >
      {items.map((item) => {
        const isSelected = value === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            title={item.desc}
            style={
              isSelected
                ? {
                    backgroundColor: variant === "emerald" ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)",
                    color: variant === "emerald" ? "#34d399" : "#60a5fa",
                    border: variant === "emerald" ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(59, 130, 246, 0.35)",
                    fontWeight: 700,
                    boxShadow: variant === "emerald" ? "0 2px 8px rgba(16, 185, 129, 0.15)" : "0 2px 8px rgba(59, 130, 246, 0.15)",
                  }
                : undefined
            }
            className={`
              flex items-center gap-1.5 rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap
              ${sizeClasses[size]}
              ${
                isSelected
                  ? activeVariantClasses[variant]
                  : "text-default-600 dark:text-default-400 font-medium hover:text-foreground hover:bg-default-200/50 dark:hover:bg-white/10"
              }
            `}
          >
            {React.isValidElement(item.icon)
              ? item.icon
              : typeof item.icon === "function" || (typeof item.icon === "object" && item.icon !== null)
              ? React.createElement(item.icon as any, { className: "w-3.5 h-3.5 inline-block shrink-0" })
              : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
