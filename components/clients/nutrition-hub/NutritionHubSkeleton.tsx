"use client";

import { Skeleton } from "@/components/ui/skeleton";

function HeroMetricSkeleton() {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.05] p-4">
      <Skeleton className="h-3 w-20 rounded" />
      <Skeleton className="mt-4 h-8 w-20 rounded" />
      <Skeleton className="mt-3 h-3 w-full rounded" />
      <Skeleton className="mt-2 h-3 w-4/5 rounded" />
    </div>
  );
}

function TrendCardSkeleton() {
  return (
    <div className="rounded-[26px] border border-white/[0.07] bg-[#181818] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <Skeleton className="h-3 w-20 rounded" />
      <Skeleton className="mt-4 h-9 w-56 rounded" />
      <Skeleton className="mt-4 h-3 w-full rounded" />
      <Skeleton className="mt-2 h-3 w-4/5 rounded" />
      <Skeleton className="mt-6 h-64 w-full rounded-[20px]" />
    </div>
  );
}

function RailCardSkeleton() {
  return (
    <div className="rounded-[26px] border border-white/[0.07] bg-[#181818] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="mt-3 h-6 w-44 rounded" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="mt-5 space-y-3">
        <Skeleton className="h-24 w-full rounded-[22px]" />
        <Skeleton className="h-24 w-full rounded-[22px]" />
      </div>
    </div>
  );
}

function AgendaRowSkeleton() {
  return (
    <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.03] px-4 py-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="min-w-[96px]">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="mt-2 h-3 w-16 rounded" />
            </div>
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:min-w-[760px]">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index}>
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
                <Skeleton className="mt-2 h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NutritionHubSkeleton() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/[0.07] bg-[#181818] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="mt-3 h-7 w-52 rounded" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-16 rounded-full" />
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 rounded-xl" />
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="grid gap-4 xl:grid-cols-2">
            <TrendCardSkeleton />
            <TrendCardSkeleton />
            <TrendCardSkeleton />
            <TrendCardSkeleton />
          </div>
          <div className="space-y-4">
            <RailCardSkeleton />
            <RailCardSkeleton />
          </div>
        </div>

        <div className="mt-4 rounded-[28px] border border-white/[0.07] bg-[#181818] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <Skeleton className="h-3 w-36 rounded" />
              <Skeleton className="mt-3 h-7 w-44 rounded" />
            </div>
            <Skeleton className="h-4 w-72 rounded" />
          </div>

          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <AgendaRowSkeleton key={index} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
