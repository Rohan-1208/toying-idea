import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Block } from "../parts";
import { PALETTE } from "../palette";

type Vec3 = [number, number, number];

// Hero building world position on the central island (camera flies here during Ch.2).
export const HERO_STUDIO: Vec3 = [1.9, 0.2, -0.85];
const W = 1.7;
const H = 4.8;
const D = 1.7;

/** Compact interior — printers, beds, glowing layers (scroll-driven). */
function StudioInterior({ diveRef }: { diveRef?: React.MutableRefObject<number> }) {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const printRef = useRef<THREE.Group>(null);
  const stackRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const progress = diveRef?.current ?? 0;
    const printH = 0.2 + progress * 1.4;
    if (printRef.current) {
      printRef.current.scale.y = printH / 0.2;
      printRef.current.position.y = 0.06 + printH / 2;
    }
    if (stackRef.current) {
      stackRef.current.children[0].scale.y = 0.5 + progress * 1.2;
      stackRef.current.children[1].scale.y = 0.5 + progress * 1.0;
    }
    if (glow.current) {
      glow.current.emissiveIntensity =
        0.5 + Math.sin(state.clock.elapsedTime * 4) * 0.15 * (progress > 0.2 ? 1 : 0);
    }
  });

  return (
    <group position={[0, 0.05, 0]}>
      <Block size={[W * 0.88, 0.12, D * 0.88]} color={PALETTE.white} radius={0.04} metalness={0.2} roughness={0.5} />

      <group position={[-0.45, 0, -0.15]}>
        <Block size={[0.55, 0.5, 0.55]} color={PALETTE.clay} position={[0, 0.25, 0]} radius={0.06} />
        <Block size={[0.08, 1.1, 0.08]} color={PALETTE.tealDeep} position={[-0.22, 0.8, -0.18]} radius={0.03} />
        <Block size={[0.08, 1.1, 0.08]} color={PALETTE.tealDeep} position={[0.22, 0.8, -0.18]} radius={0.03} />
        <Block size={[0.5, 0.06, 0.08]} color={PALETTE.gold} position={[0, 1.35, -0.18]} radius={0.02} />
        <group ref={printRef} position={[0, 0.06, 0.05]}>
          <Block size={[0.28, 0.2, 0.28]} color={PALETTE.clayLight} radius={0.04} />
        </group>
        <mesh position={[0, 0.9, 0.05]}>
          <coneGeometry args={[0.06, 0.14, 8]} />
          <meshStandardMaterial ref={glow} color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={0.6} />
        </mesh>
      </group>

      <group position={[0.42, 0, 0.12]}>
        <Block size={[0.5, 0.45, 0.5]} color={PALETTE.teal} position={[0, 0.22, 0]} radius={0.06} />
        <group ref={stackRef} position={[0, 0.08, 0.08]}>
          <Block size={[0.22, 0.18, 0.22]} color={PALETTE.gold} radius={0.03} />
          <Block size={[0.16, 0.14, 0.16]} color={PALETTE.clay} position={[0, 0.16, 0]} radius={0.03} />
        </group>
      </group>

      <Block size={[0.9, 0.35, 0.25]} color={PALETTE.creamDeep} position={[0, 0.55, -0.55]} radius={0.04} />
      <Block size={[0.2, 0.35, 0.2]} color={PALETTE.tealLight} position={[-0.25, 0.72, -0.55]} radius={0.03} />
      <Block size={[0.18, 0.28, 0.18]} color={PALETTE.gold} position={[0, 0.68, -0.55]} radius={0.03} />
      <Block size={[0.22, 0.4, 0.22]} color={PALETTE.clay} position={[0.25, 0.75, -0.55]} radius={0.03} />

      <pointLight position={[0, 2, 0.5]} intensity={1.1} color="#FFF0D4" distance={5} />
      <pointLight position={[-0.4, 1, 0]} intensity={0.4} color={PALETTE.teal} distance={3} />
    </group>
  );
}

// The building the camera enters — exterior peels open to reveal the print studio inside.
export function PrintStudioBuilding({
  diveRef,
}: {
  diveRef?: React.MutableRefObject<number>;
}) {
  const roofRefs = useRef<(THREE.Group | null)[]>([]);
  const ventMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const p = Math.max(0, Math.min(1, diveRef?.current ?? 0));
    const peel = p * 0.7;

    const rots: [number, number, number][] = [
      [peel * 1.1, 0, 0],
      [-peel * 1.1, 0, 0],
      [0, 0, -peel * 0.5],
      [0, 0, peel * 0.5],
    ];
    roofRefs.current.forEach((g, i) => {
      if (g) g.rotation.set(...rots[i]);
    });

    if (ventMat.current) {
      ventMat.current.emissiveIntensity = 0.3 + p * 0.5;
    }
  });

  return (
    <group position={HERO_STUDIO}>
      {/* Exterior walls — hollow box */}
      <Block size={[W, H, 0.2]} color={PALETTE.teal} position={[0, H / 2, D / 2]} radius={0.08} />
      <Block size={[W, H, 0.2]} color={PALETTE.tealDeep} position={[0, H / 2, -D / 2]} radius={0.08} />
      <Block size={[0.2, H, D]} color={PALETTE.tealLight} position={[-W / 2, H / 2, 0]} radius={0.06} />
      <Block size={[0.2, H, D]} color={PALETTE.tealLight} position={[W / 2, H / 2, 0]} radius={0.06} />

      {/* Accent band — signals "this is a maker building" */}
      <Block size={[W + 0.1, 0.25, D + 0.1]} color={PALETTE.gold} position={[0, H * 0.55, 0]} radius={0.04} />

      {/* Interior studio (revealed as roof opens) */}
      <StudioInterior diveRef={diveRef} />

      <group>
        <group ref={(el) => (roofRefs.current[0] = el)} position={[0, H + 0.1, D / 2 + 0.05]}>
          <Block size={[W + 0.2, 0.3, 0.35]} color={PALETTE.white} radius={0.05} />
        </group>
        <group ref={(el) => (roofRefs.current[1] = el)} position={[0, H + 0.1, -D / 2 - 0.05]}>
          <Block size={[W + 0.2, 0.3, 0.35]} color={PALETTE.white} radius={0.05} />
        </group>
      </group>
      <group ref={(el) => (roofRefs.current[2] = el)} position={[-W / 2 - 0.05, H + 0.1, 0]}>
        <Block size={[0.35, 0.3, D + 0.2]} color={PALETTE.creamDeep} radius={0.05} />
      </group>
      <group ref={(el) => (roofRefs.current[3] = el)} position={[W / 2 + 0.05, H + 0.1, 0]}>
        <Block size={[0.35, 0.3, D + 0.2]} color={PALETTE.creamDeep} radius={0.05} />
      </group>

      {/* Chimney / vent with warm print glow */}
      <mesh position={[W * 0.35, H + 0.5, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.5, 8]} />
        <meshStandardMaterial ref={ventMat} color={PALETTE.clayDeep} emissive={PALETTE.clay} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

/** Glowing windows on regular buildings — every block is making something. */
export function PrintWindow({
  position,
  diveRef,
}: {
  position: Vec3;
  diveRef?: React.MutableRefObject<number>;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    const p = diveRef?.current ?? 0;
    if (mat.current) {
      mat.current.emissiveIntensity =
        0.25 + Math.sin(state.clock.elapsedTime * 3 + position[0]) * 0.1 + p * 0.35;
    }
  });
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[0.35, 0.35]} />
        <meshStandardMaterial
          ref={mat}
          color={PALETTE.goldLight}
          emissive={PALETTE.gold}
          emissiveIntensity={0.4}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* tiny printer silhouette visible through window */}
      <mesh position={[0, -0.08, 0.02]}>
        <boxGeometry args={[0.18, 0.12, 0.04]} />
        <meshStandardMaterial color={PALETTE.clay} emissive={PALETTE.clay} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}
