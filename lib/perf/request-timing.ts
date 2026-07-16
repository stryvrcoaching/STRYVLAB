import { NextResponse } from "next/server"

type TimingStep = {
  name: string
  durationMs: number
}

function roundDuration(value: number) {
  return Math.max(0, Math.round(value * 10) / 10)
}

export class RequestTiming {
  private readonly startedAt = Date.now()
  private lastAt = this.startedAt
  private readonly steps: TimingStep[] = []

  checkpoint(name: string) {
    const now = Date.now()
    this.steps.push({
      name,
      durationMs: now - this.lastAt,
    })
    this.lastAt = now
  }

  totalMs() {
    return Date.now() - this.startedAt
  }

  toServerTiming() {
    return [
      ...this.steps.map((step) => `${step.name};dur=${roundDuration(step.durationMs)}`),
      `total;dur=${roundDuration(this.totalMs())}`,
    ].join(", ")
  }

  toSummary() {
    return {
      totalMs: roundDuration(this.totalMs()),
      steps: this.steps.map((step) => ({
        name: step.name,
        durationMs: roundDuration(step.durationMs),
      })),
    }
  }
}

export function jsonWithRequestTiming(
  timing: RequestTiming,
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init)
  response.headers.set("Server-Timing", timing.toServerTiming())
  response.headers.set("X-Stryv-Perf", JSON.stringify(timing.toSummary()))
  return response
}
