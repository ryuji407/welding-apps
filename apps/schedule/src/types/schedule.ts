import type { Job } from './job';

export interface Schedule {
    id: string;      // Unique ID (e.g., date string or uuid)
    date: string;    // Display date (e.g., "12月4日")
    jobs: Job[];     // Jobs for this schedule
    fileName: string; // Original filename
    isArchived?: boolean; // Archived status
}
