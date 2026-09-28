/**
 * Mock "Approvals" queue — the reference dataset from the assignment brief
 * (§2), seeded as a fixture instead of a real backend. Every AI action reads
 * from this same in-memory source so the assistant is reasoning over one
 * consistent picture of the world.
 *
 * Deliberately unopinionated about priority: instead of a hand-set
 * `priority` field, each item carries the raw signals (submission time,
 * SLA target, flags) an operator would actually weigh. The "Present me
 * Summary" prompt is the thing that has to reason about urgency from these
 * signals — that's the point of the exercise, not something we should
 * pre-bake into the fixture.
 */

export type ApprovalType = "folder" | "video" | "pdf" | "image";

export interface ApprovalItem {
  id: string;
  title: string;
  folderPath: string;
  type: ApprovalType;
  submittedBy: string;
  /** ISO timestamp, generated relative to "now" so the demo never looks stale. */
  submittedAt: string;
  /** Hours from submission the org's policy expects a decision by. */
  slaHours: number;
  /** Free-form operational flags a reviewer would care about. */
  flags: string[];
  description: string;
  sizeLabel: string;
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export const APPROVALS_QUEUE: ApprovalItem[] = [
  {
    id: "site-patrol-onboarding",
    title: "Site Patrol Onboarding & Checklists",
    folderPath: "My Site Patrol › My Site Patrol Card",
    type: "folder",
    submittedBy: "Sam HelpAdmin",
    submittedAt: hoursAgo(58),
    slaHours: 72,
    flags: [],
    description:
      "Standard operating procedures, emergency drill steps, and technician check-in checklists for the site patrol rotation.",
    sizeLabel: "12 checklists",
  },
  {
    id: "drone-patrol-video-demo",
    title: "Level 2 Drone Patrol Video Demo",
    folderPath: "Drawing-Videos › Drawing-Videos Card",
    type: "video",
    submittedBy: "Alex HelpAdmin",
    submittedAt: hoursAgo(51),
    slaHours: 48,
    flags: ["customer-facing"],
    description:
      "Walkthrough recording of the Level 2 autonomous drone patrol route, intended for the client demo next week.",
    sizeLabel: "4m 32s",
  },
  {
    id: "safety-equipment-sensor-specs",
    title: "Safety Equipment & Sensor Specs",
    folderPath: "Site Recordings › Site Recordings",
    type: "pdf",
    submittedBy: "Sam HelpAdmin",
    submittedAt: hoursAgo(70),
    slaHours: 24,
    flags: ["safety-critical"],
    description:
      "Spec sheet for patrol-issued safety equipment and the sensor calibration thresholds used during drone flights.",
    sizeLabel: "2.1 MB · PDF",
  },
  {
    id: "spatial-zone-layout-camera-map",
    title: "360° Spatial Zone Layout & Camera Map",
    folderPath: "Site Recordings › Site Recordings",
    type: "image",
    submittedBy: "Elena HelpAdmin",
    submittedAt: hoursAgo(12),
    slaHours: 48,
    flags: [],
    description:
      "Annotated top-down layout of the patrol zone with fixed camera coverage overlaid, used to plan blind-spot fixes.",
    sizeLabel: "6 photos",
  },
];

export function getQueueSnapshot(): ApprovalItem[] {
  // Returns a fresh copy so callers (e.g. prompt builders) can't mutate the
  // fixture out from under other requests.
  return APPROVALS_QUEUE.map((item) => ({ ...item }));
}
