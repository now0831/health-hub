"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { NAV_ITEMS } from "@/lib/nav";

export function Sidebar() {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line px-4 py-3 md:w-52 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:py-6">
      <div className="mr-4 hidden px-3 pb-4 text-lg font-semibold md:block">건강관리</div>
      {/* 현재 경로는 요청 시점에만 알 수 있으므로, 강조 표시 없는 링크를 먼저 보여준다 */}
      <Suspense fallback={<NavLinks pathname={null} />}>
        <ActiveNavLinks />
      </Suspense>
    </nav>
  );
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  const isActive = (href: string) =>
    pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return NAV_ITEMS.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive(item.href) ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-line/50"
      }`}
    >
      {item.label}
    </Link>
  ));
}
