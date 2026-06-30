import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import { smooth, smoother } from "./scroll";
import { HERO_STUDIO } from "./scenes/PrintStudioBuilding";

type Key = { at: number; pos: [number, number, number]; target: [number, number, number] };

const [SX, SY, SZ] = HERO_STUDIO;
const STUDIO_MID: [number, number, number] = [SX, SY + 2.4, SZ];
const STUDIO_FLOOR: [number, number, number] = [SX, SY + 1.1, SZ];

// Camera path aligned to storyboard v2.0.
// Stages sit at Y: city=0, workshop=-40, archive=-80, universe=-120.
const KEYS: Key[] = [
  // Ch1 — Hero City (0%)
  { at: 0.0, pos: [15, 11, 15], target: [0, 2, 0] },
  { at: 0.12, pos: [14, 12, 14], target: [0, 3, 0] },

  // Ch2 — The Dive: fly into the hero print studio (25% → 45%)
  { at: 0.25, pos: [10, 14, 10], target: STUDIO_MID },
  { at: 0.31, pos: [6, 11, 5], target: [SX, SY + 3.2, SZ] },
  { at: 0.38, pos: [3.2, 7.8, 1.2], target: [SX, SY + 3.8, SZ] },
  { at: 0.42, pos: [SX + 0.6, SY + 5.6, SZ + 0.9], target: STUDIO_FLOOR },
  { at: 0.45, pos: [SX, SY + 3.1, SZ + 0.55], target: STUDIO_FLOOR },

  // Ch3 — Descend into workshop (45% → 70%)
  { at: 0.52, pos: [SX - 0.4, SY + 1.2, SZ + 2.2], target: [0, -8, 0] },
  { at: 0.58, pos: [1, -18, 10], target: [0, -32, 0] },
  { at: 0.65, pos: [1, -34, 12], target: [0, -38, 0] },
  { at: 0.7, pos: [1, -36.5, 13], target: [0, -39.5, 0] },

  // Ch4 — Archive shelf sweep (70% → 90%)
  { at: 0.78, pos: [0, -76, 14], target: [0, -79.5, 0] },
  { at: 0.85, pos: [-2, -78, 11], target: [0, -80, 0] },
  { at: 0.9, pos: [0.5, -78.5, 15], target: [0, -80, 0] },

  // Ch5 — Infinite Horizon (90% → 100%)
  { at: 0.95, pos: [0, -100, 22], target: [0, -105, -4] },
  { at: 1.0, pos: [0, -119, 28], target: [0, -121, -14] },
];

const tmpPos = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const curTarget = new THREE.Vector3(0, 2, 0);

function sampleKey(offset: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const o = Math.max(0, Math.min(1, offset));
  let i = 0;
  while (i < KEYS.length - 2 && o > KEYS[i + 1].at) i++;

  const a = KEYS[i];
  const b = KEYS[Math.min(i + 1, KEYS.length - 1)];
  const span = b.at - a.at;
  const raw = span <= 0 ? 0 : (o - a.at) / span;

  // Use smoother easing during the studio dive segment.
  const inDive = a.at >= 0.25 && b.at <= 0.52;
  const t = inDive ? smoother(raw) : smooth(raw);

  tmpPos.set(
    a.pos[0] + (b.pos[0] - a.pos[0]) * t,
    a.pos[1] + (b.pos[1] - a.pos[1]) * t,
    a.pos[2] + (b.pos[2] - a.pos[2]) * t
  );
  tmpTarget.set(
    a.target[0] + (b.target[0] - a.target[0]) * t,
    a.target[1] + (b.target[1] - a.target[1]) * t,
    a.target[2] + (b.target[2] - a.target[2]) * t
  );
  return { pos: tmpPos, target: tmpTarget };
}

export function CameraRig() {
  const scroll = useScroll();
  const { camera, pointer } = useThree();
  const parallax = useRef(new THREE.Vector3());

  useFrame(() => {
    const { pos, target } = sampleKey(scroll.offset);

    // Tiny pointer parallax only — no extra lerp lag on scroll position.
    parallax.current.set(pointer.x * 0.6, pointer.y * 0.4, 0);
    camera.position.copy(pos).add(parallax.current);
    curTarget.copy(target);
    camera.lookAt(curTarget);
  });

  return null;
}
