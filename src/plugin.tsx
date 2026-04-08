import { createRoot, type Root } from "react-dom/client";
import manifestJson from "../plannerxchange.app.json";
import { App } from "./App";
import type {
  PlannerXchangeManifest,
  PlannerXchangePluginModule,
  ShellRuntimeContext
} from "./plannerxchange";

const manifest = manifestJson as PlannerXchangeManifest;

let root: Root | null = null;

export function mount(context: ShellRuntimeContext): void {
  const container = document.getElementById("root");

  if (!container) {
    throw new Error("Missing #root container for PlannerXchange plugin mount.");
  }

  if (!root) {
    root = createRoot(container);
  }

  root.render(<App context={context} manifest={manifest} />);
}

export const pluginModule: PlannerXchangePluginModule = {
  manifest,
  mount
};

export { manifest };
