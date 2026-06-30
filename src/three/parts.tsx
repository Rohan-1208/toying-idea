import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { PALETTE } from "./palette";

type Vec3 = [number, number, number];

// A soft, slightly-rounded block — the fundamental unit of the voxel world.
export function Block({
  position = [0, 0, 0] as Vec3,
  size = [1, 1, 1] as Vec3,
  color = PALETTE.clay,
  radius = 0.06,
  metalness = 0.05,
  roughness = 0.65,
  emissive,
  emissiveIntensity = 0,
  ...rest
}: {
  position?: Vec3;
  size?: Vec3;
  color?: string;
  radius?: number;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
} & React.ComponentProps<"group">) {
  return (
    <group position={position} {...rest}>
      <RoundedBox args={size} radius={Math.min(radius, size[1] / 2.2)} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          metalness={metalness}
          roughness={roughness}
          emissive={emissive ?? "#000000"}
          emissiveIntensity={emissive ? emissiveIntensity : 0}
        />
      </RoundedBox>
    </group>
  );
}

// A floating island platform: teal top deck, clay underside, like the storyboard.
export function Platform({
  position = [0, 0, 0] as Vec3,
  width = 5,
  depth = 5,
  topColor = PALETTE.teal,
  sideColor = PALETTE.clay,
}: {
  position?: Vec3;
  width?: number;
  depth?: number;
  topColor?: string;
  sideColor?: string;
}) {
  return (
    <group position={position}>
      {/* top deck */}
      <Block size={[width, 0.45, depth]} color={topColor} position={[0, 0, 0]} />
      {/* clay body */}
      <Block size={[width * 0.94, 0.8, depth * 0.94]} color={sideColor} position={[0, -0.6, 0]} />
      {/* tapered base */}
      <Block size={[width * 0.78, 0.7, depth * 0.78]} color={PALETTE.clayDeep} position={[0, -1.25, 0]} />
      {/* little stilts */}
      {[
        [-width * 0.3, -depth * 0.3],
        [width * 0.3, -depth * 0.3],
        [-width * 0.3, depth * 0.3],
        [width * 0.3, depth * 0.3],
      ].map(([x, z], i) => (
        <Block key={i} size={[0.5, 1.1, 0.5]} color={PALETTE.clay} position={[x, -1.9, z]} />
      ))}
    </group>
  );
}

// Procedural cluster of buildings on a deck, seeded for stability across renders.
export function Buildings({
  seed = 1,
  count = 10,
  spread = 2,
  maxHeight = 3.2,
  colors,
}: {
  seed?: number;
  count?: number;
  spread?: number;
  maxHeight?: number;
  colors: string[];
}) {
  const blocks = useMemo(() => {
    const rng = mulberry32(seed);
    const out: { pos: Vec3; size: Vec3; color: string }[] = [];
    for (let i = 0; i < count; i++) {
      const w = 0.5 + rng() * 0.8;
      const d = 0.5 + rng() * 0.8;
      const h = 0.7 + rng() * maxHeight;
      const x = (rng() - 0.5) * spread * 2;
      const z = (rng() - 0.5) * spread * 2;
      out.push({
        pos: [x, h / 2 + 0.2, z],
        size: [w, h, d],
        color: colors[Math.floor(rng() * colors.length)],
      });
    }
    return out;
  }, [seed, count, spread, maxHeight, colors]);

  return (
    <group>
      {blocks.map((b, i) => (
        <Block key={i} position={b.pos} size={b.size} color={b.color} radius={0.05} />
      ))}
    </group>
  );
}

// A thin connecting bridge between islands.
export function Bridge({
  from,
  to,
  width = 0.7,
  color = PALETTE.clayDeep,
}: {
  from: Vec3;
  to: Vec3;
  width?: number;
  color?: string;
}) {
  const { mid, length, angle } = useMemo(() => {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const len = Math.hypot(dx, dz);
    return {
      mid: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2] as Vec3,
      length: len,
      angle: Math.atan2(dz, dx),
    };
  }, [from, to]);

  return (
    <group position={mid} rotation={[0, -angle, 0]}>
      <Block size={[length, 0.18, width]} color={color} />
      <Block size={[length, 0.1, width * 0.5]} color={PALETTE.teal} position={[0, 0.12, 0]} />
    </group>
  );
}

// Tiny deterministic PRNG so procedural scenes are stable between frames.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shared rounded geometry could be reused, but RoundedBox handles caching well enough.
export const tmpVec = new THREE.Vector3();
