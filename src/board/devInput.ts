import type { InputFrame, InputSource, DevContact } from "./boardInput.js";
import type { Role } from "../game/types.js";

export function createDevInput(
  canvas: HTMLCanvasElement,
  pieceRoleForGlyph: (id: number) => Role,
  getCssScale: () => number,
): InputSource {
  const listeners: Array<(frame: InputFrame) => void> = [];
  const prev = new Map<number, DevContact>();
  const activeContacts = new Map<number, DevContact>();
  let rotateLeft = false;
  let rotateRight = false;
  let modeCycle = false;
  let startWave = false;
  let restart = false;
  let placeRole: "cannon" | "block" | "stair" | "ring" = "cannon";
  let diagnostic = false;
  const nextId = (() => {
    let id = 1;
    return () => id++;
  })();
  function emit(): void {
    const contacts = [...activeContacts.values()];
    const frame: InputFrame = {
      contacts,
      diagnostic,
      devRotateLeft: rotateLeft,
      devRotateRight: rotateRight,
      devModeCycle: modeCycle,
      devPlace: placeRole,
      devStartWave: startWave,
      devRestart: restart,
      longPress: false,
    };
    startWave = false;
    restart = false;
    for (const l of listeners) l(frame);
  }
  function cssToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }
  function pointerToContact(clientX: number, clientY: number, contactId: number, kind: "Finger" | "Glyph" | "Blob", glyphId: number): DevContact {
    const { x, y } = cssToCanvas(clientX, clientY);
    const existing = activeContacts.get(contactId);
    return {
      contactId,
      x,
      y,
      orientation: existing?.orientation ?? 0,
      isTouched: true,
      glyphId,
      type: kind,
      phase: existing ? "Moved" : "Began",
      pieceRole: kind === "Glyph" ? pieceRoleForGlyph(glyphId) : undefined,
    };
  }
  function endContact(contactId: number): void {
    const existing = activeContacts.get(contactId);
    if (!existing) return;
    activeContacts.set(contactId, { ...existing, isTouched: false, phase: "Ended" });
    setTimeout(() => {
      activeContacts.delete(contactId);
      emit();
    }, 16);
  }
  function onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const id = nextId();
    activeContacts.set(id, pointerToContact(e.clientX, e.clientY, id, "Finger", 0));
    emit();
  }
  function onPointerMove(e: PointerEvent): void {
    if (!activeContacts.has(e.pointerId) && e.buttons === 0) return;
    const id = e.pointerId;
    if (!activeContacts.has(id)) return;
    const { x, y } = cssToCanvas(e.clientX, e.clientY);
    const existing = activeContacts.get(id)!;
    activeContacts.set(id, { ...existing, x, y, phase: "Moved" });
    emit();
  }
  function onPointerUp(e: PointerEvent): void {
    if (activeContacts.has(e.pointerId)) {
      endContact(e.pointerId);
      emit();
    }
  }
  function onKeyDown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === "q") rotateLeft = true;
    if (k === "e") rotateRight = true;
    if (k === "f" || k === "tab") {
      e.preventDefault();
      modeCycle = true;
    }
    if (k === " ") {
      e.preventDefault();
      startWave = true;
    }
    if (k === "r") restart = true;
    if (k === "d") diagnostic = !diagnostic;
    if (k === "1") placeRole = "cannon";
    if (k === "2") placeRole = "block";
    if (k === "3") placeRole = "stair";
    if (k === "4") placeRole = "ring";
    emit();
  }
  function onKeyUp(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === "q") rotateLeft = false;
    if (k === "e") rotateRight = false;
    if (k === "f" || k === "tab") modeCycle = false;
    emit();
  }
  return {
    start(): void {
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
    },
    stop(): void {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    onFrame(cb): void {
      listeners.push(cb);
    },
    isOnDevice(): boolean {
      return false;
    },
    setDevPlace(role): void {
      placeRole = role;
    },
    getDevPlace(): "cannon" | "block" | "stair" | "ring" {
      return placeRole;
    },
    setDevDiagnostic(on): void {
      diagnostic = on;
    },
  };
  void getCssScale;
  void pieceRoleForGlyph;
  void prev;
}
