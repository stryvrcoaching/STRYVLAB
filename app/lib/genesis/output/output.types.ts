export type Mode = 'ipt'|'gplus'|'omni';

export interface OutputBase {
  mode: Mode;
  scoring_version: string;
  ipt_global: number;
  axes: Record<string, { normalized: number }>;
  patterns: any[];
}

export interface IPTOutput extends OutputBase {
  constraints: string[];
  levers: string[];
  plan_7_days: Array<{ day: number; actions: string[] }>;
}

export interface GPlusOutput extends OutputBase {
  nutrition_timing: string[];
  parameters: Record<string, any>;
}

export interface OmniOutput extends OutputBase {
  roadmap: Array<{ phase: string; focus: string[]; checkpoints: string[] }>;
}

export type GenesisOutput = IPTOutput | GPlusOutput | OmniOutput;
