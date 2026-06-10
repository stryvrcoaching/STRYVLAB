// ============================================================
// lib/formulas/validators.ts
// Input validation for all calculator formulas
// ============================================================

import {
  ValidationError,
  ValidationResult,
  INPUT_RANGES,
  GENDER_VALUES,
  ACTIVITY_LEVELS,
} from "./types";

/**
 * Generic validator for numeric ranges
 */
function validateRange(
  value: any,
  fieldName: string,
  min: number,
  max: number,
): ValidationError | null {
  const num = Number(value);

  if (isNaN(num)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a number`,
      value,
    };
  }

  if (num < min || num > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be between ${min} and ${max}`,
      value,
    };
  }

  return null;
}

/**
 * Validate inputs for Brzycki 1RM calculation
 */
export function validateBrzycki1RM(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Weight validation
  const weightError = validateRange(
    input.weight,
    "weight",
    INPUT_RANGES.WEIGHT.min,
    INPUT_RANGES.WEIGHT.max,
  );
  if (weightError) errors.push(weightError);

  // Reps validation
  const repsError = validateRange(
    input.reps,
    "reps",
    INPUT_RANGES.REPS.min,
    37, // Brzycki loses accuracy beyond 37 reps
  );
  if (repsError) errors.push(repsError);

  // Optional: equipment validation
  if (
    input.equipment &&
    !["barbell", "dumbbell", "machine"].includes(input.equipment)
  ) {
    errors.push({
      field: "equipment",
      message: "equipment must be one of: barbell, dumbbell, machine",
      value: input.equipment,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate inputs for Karvonen HR zones calculation
 */
export function validateKarvonen(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Age validation
  const ageError = validateRange(
    input.age,
    "age",
    INPUT_RANGES.AGE.min,
    INPUT_RANGES.AGE.max,
  );
  if (ageError) errors.push(ageError);

  // Optional: resting HR validation
  if (input.restingHeartRate !== undefined && input.restingHeartRate !== null) {
    const rhError = validateRange(
      input.restingHeartRate,
      "restingHeartRate",
      INPUT_RANGES.HEART_RATE.min,
      INPUT_RANGES.HEART_RATE.max,
    );
    if (rhError) errors.push(rhError);

    // Resting HR should be less than max HR (220 - age)
    const estimatedMaxHR = 220 - Number(input.age);
    if (Number(input.restingHeartRate) >= estimatedMaxHR) {
      errors.push({
        field: "restingHeartRate",
        message: `Resting HR (${input.restingHeartRate}) cannot be >= max HR (${estimatedMaxHR})`,
        value: input.restingHeartRate,
      });
    }
  }

  // Optional: target zone validation
  if (
    input.targetZone &&
    !["Z1", "Z2", "Z3", "Z4", "Z5"].includes(input.targetZone)
  ) {
    errors.push({
      field: "targetZone",
      message: "targetZone must be one of: Z1, Z2, Z3, Z4, Z5",
      value: input.targetZone,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate inputs for Macros calculation
 */
export function validateMacros(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Weight validation
  const weightError = validateRange(
    input.weight,
    "weight",
    INPUT_RANGES.WEIGHT.min,
    INPUT_RANGES.WEIGHT.max,
  );
  if (weightError) errors.push(weightError);

  // Height validation
  const heightError = validateRange(
    input.height,
    "height",
    INPUT_RANGES.HEIGHT.min,
    INPUT_RANGES.HEIGHT.max,
  );
  if (heightError) errors.push(heightError);

  // Age validation
  const ageError = validateRange(
    input.age,
    "age",
    INPUT_RANGES.AGE.min,
    INPUT_RANGES.AGE.max,
  );
  if (ageError) errors.push(ageError);

  // Gender validation
  if (!GENDER_VALUES.includes(input.gender)) {
    errors.push({
      field: "gender",
      message: `gender must be one of: ${GENDER_VALUES.join(", ")}`,
      value: input.gender,
    });
  }

  // Optional: Body fat validation
  if (input.bodyFat !== undefined && input.bodyFat !== null) {
    const bfError = validateRange(
      input.bodyFat,
      "bodyFat",
      INPUT_RANGES.BODY_FAT.min,
      INPUT_RANGES.BODY_FAT.max,
    );
    if (bfError) errors.push(bfError);
  }

  // Optional: Daily steps validation
  if (input.dailySteps !== undefined && input.dailySteps !== null) {
    const stepsNum = Number(input.dailySteps);
    if (isNaN(stepsNum) || stepsNum < 0 || stepsNum > 100000) {
      errors.push({
        field: "dailySteps",
        message: "dailySteps must be between 0 and 100,000",
        value: input.dailySteps,
      });
    }
  }

  // Optional: Weekly workouts validation
  if (input.weeklyWorkouts !== undefined && input.weeklyWorkouts !== null) {
    const workoutsError = validateRange(
      input.weeklyWorkouts,
      "weeklyWorkouts",
      0,
      7,
    );
    if (workoutsError) errors.push(workoutsError);
  }

  // Optional: Goal validation
  if (
    input.goal &&
    !["maintenance", "deficit", "surplus"].includes(input.goal)
  ) {
    errors.push({
      field: "goal",
      message: "goal must be one of: maintenance, deficit, surplus",
      value: input.goal,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate inputs for Body Fat calculation
 */
export function validateBodyFat(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Method validation
  const validMethods = [
    "jackson_pollock_3",
    "jackson_pollock_7",
    "boer",
    "manual",
  ];
  if (!validMethods.includes(input.method)) {
    errors.push({
      field: "method",
      message: `method must be one of: ${validMethods.join(", ")}`,
      value: input.method,
    });
  }

  // Gender validation
  if (!GENDER_VALUES.includes(input.gender)) {
    errors.push({
      field: "gender",
      message: `gender must be one of: ${GENDER_VALUES.join(", ")}`,
      value: input.gender,
    });
  }

  // Age validation
  const ageError = validateRange(
    input.age,
    "age",
    INPUT_RANGES.AGE.min,
    INPUT_RANGES.AGE.max,
  );
  if (ageError) errors.push(ageError);

  // For Jackson-Pollock methods, validate measurements
  if (
    input.method === "jackson_pollock_3" ||
    input.method === "jackson_pollock_7"
  ) {
    if (!input.chest || !input.abdominal || !input.thigh) {
      errors.push({
        field: "measurements",
        message:
          "Jackson-Pollock 3-site requires chest, abdominal, and thigh measurements",
        value: null,
      });
    }

    if (input.method === "jackson_pollock_7") {
      if (!input.triceps || !input.suprailiac || !input.midaxilla) {
        errors.push({
          field: "measurements",
          message: "Jackson-Pollock 7-site requires all measurements",
          value: null,
        });
      }
    }
  }

  // For manual method, validate body fat percentage
  if (input.method === "manual") {
    const bfError = validateRange(
      input.bodyFatPercentage,
      "bodyFatPercentage",
      INPUT_RANGES.BODY_FAT.min,
      INPUT_RANGES.BODY_FAT.max,
    );
    if (bfError) errors.push(bfError);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate inputs for Water Intake calculation
 */
export function validateWaterIntake(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Weight validation
  const weightError = validateRange(
    input.weight,
    "weight",
    INPUT_RANGES.WEIGHT.min,
    INPUT_RANGES.WEIGHT.max,
  );
  if (weightError) errors.push(weightError);

  // Activity level validation
  if (!ACTIVITY_LEVELS.includes(input.activityLevel)) {
    errors.push({
      field: "activityLevel",
      message: `activityLevel must be one of: ${ACTIVITY_LEVELS.join(", ")}`,
      value: input.activityLevel,
    });
  }

  // Optional: Climate validation
  if (input.climate && !["temperate", "hot", "cold"].includes(input.climate)) {
    errors.push({
      field: "climate",
      message: "climate must be one of: temperate, hot, cold",
      value: input.climate,
    });
  }

  // Optional: Workouts per week validation
  if (input.workoutsPerWeek !== undefined && input.workoutsPerWeek !== null) {
    const woError = validateRange(
      input.workoutsPerWeek,
      "workoutsPerWeek",
      0,
      7,
    );
    if (woError) errors.push(woError);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate inputs for BMI calculation
 */
export function validateBMI(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Weight validation
  const weightError = validateRange(
    input.weight,
    "weight",
    INPUT_RANGES.WEIGHT.min,
    INPUT_RANGES.WEIGHT.max,
  );
  if (weightError) errors.push(weightError);

  // Height validation
  const heightError = validateRange(
    input.height,
    "height",
    INPUT_RANGES.HEIGHT.min,
    INPUT_RANGES.HEIGHT.max,
  );
  if (heightError) errors.push(heightError);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate inputs for Intensity Heart Rate calculation
 */
export function validateIntensityHeartRate(input: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Age validation
  const ageError = validateRange(
    input.age,
    "age",
    INPUT_RANGES.AGE.min,
    INPUT_RANGES.AGE.max,
  );
  if (ageError) errors.push(ageError);

  // Resting HR validation
  const rhError = validateRange(
    input.restingHeartRate,
    "restingHeartRate",
    INPUT_RANGES.HEART_RATE.min,
    INPUT_RANGES.HEART_RATE.max,
  );
  if (rhError) errors.push(rhError);

  // Intensity validation
  const intError = validateRange(
    input.intensityPercentage,
    "intensityPercentage",
    INPUT_RANGES.INTENSITY.min,
    INPUT_RANGES.INTENSITY.max,
  );
  if (intError) errors.push(intError);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Throw ValidationError if validation fails
 */
export function throwIfInvalid(
  result: ValidationResult,
  calculatorName: string,
): void {
  if (!result.isValid) {
    const errorMessages = result.errors
      .map((e) => `${e.field}: ${e.message}`)
      .join("; ");
    throw new Error(`${calculatorName} validation failed: ${errorMessages}`);
  }
}
