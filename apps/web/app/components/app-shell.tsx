"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@investscope/core";
import { Sidebar } from "./sidebar";
import { AIAssistantDrawer } from "./ai-assistant-drawer";

const PUBLIC_PATHS = ["/login", "/register"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!hydrated) return;
    if (!token && !isPublic) {
      router.replace("/login");
    } else if (token && isPublic) {
      router.replace("/");
    }
  }, [hydrated, token, isPublic, pathname, router]);

  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center text-xs text-default-400">
        正在加载...
      </div>
    );
  }

  if (isPublic) {
    // 已登录用户会被上面的 effect 重定向走，这里避免闪现登录表单
    if (token) return null;
    return <main className="h-screen overflow-y-auto">{children}</main>;
  }

  if (!token) {
    // 等待上面的 effect 跳转到 /login
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 page-content">{children}</main>
      <AIAssistantDrawer />
    </div>
  );
}
