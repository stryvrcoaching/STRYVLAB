// lib/genesis/questions/csv-parser.ts

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export interface Question {
  id: string;
  module: string;
  dimension: string;
  pattern: string;
  role: string;
  text: string;
  response_type: string;
  options?: string[];
  trigger_condition?: string;
  skip_condition?: string;
  root_cause_link?: string;
  impact_score: number;
  reference?: string;
}

const CSV_FILES = [
  'GENESIS ADAPTIVE QUESTIONNAIRE SYSTEM - 1_PROFIL_INITIAL.csv',
  'GENESIS ADAPTIVE QUESTIONNAIRE SYSTEM - 2_METABOLIQUE_P1.csv',
  'GENESIS ADAPTIVE QUESTIONNAIRE SYSTEM - 3_METABOLIQUE_P2.csv',
  'GENESIS ADAPTIVE QUESTIONNAIRE SYSTEM - 4_STRESS_P3_HPA_AXIS.csv',
  'GENESIS ADAPTIVE QUESTIONNAIRE SYSTEM - 5_SOMMEIL_P4_RECUPERATION.csv',
  'GENESIS ADAPTIVE QUESTIONNAIRE SYSTEM - 6_PSYCHO_ADH_P5_ADHERENCE.csv',
  'GENESIS ADAPTIVE QUESTIONNAIRE SYSTEM - 7_PSYCHO_ADH_P6_FRICTION.csv',
  'GENESIS ADAPTIVE QUESTIONNAIRE SYSTEM - 8_ENVIRONNEMENT_P7_CONTRAINTES.csv',
  'GENESIS ADAPTIVE QUESTIONNAIRE SYSTEM - 9_STIMULUS_P8_TRAINING.csv',
];

function parseCSVFile(filepath: string, module: string): Question[] {
  const content = fs.readFileSync(filepath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((row: any) => {
    const options = row.Options && row.Options !== '—' 
      ? row.Options.split('|').map((opt: string) => opt.trim())
      : undefined;

    return {
      id: row.ID_Question,
      module,
      dimension: row.Dimension || '',
      pattern: row['Pattern(s)'] || '',
      role: row.Rôle || '',
      text: row.Question,
      response_type: row.Type_Réponse,
      options,
      trigger_condition: row.Trigger_Condition !== 'ALWAYS' ? row.Trigger_Condition : undefined,
      skip_condition: row.Skip_Condition !== 'NEVER' ? row.Skip_Condition : undefined,
      root_cause_link: row.Root_Cause_Link || undefined,
      impact_score: parseFloat(row.Impact_Score) || 0,
      reference: row['Référence_Scientifique'] || undefined,
    };
  });
}

export function loadAllQuestions(): Question[] {
  const questionsDir = path.join(process.cwd(), 'data', 'questions');
  const allQuestions: Question[] = [];

  for (const filename of CSV_FILES) {
    const filepath = path.join(questionsDir, filename);
    
    if (!fs.existsSync(filepath)) {
      console.warn(`CSV not found: ${filename}`);
      continue;
    }

    const moduleMatch = filename.match(/_(\d+)_(.+)\.csv$/);
    const module = moduleMatch ? moduleMatch[2] : 'UNKNOWN';

    const questions = parseCSVFile(filepath, module);
    allQuestions.push(...questions);
  }

  console.log(`✅ Loaded ${allQuestions.length} questions from CSV files`);
  return allQuestions;
}

export function evaluateCondition(
  condition: string | undefined,
  responses: Record<string, any>
): boolean {
  if (!condition) return true;
  
  const match = condition.match(/IF\s+([A-Z_0-9]+)\s+([><=!]+)\s+(.+)/i);
  if (!match) return true;
  
  const [, questionId, operator, valueStr] = match;
  const responseValue = responses[questionId];
  
  if (responseValue === undefined) return false;
  
  const targetValue = valueStr.replace(/['"]/g, '');
  const numResponse = parseFloat(responseValue);
  const numTarget = parseFloat(targetValue);
  
  if (!isNaN(numResponse) && !isNaN(numTarget)) {
    switch (operator) {
      case '>=': return numResponse >= numTarget;
      case '<=': return numResponse <= numTarget;
      case '>': return numResponse > numTarget;
      case '<': return numResponse < numTarget;
      case '==':
      case '=': return numResponse === numTarget;
      case '!=': return numResponse !== numTarget;
      default: return true;
    }
  }
  
  switch (operator) {
    case '==':
    case '=': return String(responseValue) === targetValue;
    case '!=': return String(responseValue) !== targetValue;
    default: return true;
  }
}

export function getNextQuestionIndex(
  questions: Question[],
  currentIndex: number,
  responses: Record<string, any>
): number {
  for (let i = currentIndex + 1; i < questions.length; i++) {
    const question = questions[i];
    
    if (question.trigger_condition && !evaluateCondition(question.trigger_condition, responses)) {
      continue;
    }
    
    if (question.skip_condition && evaluateCondition(question.skip_condition, responses)) {
      continue;
    }
    
    return i;
  }
  
  return questions.length;
}

export function getPreviousQuestionIndex(
  questions: Question[],
  currentIndex: number,
  responses: Record<string, any>
): number {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const question = questions[i];
    
    if (question.trigger_condition && !evaluateCondition(question.trigger_condition, responses)) {
      continue;
    }
    
    if (question.skip_condition && evaluateCondition(question.skip_condition, responses)) {
      continue;
    }
    
    return i;
  }
  
  return 0;
}