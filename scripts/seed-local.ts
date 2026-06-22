import {seedData} from './seed';

const FIXED_NOW = new Date('2026-06-22T06:00:00Z');

seedData(FIXED_NOW).catch(console.error);
