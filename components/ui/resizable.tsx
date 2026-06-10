"use client"

import { GripHorizontal } from "lucide-react"
import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) {
  return (
    <Separator
      className={cn(
        "relative flex w-px items-center justify-center bg-white/[0.07] transition-colors hover:bg-white/[0.12] data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1f8a65]",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-5 w-10 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.14] transition-colors cursor-row-resize">
          <GripHorizontal size={12} className="text-white/40" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
