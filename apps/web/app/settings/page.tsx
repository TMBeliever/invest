"use client";

import { Settings, Server, Database, Moon, Bell, Shield } from "lucide-react";
import { useConfigStore } from "@investscope/core";
import { SegmentedTabs } from "@investscope/ui";

export default function SettingsPage() {
  const { theme, setTheme } = useConfigStore();

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          系统设置
        </h1>
        <p className="text-sm text-default-400 mt-1">数据源配置 · 主题外观 · 通知提醒</p>
      </div>

      <div className="space-y-6">
        {/* 数据源设置 */}
        <div className="glass-panel p-6 animate-fade-in">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            后端服务与数据源
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-default-400 mb-1.5">
                FastAPI 后端服务连接
              </label>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-default-50 border border-divider/40 max-w-md">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-foreground block">自动同源反向代理 (Auto Rewrites Proxy)</span>
                  <span className="text-[10px] text-default-400 block">请求统一走同源 /api 路由，无需手动配置服务器 IP</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">运行中</span>
              </div>
            </div>

            <div className="pt-3 border-t border-divider">
              <div className="text-xs font-medium mb-2">数据源状态</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-default-50 flex items-center justify-between">
                  <span className="text-xs">AKShare (主力)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">已就绪</span>
                </div>
                <div className="p-3 rounded-xl bg-default-50 flex items-center justify-between">
                  <span className="text-xs">Baostock (历史)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">已就绪</span>
                </div>
                <div className="p-3 rounded-xl bg-default-50 flex items-center justify-between">
                  <span className="text-xs">Tushare Pro (备用)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-default-100 text-default-400 font-medium">未设置 Token</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 主题设置 */}
        <div className="glass-panel p-6 animate-fade-in">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Moon className="w-5 h-5 text-violet-400" />
            外观与界面
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">主题风格</div>
              <div className="text-xs text-default-400 mt-0.5">选择你偏好的系统颜色模式</div>
            </div>
            <SegmentedTabs
              items={[
                { key: "dark", label: "🌙 深色" },
                { key: "light", label: "☀️ 浅色" },
                { key: "system", label: "💻 跟随系统" },
              ]}
              value={theme}
              onChange={(val) => setTheme(val as any)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
