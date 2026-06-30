import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Block, Platform, Buildings, Bridge } from "../parts";
import { PALETTE } from "../palette";
import { PrintStudioBuilding, PrintWindow, HERO_STUDIO } from "./PrintStudioBuilding";

type Vec3 = [number, number, number];

const WARM = [PALETTE.clay, PALETTE.clayLight, PALETTE.gold, PALETTE.goldLight];
const COOL = [PALETTE.teal, PALETTE.tealLight, PALETTE.clay, PALETTE.gold];

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
  {
    pos: [0, 0, 0], w: 6, d: 6, seed: 7, count: 14, max: 3.2, colors: WARM,
    windows: [[-1.9, 1.8, 0.65], [0.5, 2.4, -1.5]],
  },
  {
    pos: [-7.5, -1.2, -3.5], w: 4.2, d: 4.2, seed: 21, count: 9, max: 2.6, colors: COOL,
    windows: [[-0.8, 1.6, 0.9], [1.1, 2.1, -0.5]],
  },
  {
    pos: [7.8, -1.0, -3.2], w: 4.2, d: 4.2, seed: 33, count: 9, max: 2.6, colors: WARM,
    windows: [[-1.0, 1.5, 0.7], [0.9, 2.0, -0.6]],
  },
  {
    pos: [-6.8, -1.6, 4.4], w: 4, d: 4, seed: 48, count: 8, max: 2.3, colors: WARM,
    windows: [[0.7, 1.7, 0.8]],
  },
  {
    pos: [7.2, -1.5, 4.6], w: 4, d: 4, seed: 59, count: 8, max: 2.3, colors: COOL,
    windows: [[-0.6, 1.6, -0.7], [1.0, 2.2, 0.5]],
  },
];

export function ToyCity({
  diveRef,
}: {
  diveRef?: React.MutableRefObject<number>;
}) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const bridges = useRef<THREE.Group>(null);
  const fadeBlocks = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    const dive = diveRef ? diveRef.current : 0;

    ISLANDS.forEach((isl, i) => {
      const g = refs.current[i];
      if (!g || i === 0) return;
      const dir = new THREE.Vector3(isl.pos[0], 0, isl.pos[2]).normalize();
      const drift = dive * 1.4;
      g.position.x = isl.pos[0] + dir.x * drift;
      g.position.z = isl.pos[2] + dir.z * drift;
      g.position.y = isl.pos[1] + dive * 0.4;
    });

    if (bridges.current) {
      bridges.current.visible = dive < 0.4;
      const opacity = Math.max(0, 1 - dive / 0.4);
      bridges.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m) {
            m.transparent = true;
            m.opacity = opacity;
          }
        }
      });
    }

    // Non-hero buildings on central island fade as we enter the studio.
    fadeBlocks.current.forEach((g) => {
      if (!g) return;
      const hide = Math.max(0, 1 - dive * 2.2);
      g.scale.setScalar(hide);
    });
  });

  return (
    <group>
      <group ref={bridges}>
        <Bridge from={[0, -0.2, -2.6]} to={[-7.5, -1.4, -3.5]} />
        <Bridge from={[0, -0.2, -2.6]} to={[7.8, -1.2, -3.2]} />
        <Bridge from={[0, -0.2, 2.6]} to={[-6.8, -1.8, 4.4]} />
        <Bridge from={[0, -0.2, 2.6]} to={[7.2, -1.7, 4.6]} />
      </group>

      {ISLANDS.map((isl, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={isl.pos}>
          <Platform width={isl.w} depth={isl.d} />
          {i === 0 ? (
            <group>
              {/* Hero maker building — camera enters this during Ch.2 */}
              <PrintStudioBuilding diveRef={diveRef} />

              {/* Neighbour block with glowing print windows */}
              <group ref={(el) => (fadeBlocks.current[0] = el)} position={[-1.9, 0.2, 0.5]}>
                <Block size={[1.2, 2.8, 1.2]} color={PALETTE.clayLight} position={[0, 1.4, 0]} radius={0.08} />
                <PrintWindow position={[-0.55, 1.8, 0.62]} diveRef={diveRef} />
                <PrintWindow position={[0.55, 2.2, 0.62]} diveRef={diveRef} />
              </group>
              <group ref={(el) => (fadeBlocks.current[1] = el)} position={[0.2, 0.2, 1.6]}>
                <Block size={[1, 2.2, 1]} color={PALETTE.gold} position={[0, 1.1, 0]} radius={0.08} />
                <PrintWindow position={[0, 1.6, 0.52]} diveRef={diveRef} />
              </group>
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
              {/* Every island has maker windows — the world is always printing */}
              {isl.windows.map((w, j) => (
                <PrintWindow key={j} position={w} diveRef={diveRef} />
              ))}
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

// Re-export for camera targeting.
export { HERO_STUDIO };
