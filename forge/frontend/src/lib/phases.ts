/** Which pipeline phase each page belongs to — shown on every page so the flow is always visible. */
export const PHASE_OF: Record<string, { n: number; name: string }> = {
  observatory: { n: 1, name: "Set up" }, model: { n: 1, name: "Set up" }, overview: { n: 1, name: "Set up" },
  "agent-studio": { n: 2, name: "Define the job · Practice data" }, "knowledge-studio": { n: 2, name: "Define the job · Practice data" },
  studio: { n: 4, name: "Study & train" }, datasets: { n: 4, name: "Study & train" }, training: { n: 4, name: "Study & train" },
  playground: { n: 5, name: "Look inside & steer" }, lens: { n: 5, name: "Look inside & steer" }, modelmap: { n: 5, name: "Look inside & steer" },
  weightlab: { n: 5, name: "Look inside & steer" }, trajectories: { n: 5, name: "Look inside & steer" }, knowledge: { n: 5, name: "Look inside & steer" },
  evaluation: { n: 6, name: "Measure · Final test" }, robustness: { n: 6, name: "Measure" }, bench: { n: 6, name: "Measure" },
  factory: { n: 8, name: "Package" }, governance: { n: 9, name: "Govern & decide" },
};
