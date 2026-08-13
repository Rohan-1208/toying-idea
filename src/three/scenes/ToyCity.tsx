import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Block, Platform, Buildings, Bridge } from "../parts";
import { PALETTE } from "../palette";
import { PrintStudioBuilding, PrintWindow, HomePrinter, HERO_STUDIO } from "./PrintStudioBuilding";

type Vec3 = [number, number, number];

const WARM = [PALETTE.clay, PALETTE.clayLight, PALETTE.gold, PALETTE.goldLight];
const COOL = [PALETTE.teal, PALETTE.tealLight, PALETTE.clay, PALETTE.gold];
const MIX = [PALETTE.teal, PALETTE.clay, PALETTE.gold, PALETTE.tealLight, PALETTE.clayLight];
const TOY_COLORS = [PALETTE.clay, PALETTE.gold, PALETTE.teal, PALETTE.clayLight, PALETTE.goldLight, PALETTE.tealLight];

/** Street-facing home printers per island (every home makes a kid’s toy). */
const HOME_PRINTERS: { island: number; pos: Vec3; rot: number; phase: number; color: number }[] = [
  { island: 0, pos: [-3.4, 0.25, 3.2], rot: 0.2, phase: 0.1, color: 0 },
  { island: 0, pos: [3.5, 0.25, 2.8], rot: -0.4, phase: 0.4, color: 1 },
  { island: 0, pos: [3.2, 0.25, -3.0], rot: 2.6, phase: 0.7, color: 2 },
  { island: 1, pos: [1.8, 0.25, 1.6], rot: -0.5, phase: 0.2, color: 3 },
  { island: 1, pos: [-1.6, 0.25, -1.8], rot: 1.2, phase: 0.55, color: 4 },
  { island: 2, pos: [-1.9, 0.25, 1.5], rot: 0.8, phase: 0.35, color: 5 },
  { island: 2, pos: [1.7, 0.25, -1.6], rot: -1.1, phase: 0.8, color: 0 },
  { island: 3, pos: [1.5, 0.25, -1.4], rot: 2.1, phase: 0.15, color: 1 },
  { island: 3, pos: [-1.4, 0.25, 1.5], rot: 0.3, phase: 0.6, color: 2 },
  { island: 4, pos: [-1.6, 0.25, -1.5], rot: 1.5, phase: 0.45, color: 3 },
  { island: 4, pos: [1.5, 0.25, 1.4], rot: -0.7, phase: 0.9, color: 4 },
  { island: 5, pos: [-2.0, 0.25, 1.2], rot: 0.4, phase: 0.25, color: 5 },
  { island: 5, pos: [2.1, 0.25, -1.0], rot: -1.4, phase: 0.65, color: 0 },
  { island: 6, pos: [1.4, 0.25, 1.8], rot: -0.3, phase: 0.5, color: 1 },
  { island: 7, pos: [-1.5, 0.25, 1.6], rot: 0.9, phase: 0.75, color: 2 },
  { island: 8, pos: [1.2, 0.25, 1.1], rot: -0.6, phase: 0.3, color: 3 },
  { island: 9, pos: [-1.1, 0.25, 1.2], rot: 1.0, phase: 0.85, color: 4 },
  { island: 10, pos: [1.3, 0.25, -1.0], rot: 2.4, phase: 0.05, color: 5 },
  { island: 11, pos: [-1.2, 0.25, -1.1], rot: 0.5, phase: 0.42, color: 0 },
  { island: 12, pos: [-1.8, 0.25, 1.0], rot: -0.2, phase: 0.58, color: 1 },
  { island: 12, pos: [1.9, 0.25, -0.8], rot: 2.8, phase: 0.95, color: 2 },
];

const ISLANDS: {
  pos: Vec3;
  w: number;
  d: number;
  seed: number;
  count: number;
  max: number;
  colors: string[];
  windows: Vec3[];
}[] = [
  // Center — print studio district
  {
    pos: [0, 0, 0],
    w: 9,
    d: 9,
    seed: 7,
    count: 18,
    max: 4.2,
    colors: WARM,
    windows: [
      [-2.4, 2.2, 1.1],
      [0.8, 2.8, -2.0],
      [2.2, 1.9, 1.4],
    ],
  },
  // Inner ring
  {
    pos: [-11, -1.0, -5],
    w: 5.5,
    d: 5.5,
    seed: 21,
    count: 12,
    max: 3.4,
    colors: COOL,
    windows: [
      [-1.0, 1.8, 1.1],
      [1.3, 2.4, -0.6],
    ],
  },
  {
    pos: [11.2, -0.8, -4.8],
    w: 5.5,
    d: 5.5,
    seed: 33,
    count: 12,
    max: 3.5,
    colors: WARM,
    windows: [
      [-1.2, 1.7, 0.9],
      [1.1, 2.3, -0.7],
    ],
  },
  {
    pos: [-10.2, -1.4, 6.2],
    w: 5.2,
    d: 5.2,
    seed: 48,
    count: 11,
    max: 3.1,
    colors: WARM,
    windows: [[0.8, 1.9, 1.0]],
  },
  {
    pos: [10.5, -1.3, 6.5],
    w: 5.2,
    d: 5.2,
    seed: 59,
    count: 11,
    max: 3.2,
    colors: COOL,
    windows: [
      [-0.7, 1.8, -0.8],
      [1.2, 2.4, 0.6],
    ],
  },
  // Outer ring — bigger city
  {
    pos: [0, -1.8, -13.5],
    w: 6.2,
    d: 5.2,
    seed: 71,
    count: 13,
    max: 3.8,
    colors: MIX,
    windows: [
      [-1.4, 2.0, 0.8],
      [1.5, 2.5, -0.5],
    ],
  },
  {
    pos: [-16.5, -2.0, 0.5],
    w: 5,
    d: 5.8,
    seed: 84,
    count: 12,
    max: 3.6,
    colors: COOL,
    windows: [[0.6, 2.1, 1.0]],
  },
  {
    pos: [16.8, -1.9, 0.2],
    w: 5,
    d: 5.8,
    seed: 97,
    count: 12,
    max: 3.7,
    colors: WARM,
    windows: [
      [-0.8, 1.9, 0.9],
      [1.0, 2.6, -0.6],
    ],
  },
  {
    pos: [-12.5, -2.2, -11],
    w: 4.6,
    d: 4.6,
    seed: 110,
    count: 9,
    max: 2.9,
    colors: MIX,
    windows: [[0.5, 1.7, 0.7]],
  },
  {
    pos: [13, -2.1, -11.2],
    w: 4.6,
    d: 4.6,
    seed: 123,
    count: 9,
    max: 3.0,
    colors: WARM,
    windows: [[-0.6, 1.8, -0.6]],
  },
  {
    pos: [-13.2, -2.4, 12.5],
    w: 4.8,
    d: 4.4,
    seed: 136,
    count: 10,
    max: 2.8,
    colors: COOL,
    windows: [[0.7, 1.6, 0.8]],
  },
  {
    pos: [13.5, -2.3, 12.8],
    w: 4.8,
    d: 4.4,
    seed: 149,
    count: 10,
    max: 2.9,
    colors: MIX,
    windows: [
      [-0.5, 1.7, -0.7],
      [1.0, 2.2, 0.5],
    ],
  },
  {
    pos: [0.5, -2.6, 14.5],
    w: 5.8,
    d: 4.8,
    seed: 162,
    count: 11,
    max: 3.3,
    colors: WARM,
    windows: [[-1.0, 2.0, 0.9]],
  },
];

function WelcomeBanner({ diveRef }: { diveRef?: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const shown = useRef(true);

  useFrame((state) => {
    if (!group.current) return;
    const dive = diveRef?.current ?? 0;
    // Gentle bob only after fonts/scene settle — avoid micro-motion at rest
    const bob = dive < 0.02 ? 0 : Math.sin(state.clock.elapsedTime * 0.7) * 0.08;
    group.current.position.y = 5.2 + bob;
    const fade = Math.max(0, 1 - dive / 0.5);
    group.current.scale.setScalar(Math.max(0.001, fade));
    if (fade > 0.08) shown.current = true;
    else if (fade < 0.02) shown.current = false;
    if (group.current.visible !== shown.current) group.current.visible = shown.current;
  });

  return (
    <group ref={group} position={[0, 5.2, 6.8]}>
      {/* posts */}
      <Block size={[0.45, 5.2, 0.45]} color={PALETTE.clayDeep} position={[-5.4, -1.4, 0]} radius={0.08} />
      <Block size={[0.45, 5.2, 0.45]} color={PALETTE.clayDeep} position={[5.4, -1.4, 0]} radius={0.08} />
      {/* beam */}
      <Block size={[11.4, 0.55, 0.55]} color={PALETTE.tealDeep} position={[0, 1.2, 0]} radius={0.08} metalness={0.25} roughness={0.4} />
      {/* banner face */}
      <Block size={[10.2, 1.7, 0.22]} color={PALETTE.clay} position={[0, 0.15, 0.2]} radius={0.08} />
      <Block size={[9.6, 1.25, 0.12]} color={PALETTE.ink} position={[0, 0.15, 0.34]} radius={0.06} />
      <Text
        position={[0, 0.35, 0.42]}
        fontSize={0.42}
        color={PALETTE.goldLight}
        anchorX="center"
        anchorY="middle"
        maxWidth={9}
        textAlign="center"
        letterSpacing={0.06}
      >
        WELCOME TO
      </Text>
      <Text
        position={[0, -0.2, 0.42]}
        fontSize={0.62}
        color={PALETTE.white}
        anchorX="center"
        anchorY="middle"
        maxWidth={9.2}
        textAlign="center"
        letterSpacing={0.04}
        outlineWidth={0.02}
        outlineColor={PALETTE.clayDeep}
      >
        TOYING CITY
      </Text>
    </group>
  );
}

export function ToyCity({
  diveRef,
}: {
  diveRef?: React.MutableRefObject<number>;
}) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const bridges = useRef<THREE.Group>(null);
  const fadeBlocks = useRef<(THREE.Group | null)[]>([]);

  const bridgesShown = useRef(true);
  const driftDir = useRef(new THREE.Vector3());

  useFrame(() => {
    const dive = diveRef ? diveRef.current : 0;

    ISLANDS.forEach((isl, i) => {
      const g = refs.current[i];
      if (!g || i === 0) return;
      const dir = driftDir.current.set(isl.pos[0], 0, isl.pos[2]).normalize();
      const drift = dive * 1.8;
      g.position.x = isl.pos[0] + dir.x * drift;
      g.position.z = isl.pos[2] + dir.z * drift;
      g.position.y = isl.pos[1] + dive * 0.5;
    });

    if (bridges.current) {
      const fade = Math.max(0, 1 - dive / 0.38);
      bridges.current.scale.setScalar(Math.max(0.001, fade));
      if (fade > 0.08) bridgesShown.current = true;
      else if (fade < 0.02) bridgesShown.current = false;
      if (bridges.current.visible !== bridgesShown.current) {
        bridges.current.visible = bridgesShown.current;
      }
    }

    fadeBlocks.current.forEach((g) => {
      if (!g) return;
      const hide = Math.max(0, 1 - dive * 2.2);
      g.scale.setScalar(Math.max(0.001, hide));
      const on = hide > 0.04;
      if (g.visible !== on) g.visible = on;
    });
  });

  return (
    <group>
      <WelcomeBanner diveRef={diveRef} />

      <group ref={bridges}>
        {/* inner ring */}
        <Bridge from={[0, -0.2, -3.2]} to={[-11, -1.2, -5]} />
        <Bridge from={[0, -0.2, -3.2]} to={[11.2, -1.0, -4.8]} />
        <Bridge from={[0, -0.2, 3.2]} to={[-10.2, -1.6, 6.2]} />
        <Bridge from={[0, -0.2, 3.2]} to={[10.5, -1.5, 6.5]} />
        {/* outer ring */}
        <Bridge from={[-11, -1.2, -5]} to={[0, -2.0, -13.5]} />
        <Bridge from={[11.2, -1.0, -4.8]} to={[0, -2.0, -13.5]} />
        <Bridge from={[-11, -1.2, -5]} to={[-16.5, -2.2, 0.5]} />
        <Bridge from={[11.2, -1.0, -4.8]} to={[16.8, -2.1, 0.2]} />
        <Bridge from={[-10.2, -1.6, 6.2]} to={[-16.5, -2.2, 0.5]} />
        <Bridge from={[10.5, -1.5, 6.5]} to={[16.8, -2.1, 0.2]} />
        <Bridge from={[-10.2, -1.6, 6.2]} to={[0.5, -2.8, 14.5]} />
        <Bridge from={[10.5, -1.5, 6.5]} to={[0.5, -2.8, 14.5]} />
        <Bridge from={[-11, -1.2, -5]} to={[-12.5, -2.4, -11]} />
        <Bridge from={[11.2, -1.0, -4.8]} to={[13, -2.3, -11.2]} />
        <Bridge from={[-10.2, -1.6, 6.2]} to={[-13.2, -2.6, 12.5]} />
        <Bridge from={[10.5, -1.5, 6.5]} to={[13.5, -2.5, 12.8]} />
      </group>

      {ISLANDS.map((isl, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={isl.pos}>
          <Platform width={isl.w} depth={isl.d} />
          {i === 0 ? (
            <group>
              <PrintStudioBuilding diveRef={diveRef} />

              <group ref={(el) => (fadeBlocks.current[0] = el)} position={[-2.6, 0.2, 1.2]}>
                <Block size={[1.4, 3.4, 1.4]} color={PALETTE.clayLight} position={[0, 1.7, 0]} radius={0.08} />
                <PrintWindow position={[-0.65, 2.0, 0.72]} diveRef={diveRef} phase={0.1} />
                <PrintWindow position={[0.65, 2.6, 0.72]} diveRef={diveRef} phase={0.4} />
              </group>
              <group ref={(el) => (fadeBlocks.current[1] = el)} position={[0.4, 0.2, 2.4]}>
                <Block size={[1.2, 2.8, 1.2]} color={PALETTE.gold} position={[0, 1.4, 0]} radius={0.08} />
                <PrintWindow position={[0, 1.9, 0.62]} diveRef={diveRef} phase={0.7} />
              </group>
              <group ref={(el) => (fadeBlocks.current[2] = el)} position={[-2.2, 0.2, -2.2]}>
                <Block size={[1.3, 3.0, 1.3]} color={PALETTE.teal} position={[0, 1.5, 0]} radius={0.08} />
                <PrintWindow position={[0, 2.1, -0.66]} diveRef={diveRef} phase={0.25} />
              </group>
              <group ref={(el) => (fadeBlocks.current[3] = el)} position={[2.6, 0.2, 0.6]}>
                <Block size={[1.15, 2.5, 1.15]} color={PALETTE.goldLight} position={[0, 1.25, 0]} radius={0.08} />
                <PrintWindow position={[0.58, 1.7, 0]} diveRef={diveRef} phase={0.55} />
              </group>
              {HOME_PRINTERS.filter((p) => p.island === 0).map((p, j) => (
                <HomePrinter
                  key={`hp-0-${j}`}
                  position={p.pos}
                  rotation={[0, p.rot, 0]}
                  phase={p.phase}
                  toyColor={TOY_COLORS[p.color]}
                />
              ))}
            </group>
          ) : (
            <group>
              <Buildings
                seed={isl.seed}
                count={isl.count}
                spread={isl.w * 0.36}
                maxHeight={isl.max}
                colors={isl.colors}
              />
              {isl.windows.map((w, j) => (
                <PrintWindow
                  key={j}
                  position={w}
                  diveRef={diveRef}
                  phase={(isl.seed + j * 17) % 100 / 100}
                />
              ))}
              {HOME_PRINTERS.filter((p) => p.island === i).map((p, j) => (
                <HomePrinter
                  key={`hp-${i}-${j}`}
                  position={p.pos}
                  rotation={[0, p.rot, 0]}
                  phase={p.phase}
                  toyColor={TOY_COLORS[p.color]}
                />
              ))}
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

export { HERO_STUDIO };
