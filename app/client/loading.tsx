export default function ClientLoading() {
  return (
    <div
      className="min-h-dvh bg-[#0d0d0d] px-4 pt-5"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 20px)",
        paddingBottom: "calc(var(--client-bottom-nav-reserved) + 32px)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
        <div className="h-6 w-32 animate-pulse rounded-full bg-white/[0.08]" />
        <div className="h-28 animate-pulse rounded-[24px] bg-white/[0.05]" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
        <div className="h-40 animate-pulse rounded-[24px] bg-white/[0.04]" />
        <div className="h-32 animate-pulse rounded-[24px] bg-white/[0.04]" />
      </div>
    </div>
  )
}
