"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Thermometer,
  Briefcase,
  BarChart3,
  Settings,
  Sun,
  Moon,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/dividend", label: "红利测温", icon: Thermometer },
  { href: "/market", label: "市场总览", icon: BarChart3 },
  { href: "/portfolio", label: "组合管理", icon: Briefcase },
  { href: "/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside
      className={`
        relative flex flex-col h-screen border-r border-divider
        bg-content1/50 backdrop-blur-xl transition-all duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-[260px]"}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-5 h-[56px] border-b border-divider ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold tracking-tight">InvestScope</h1>
            <p className="text-[10px] text-default-400">高胜率投资决策</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200 group
                ${isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-default-500 hover:bg-default-100 hover:text-foreground"
                }
                ${collapsed ? "justify-center px-0" : ""}
              `}
            >
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-primary" : "text-default-400 group-hover:text-foreground"}`} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-divider space-y-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={`
            flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm
            text-default-500 hover:bg-default-100 hover:text-foreground transition-all
            ${collapsed ? "justify-center px-0" : ""}
          `}
        >
          {mounted && (theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />)}
          {!collapsed && <span>{mounted && theme === "dark" ? "浅色模式" : "深色模式"}</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`
            flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm
            text-default-500 hover:bg-default-100 hover:text-foreground transition-all
            ${collapsed ? "justify-center px-0" : ""}
          `}
        >
          {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
          {!collapsed && <span>收起侧栏</span>}
        </button>
      </div>
    </aside>
  );
}
