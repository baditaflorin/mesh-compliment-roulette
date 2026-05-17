import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-compliment-roulette",
  description: "Fair-RNG pairwise sealed compliments, revealed without author labels.",
  accentHex: "#ff7eb6",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
