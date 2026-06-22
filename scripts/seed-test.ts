import {seedData} from './seed';
import {FIXED_NOW} from '../tests/utils/test-data';

// Uses fixed reference date
// Tests will mock Date.now() to always return this date
seedData(FIXED_NOW).catch(console.error);
