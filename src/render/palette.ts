export const PALETTE = {
  bg0: "#0a0e1a",
  bg1: "#0f1424",
  panel: "#1a2238",
  panelLine: "#2a3554",
  text: "#e6ecff",
  textDim: "#7c87a8",
  gold: "#ffce4a",
  goldDark: "#a87a1c",
  hp: "#ff5f7a",
  hpBack: "#3a1a25",
  lane: ["#4f8fff", "#ff7a4f", "#7aff4f"],
  laneDim: ["#1f2f55", "#55271f", "#1f5527"],
  enemy: {
    walker: "#7be0a4",
    runner: "#ffb74f",
    tank: "#9b6dff",
    swarm: "#c8d8ff",
    boss: "#ff5f7a",
  },
  piece: {
    cannon: "#fff2a8",
    block: "#bfbfbf",
    stair: "#7adfff",
    ring: "#ff7adf",
  },
  projectile: "#fff2a8",
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
