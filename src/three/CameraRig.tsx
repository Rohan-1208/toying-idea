import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import { smooth, smoother } from "./scroll";
import { HERO_STUDIO } from "./scenes/PrintStudioBuilding";

type Key = { at: number; pos: [number, number, number]; target: [number, number, number] };

const [SX, SY, SZ] = HERO_STUDIO;

const KEYS: Key[] = [
  { at: 0.0, pos: [24, 16, 24], target: [0, 2.5, 0] },
  { at: 0.1, pos: [20, 15, 20], target: [1, 3, 0] },
  { at: 0.2, pos: [12, 10, 13], target: [SX, SY + 2.2, SZ] },
  { at: 0.28, pos: [SX + 5.5, SY + 3.5, SZ + 6.5], target: [SX, SY + 1.6, SZ] },
  { at: 0.34, pos: [SX + 3.2, SY + 2.6, SZ + 4.0], target: [SX, SY + 1.3, SZ] },
  { at: 0.4, pos: [SX + 1.4, SY + 2.0, SZ + 2.4], target: [SX, SY + 1.1, SZ] },
  { at: 0.45, pos: [SX + 0.6, SY + 1.7, SZ + 1.8], target: [SX, SY + 1.0, SZ] },
  { at: 0.5, pos: [SX + 0.4, SY + 0.4, SZ + 2.5], target: [0, -12, 0] },
  { at: 0.56, pos: [3, -22, 12], target: [0, -36, 0] },
  { at: 0.62, pos: [2, -32, 13], target: [0, -38.5, 0] },
  { at: 0.7, pos: [1, -36.5, 13], target: [0, -39.5, 0] },
  { at: 0.76, pos: [0, -72, 16], target: [0, -78, 0] },
  { at: 0.82, pos: [-2, -78, 12], target: [0, -80, 0] },
  { at: 0.88, pos: [0.5, -78.5, 15], target: [0, -80, 0] },
  { at: 0.94, pos: [0, -100, 22], target: [0, -105, -4] },
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
  const parallaxTarget = useRef(new THREE.Vector3());
  const smoothedPos = useRef(new THREE.Vector3(24, 16, 24));
  const smoothedTarget = useRef(new THREE.Vector3(0, 2.5, 0));
  const primed = useRef(false);

  useFrame((_, dt) => {
    const o = scroll.offset;
    const { pos, target } = sampleKey(o);

    // Opening: hard-lock camera — no lerp hunting, no pointer sway
    if (o < 0.02) {
      smoothedPos.current.copy(pos);
      smoothedTarget.current.copy(target);
      parallax.current.set(0, 0, 0);
      primed.current = true;
      camera.position.copy(pos);
      curTarget.copy(target);
      camera.lookAt(curTarget);
      return;
    }

    const alpha = 1 - Math.exp(-dt * (o < 0.12 ? 18 : 14));
    if (!primed.current) {
      smoothedPos.current.copy(pos);
      smoothedTarget.current.copy(target);
      primed.current = true;
    } else {
      smoothedPos.current.lerp(pos, alpha);
      smoothedTarget.current.lerp(target, alpha);
    }

    const paraAmt = Math.min(1, Math.max(0, (o - 0.04) / 0.08));
    parallaxTarget.current.set(pointer.x * 0.35 * paraAmt, pointer.y * 0.22 * paraAmt, 0);
    parallax.current.lerp(parallaxTarget.current, 1 - Math.exp(-dt * 5));
    camera.position.copy(smoothedPos.current).add(parallax.current);
    curTarget.copy(smoothedTarget.current);
    camera.lookAt(curTarget);
  });

  return null;
}
