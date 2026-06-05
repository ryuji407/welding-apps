export const ENVIRONMENTS = ["左", "中", "右"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const ROBOTS = ["１号機", "２号機"] as const;
export type Robot = (typeof ROBOTS)[number];

export type RobotProgramEntry = {
  stepNumber: number;
  robot: string;
  number: string;
  name: string;
  photoUrl?: string;
};

export type ManualFormInitial = {
  processCode: string;
  productName: string;
  toollessToolCounts: Record<string, string>;
  robotEnvironments: Environment[];
  notes: string;
  toollessToolColor: string;
  workVideoUrl: string;
  layoutPhotoUrl: string;
  wagonPhotoUrl: string;
  notesPhotoUrl: string;
  stepCount: number;
  environmentBlocks: {
    environment: Environment;
    robotPrograms: RobotProgramEntry[];
    stepPhotos: Record<number, string>;
  }[];
  jigProcessSteps: { stepNumber: number }[];
  aliases: string[];
};

export const emptyInitial: ManualFormInitial = {
  processCode: "",
  productName: "",
  toollessToolCounts: {},
  robotEnvironments: [],
  notes: "",
  toollessToolColor: "",
  workVideoUrl: "",
  layoutPhotoUrl: "",
  wagonPhotoUrl: "",
  notesPhotoUrl: "",
  stepCount: 1,
  environmentBlocks: [],
  jigProcessSteps: [{ stepNumber: 1 }],
  aliases: [],
};

export function parseJsonRecord(s: string | null | undefined): Record<string, string> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
