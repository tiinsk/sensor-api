/**
 * Response comparison utilities for compatibility testing
 *
 * These functions compare responses from old and new APIs to ensure identical behavior
 */

interface ComparisonResult {
  matches: boolean;
  differences?: string[];
}

/**
 * Compare two numbers with tolerance for floating-point precision
 */
export function compareNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  tolerance: number = 0.001
): boolean {
  if (a === null && b === null) return true;
  if (a === undefined && b === undefined) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  return Math.abs(a - b) <= tolerance;
}

/**
 * Compare device responses
 */
export function compareDevices(oldResponse: any, newResponse: any): ComparisonResult {
  const differences: string[] = [];

  // Check basic structure
  if (oldResponse.count !== newResponse.count) {
    differences.push(`count mismatch: old=${oldResponse.count}, new=${newResponse.count}`);
  }
  if (oldResponse.totCount !== newResponse.totCount) {
    differences.push(`totCount mismatch: old=${oldResponse.totCount}, new=${newResponse.totCount}`);
  }
  if (oldResponse.limit !== newResponse.limit) {
    differences.push(`limit mismatch: old=${oldResponse.limit}, new=${newResponse.limit}`);
  }

  // Check device arrays
  const oldDevices = oldResponse.values || [];
  const newDevices = newResponse.values || [];

  if (oldDevices.length !== newDevices.length) {
    differences.push(`Device array length mismatch: old=${oldDevices.length}, new=${newDevices.length}`);
    return { matches: false, differences };
  }

  // Compare each device
  for (let i = 0; i < oldDevices.length; i++) {
    const old = oldDevices[i];
    const newer = newDevices[i];

    if (old.id !== newer.id) {
      differences.push(`Device ${i}: id mismatch (old=${old.id}, new=${newer.id})`);
    }
    if (old.name !== newer.name) {
      differences.push(`Device ${i}: name mismatch (old=${old.name}, new=${newer.name})`);
    }
    if (old.type !== newer.type) {
      differences.push(`Device ${i}: type mismatch (old=${old.type}, new=${newer.type})`);
    }
    if (old.order !== newer.order) {
      differences.push(`Device ${i}: order mismatch (old=${old.order}, new=${newer.order})`);
    }
    if (old.disabled !== newer.disabled) {
      differences.push(`Device ${i}: disabled mismatch (old=${old.disabled}, new=${newer.disabled})`);
    }

    // Compare location
    if (old.location?.x !== newer.location?.x) {
      differences.push(`Device ${i}: location.x mismatch (old=${old.location?.x}, new=${newer.location?.x})`);
    }
    if (old.location?.y !== newer.location?.y) {
      differences.push(`Device ${i}: location.y mismatch (old=${old.location?.y}, new=${newer.location?.y})`);
    }
    if (old.location?.type !== newer.location?.type) {
      differences.push(`Device ${i}: location.type mismatch (old=${old.location?.type}, new=${newer.location?.type})`);
    }
  }

  return {
    matches: differences.length === 0,
    differences: differences.length > 0 ? differences : undefined,
  };
}

/**
 * Compare statistics responses
 */
export function compareStatistics(oldResponse: any, newResponse: any, tolerance: number = 0.001): ComparisonResult {
  const differences: string[] = [];

  // Check basic structure
  if (oldResponse.count !== newResponse.count) {
    differences.push(`count mismatch: old=${oldResponse.count}, new=${newResponse.count}`);
  }
  if (oldResponse.totCount !== newResponse.totCount) {
    differences.push(`totCount mismatch: old=${oldResponse.totCount}, new=${newResponse.totCount}`);
  }

  const oldStats = oldResponse.values || [];
  const newStats = newResponse.values || [];

  if (oldStats.length !== newStats.length) {
    differences.push(`Statistics array length mismatch: old=${oldStats.length}, new=${newStats.length}`);
    return { matches: false, differences };
  }

  // Compare each device's statistics
  for (let i = 0; i < oldStats.length; i++) {
    const old = oldStats[i];
    const newer = newStats[i];

    if (old.id !== newer.id) {
      differences.push(`Stat ${i}: id mismatch (old=${old.id}, new=${newer.id})`);
      continue;
    }

    // Compare temperature stats
    const types = ['temperature', 'humidity', 'pressure'];
    for (const type of types) {
      const oldStat = old.statistics?.[type];
      const newStat = newer.statistics?.[type];

      if (!compareNumbers(oldStat?.avg, newStat?.avg, tolerance)) {
        differences.push(`${old.id} ${type}.avg: old=${oldStat?.avg}, new=${newStat?.avg}`);
      }
      if (!compareNumbers(oldStat?.min, newStat?.min, tolerance)) {
        differences.push(`${old.id} ${type}.min: old=${oldStat?.min}, new=${newStat?.min}`);
      }
      if (!compareNumbers(oldStat?.max, newStat?.max, tolerance)) {
        differences.push(`${old.id} ${type}.max: old=${oldStat?.max}, new=${newStat?.max}`);
      }
    }
  }

  return {
    matches: differences.length === 0,
    differences: differences.length > 0 ? differences : undefined,
  };
}

/**
 * Compare aggregated readings responses
 */
export function compareReadings(oldResponse: any, newResponse: any, tolerance: number = 0.001): ComparisonResult {
  const differences: string[] = [];

  // For single device response (GET /api/devices/:id/readings)
  if (oldResponse.id && newResponse.id) {
    if (oldResponse.id !== newResponse.id) {
      differences.push(`id mismatch: old=${oldResponse.id}, new=${newResponse.id}`);
    }

    const oldValues = oldResponse.values || [];
    const newValues = newResponse.values || [];

    if (oldValues.length !== newValues.length) {
      differences.push(`Values array length mismatch: old=${oldValues.length}, new=${newValues.length}`);
    }

    // Compare each type's readings
    for (let i = 0; i < Math.min(oldValues.length, newValues.length); i++) {
      const oldType = oldValues[i];
      const newType = newValues[i];

      if (oldType.type !== newType.type) {
        differences.push(`Type ${i}: type mismatch (old=${oldType.type}, new=${newType.type})`);
        continue;
      }

      compareReadingValues(oldType.values, newType.values, `${oldResponse.id}.${oldType.type}`, differences, tolerance);
    }
  }
  // For multi-device response (GET /api/readings)
  else {
    if (oldResponse.count !== newResponse.count) {
      differences.push(`count mismatch: old=${oldResponse.count}, new=${newResponse.count}`);
    }
    if (oldResponse.totCount !== newResponse.totCount) {
      differences.push(`totCount mismatch: old=${oldResponse.totCount}, new=${newResponse.totCount}`);
    }

    const oldDevices = oldResponse.values || [];
    const newDevices = newResponse.values || [];

    if (oldDevices.length !== newDevices.length) {
      differences.push(`Device array length mismatch: old=${oldDevices.length}, new=${newDevices.length}`);
    }

    for (let i = 0; i < Math.min(oldDevices.length, newDevices.length); i++) {
      const oldDevice = oldDevices[i];
      const newDevice = newDevices[i];

      if (oldDevice.id !== newDevice.id) {
        differences.push(`Device ${i}: id mismatch (old=${oldDevice.id}, new=${newDevice.id})`);
        continue;
      }

      compareReadingValues(oldDevice.values, newDevice.values, oldDevice.id, differences, tolerance);
    }
  }

  return {
    matches: differences.length === 0,
    differences: differences.length > 0 ? differences : undefined,
  };
}

/**
 * Helper: Compare arrays of time-aggregated readings
 */
function compareReadingValues(
  oldValues: any[],
  newValues: any[],
  context: string,
  differences: string[],
  tolerance: number
): void {
  if (oldValues.length !== newValues.length) {
    differences.push(`${context}: readings count mismatch (old=${oldValues.length}, new=${newValues.length})`);
    return;
  }

  for (let j = 0; j < oldValues.length; j++) {
    const oldReading = oldValues[j];
    const newReading = newValues[j];

    // Compare timestamps (might need normalization)
    if (oldReading.time !== newReading.time) {
      differences.push(`${context}[${j}]: time mismatch (old=${oldReading.time}, new=${newReading.time})`);
    }

    // Compare aggregated values
    if (!compareNumbers(oldReading.avg, newReading.avg, tolerance)) {
      differences.push(`${context}[${j}]: avg mismatch (old=${oldReading.avg}, new=${newReading.avg})`);
    }
    if (!compareNumbers(oldReading.min, newReading.min, tolerance)) {
      differences.push(`${context}[${j}]: min mismatch (old=${oldReading.min}, new=${newReading.min})`);
    }
    if (!compareNumbers(oldReading.max, newReading.max, tolerance)) {
      differences.push(`${context}[${j}]: max mismatch (old=${oldReading.max}, new=${newReading.max})`);
    }
  }
}

/**
 * Compare latest readings responses
 */
export function compareLatestReadings(oldResponse: any, newResponse: any): ComparisonResult {
  const differences: string[] = [];

  // For single device response (GET /api/devices/:id/latest)
  if (oldResponse.id && newResponse.id) {
    if (oldResponse.id !== newResponse.id) {
      differences.push(`id mismatch: old=${oldResponse.id}, new=${newResponse.id}`);
    }
    if (oldResponse.name !== newResponse.name) {
      differences.push(`name mismatch: old=${oldResponse.name}, new=${newResponse.name}`);
    }

    // Compare reading
    const oldReading = oldResponse.reading;
    const newReading = newResponse.reading;
    
    if (oldReading && newReading) {
      if (!compareNumbers(oldReading.temperature, newReading.temperature)) {
        differences.push(`reading.temperature mismatch: old=${oldReading.temperature}, new=${newReading.temperature}`);
      }
      if (!compareNumbers(oldReading.humidity, newReading.humidity)) {
        differences.push(`reading.humidity mismatch: old=${oldReading.humidity}, new=${newReading.humidity}`);
      }
      if (!compareNumbers(oldReading.pressure, newReading.pressure)) {
        differences.push(`reading.pressure mismatch: old=${oldReading.pressure}, new=${newReading.pressure}`);
      }
      if (!compareNumbers(oldReading.battery, newReading.battery)) {
        differences.push(`reading.battery mismatch: old=${oldReading.battery}, new=${newReading.battery}`);
      }
    } else if (oldReading !== newReading) {
      differences.push(`reading presence mismatch: old=${!!oldReading}, new=${!!newReading}`);
    }
  }
  // For multi-device response (GET /api/latest)
  else {
    if (oldResponse.count !== newResponse.count) {
      differences.push(`count mismatch: old=${oldResponse.count}, new=${newResponse.count}`);
    }
    if (oldResponse.totCount !== newResponse.totCount) {
      differences.push(`totCount mismatch: old=${oldResponse.totCount}, new=${newResponse.totCount}`);
    }

    const oldDevices = oldResponse.values || [];
    const newDevices = newResponse.values || [];

    if (oldDevices.length !== newDevices.length) {
      differences.push(`Device array length mismatch: old=${oldDevices.length}, new=${newDevices.length}`);
    }

    for (let i = 0; i < Math.min(oldDevices.length, newDevices.length); i++) {
      const result = compareLatestReadings(oldDevices[i], newDevices[i]);
      if (!result.matches && result.differences) {
        differences.push(...result.differences.map(d => `Device ${i}: ${d}`));
      }
    }
  }

  return {
    matches: differences.length === 0,
    differences: differences.length > 0 ? differences : undefined,
  };
}

/**
 * Pretty print comparison differences
 */
export function printDifferences(result: ComparisonResult, testName: string): void {
  if (result.matches) {
    console.log(`✓ ${testName}: Responses match`);
  } else {
    console.error(`✗ ${testName}: Responses differ`);
    result.differences?.forEach((diff) => {
      console.error(`  - ${diff}`);
    });
  }
}
