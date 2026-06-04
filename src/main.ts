import { App } from "./app.js";
import { createBoardInput } from "./board/boardInput.js";
import { createDevInput } from "./board/devInput.js";
import { PieceMappingTable } from "./board/pieceMapping.js";
import { SaveStore } from "./board/saveStore.js";
import { PauseMenu } from "./board/pauseMenu.js";
import { AudioBus } from "./audio/cues.js";

async function main(): Promise<void> {
  const canvas = document.getElementById("screen") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("missing canvas#screen");
  const mapping = await PieceMappingTable.load();
  const audio = new AudioBus();
  const save = new SaveStore();
  const pause = new PauseMenu();
  const boardInput = createBoardInput((id) => mapping.roleFor(id));
  const devInput = createDevInput(canvas, (id) => mapping.roleFor(id), () => 1);
  const input = boardInput.isOnDevice() ? boardInput : devInput;
  const app = new App({ canvas, input, mapping, save, pause, audio });
  try {
    const r = await fetch("./board.config.json");
    if (r.ok) {
      const cfg = (await r.json()) as { appId?: string };
      if (cfg.appId) app.setAppId(cfg.appId);
    }
  } catch {
    // ignore
  }
  await app.start();
  if (import.meta && (import.meta as { hot?: { accept: () => void } }).hot) {
    (import.meta as { hot: { accept: () => void } }).hot.accept();
  }
}

void main();
