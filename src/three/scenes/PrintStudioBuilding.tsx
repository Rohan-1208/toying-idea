import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Block } from "../parts";
import { PALETTE } from "../palette";

type Vec3 = [number, number, number];

// Home the camera flies into during the dive (Ch.2).
export const HERO_STUDIO: Vec3 = [1.9, 0.2, -0.85];
const W = 2.6;
const H = 5.4;
const D = 2.6;

/** Home print studio — toys grow as the dive deepens. Story told by motion, not copy. */
function StudioInterior({ diveRef }: { diveRef?: React.MutableRefObject<number> }) {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const printRef = useRef<THREE.Group>(null);
  const gantry = useRef<THREE.Group>(null);
  const nozzle = useRef<THREE.Group>(null);
  const shelfToys = useRef<THREE.Group>(null);
  const warm = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const progress = Math.max(0, Math.min(1, diveRef?.current ?? 0));
    // Print advances with dive; also keeps a gentle loop once inside
    const loop = (state.clock.elapsedTime * 0.22) % 1;
    const t = progress < 0.35 ? progress / 0.35 : Math.min(1, 0.7 + loop * 0.3);

    const printH = 0.15 + t * 1.1;
    if (printRef.current) {
      printRef.current.scale.y = Math.max(0.05, printH / 0.35);
      printRef.current.position.y = 0.08 + printH / 2;
      printRef.current.visible = t > 0.02;
    }
    if (gantry.current) {
      gantry.current.position.y = 0.35 + t * 1.15;
    }
    if (nozzle.current) {
      nozzle.current.position.x = Math.sin(t * Math.PI * 10) * 0.28 * (t > 0.05 && t < 0.98 ? 1 : 0);
    }
    if (glow.current) {
      glow.current.emissiveIntensity = t > 0.05 && t < 0.98 ? 0.6 : 0.25;
    }
    if (shelfToys.current) {
      shelfToys.current.children.forEach((c, i) => {
        c.rotation.y = state.clock.elapsedTime * (0.25 + i * 0.08);
      });
    }
    if (warm.current) {
      warm.current.intensity = 0.6 + progress * 1.2;
    }
  });

  return (
    <group position={[0, 0.05, 0]}>
      {/* floor */}
      <Block size={[W * 0.92, 0.14, D * 0.92]} color={PALETTE.white} radius={0.04} metalness={0.15} roughness={0.5} />
      <Block size={[W * 0.7, 0.06, D * 0.7]} color={PALETTE.creamDeep} position={[0, 0.1, 0]} radius={0.03} />

      {/* Main home printer */}
      <group position={[0, 0, 0.1]}>
        <Block size={[1.35, 0.22, 1.35]} color={PALETTE.tealDeep} position={[0, 0.12, 0]} radius={0.05} />
        <Block size={[1.2, 0.1, 1.2]} color={PALETTE.white} position={[0, 0.26, 0]} radius={0.04} metalness={0.25} roughness={0.4} />
        {/* uprights */}
        <Block size={[0.12, 2.0, 0.12]} color={PALETTE.teal} position={[-0.55, 1.2, -0.5]} radius={0.03} />
        <Block size={[0.12, 2.0, 0.12]} color={PALETTE.teal} position={[0.55, 1.2, -0.5]} radius={0.03} />
        <Block size={[1.35, 0.12, 0.12]} color={PALETTE.tealDeep} position={[0, 2.15, -0.5]} radius={0.03} />

        {/* growing custom toy */}
        <group ref={printRef} position={[0, 0.3, 0.08]}>
          <Block size={[0.55, 0.35, 0.55]} color={PALETTE.clay} radius={0.05} />
          <Block size={[0.4, 0.28, 0.4]} color={PALETTE.gold} position={[0, 0.3, 0]} radius={0.04} />
          <Block size={[0.22, 0.35, 0.22]} color={PALETTE.tealLight} position={[0, 0.55, 0]} radius={0.04} />
          {/* little “head” */}
          <mesh position={[0, 0.85, 0.08]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial color={PALETTE.clayLight} roughness={0.45} />
          </mesh>
        </group>

        <group ref={gantry} position={[0, 0.4, -0.2]}>
          <Block size={[1.3, 0.1, 0.14]} color={PALETTE.gold} position={[0, 0, -0.28]} radius={0.03} />
          <group ref={nozzle} position={[0, -0.05, 0]}>
            <Block size={[0.28, 0.22, 0.28]} color={PALETTE.white} position={[0, 0, 0.05]} radius={0.04} />
            <mesh position={[0, -0.22, 0.05]}>
              <coneGeometry args={[0.08, 0.16, 10]} />
              <meshStandardMaterial
                ref={glow}
                color={PALETTE.clay}
                emissive={PALETTE.gold}
                emissiveIntensity={0.7}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* Finished toys on a shelf — this home already printed a few */}
      <group position={[0, 1.15, -0.95]}>
        <Block size={[1.8, 0.12, 0.4]} color={PALETTE.creamDeep} radius={0.04} />
        <group ref={shelfToys}>
          <mesh position={[-0.55, 0.28, 0]}>
            <icosahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial color={PALETTE.clay} flatShading roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[0.22, 0.32, 0.22]} />
            <meshStandardMaterial color={PALETTE.gold} flatShading roughness={0.4} />
          </mesh>
          <mesh position={[0.5, 0.24, 0]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color={PALETTE.teal} flatShading roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* soft room lights */}
      <pointLight ref={warm} position={[0, 2.4, 0.4]} intensity={1.2} color="#FFF0D4" distance={7} />
      <pointLight position={[-0.6, 1.2, 0.3]} intensity={0.5} color={PALETTE.gold} distance={4} />
      <pointLight position={[0.5, 1.0, 0.2]} intensity={0.35} color={PALETTE.teal} distance={3.5} />
    </group>
  );
}

/** The home tower the camera enters — walls open so you see the print studio. */
export function PrintStudioBuilding({
  diveRef,
}: {
  diveRef?: React.MutableRefObject<number>;
}) {
  const roofRefs = useRef<(THREE.Group | null)[]>([]);
  const frontWall = useRef<THREE.Group>(null);
  const sideWalls = useRef<(THREE.Group | null)[]>([]);
  const ventMat = useRef<THREE.MeshStandardMaterial>(null);
  const doorGlow = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const p = Math.max(0, Math.min(1, diveRef?.current ?? 0));
    const peel = Math.min(1, p * 1.15);

    // Roof flaps open
    const rots: [number, number, number][] = [
      [peel * 1.25, 0, 0],
      [-peel * 1.25, 0, 0],
      [0, 0, -peel * 0.7],
      [0, 0, peel * 0.7],
    ];
    roofRefs.current.forEach((g, i) => {
      if (g) g.rotation.set(...rots[i]);
    });

    // Front wall slides down — no per-frame material opacity (causes flicker)
    if (frontWall.current) {
      frontWall.current.position.y = -peel * 2.8;
      const on = peel < 0.92;
      if (frontWall.current.visible !== on) frontWall.current.visible = on;
    }

    // Side walls hinge slightly open for a cutaway view
    if (sideWalls.current[0]) sideWalls.current[0].rotation.z = -peel * 0.55;
    if (sideWalls.current[1]) sideWalls.current[1].rotation.z = peel * 0.55;

    if (ventMat.current) {
      ventMat.current.emissiveIntensity = 0.4 + p * 0.5;
    }
    if (doorGlow.current) {
      doorGlow.current.emissiveIntensity = 0.25 + (1 - peel) * 0.4;
    }
  });

  return (
    <group position={HERO_STUDIO}>
      {/* Back wall stays — home silhouette */}
      <Block size={[W, H, 0.22]} color={PALETTE.tealDeep} position={[0, H / 2, -D / 2]} radius={0.08} />

      {/* Front wall (slides away on dive) */}
      <group ref={frontWall} position={[0, 0, D / 2]}>
        <Block size={[W, H, 0.22]} color={PALETTE.teal} position={[0, H / 2, 0]} radius={0.08} />
        {/* door glow — invites the camera in */}
        <mesh position={[0, 1.1, 0.12]}>
          <planeGeometry args={[0.7, 1.5]} />
          <meshStandardMaterial
            ref={doorGlow}
            color={PALETTE.goldLight}
            emissive={PALETTE.gold}
            emissiveIntensity={0.4}
            toneMapped={false}
          />
        </mesh>
        <PrintWindow position={[0.7, 3.2, 0.12]} phase={0.2} inline={true} />
        <PrintWindow position={[-0.65, 3.6, 0.12]} phase={0.6} inline={true} />
      </group>

      {/* Side walls hinge open */}
      <group ref={(el) => (sideWalls.current[0] = el)} position={[-W / 2, 0, 0]}>
        <Block size={[0.22, H, D]} color={PALETTE.tealLight} position={[0, H / 2, 0]} radius={0.06} />
      </group>
      <group ref={(el) => (sideWalls.current[1] = el)} position={[W / 2, 0, 0]}>
        <Block size={[0.22, H, D]} color={PALETTE.tealLight} position={[0, H / 2, 0]} radius={0.06} />
      </group>

      {/* gold maker band */}
      <Block size={[W + 0.15, 0.28, D + 0.15]} color={PALETTE.gold} position={[0, H * 0.52, 0]} radius={0.04} />

      <StudioInterior diveRef={diveRef} />

      {/* Roof flaps */}
      <group>
        <group ref={(el) => (roofRefs.current[0] = el)} position={[0, H + 0.1, D / 2 + 0.05]}>
          <Block size={[W + 0.25, 0.32, 0.4]} color={PALETTE.white} radius={0.05} />
        </group>
        <group ref={(el) => (roofRefs.current[1] = el)} position={[0, H + 0.1, -D / 2 - 0.05]}>
          <Block size={[W + 0.25, 0.32, 0.4]} color={PALETTE.white} radius={0.05} />
        </group>
      </group>
      <group ref={(el) => (roofRefs.current[2] = el)} position={[-W / 2 - 0.05, H + 0.1, 0]}>
        <Block size={[0.4, 0.32, D + 0.25]} color={PALETTE.creamDeep} radius={0.05} />
      </group>
      <group ref={(el) => (roofRefs.current[3] = el)} position={[W / 2 + 0.05, H + 0.1, 0]}>
        <Block size={[0.4, 0.32, D + 0.25]} color={PALETTE.creamDeep} radius={0.05} />
      </group>

      <mesh position={[W * 0.32, H + 0.55, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 0.55, 8]} />
        <meshStandardMaterial ref={ventMat} color={PALETTE.clayDeep} emissive={PALETTE.clay} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

/** Window with a tiny printer — used on homes across the city. */
export function PrintWindow({
  position,
  diveRef,
  phase = 0,
  inline = false,
}: {
  position: Vec3;
  diveRef?: React.MutableRefObject<number>;
  phase?: number;
  inline?: boolean;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const toy = useRef<THREE.Group>(null);
  const gantry = useRef<THREE.Group>(null);

  useFrame((state) => {
    const p = diveRef?.current ?? 0;
    const t = (state.clock.elapsedTime * 0.28 + phase) % 1;
    // Static emissive — pulsing + bloom was the opening flicker
    if (mat.current) {
      mat.current.emissiveIntensity = 0.42 + p * 0.12;
    }
    if (toy.current) {
      const h = 0.04 + t * 0.16;
      toy.current.scale.y = h / 0.08;
      toy.current.position.y = -0.06 + h / 2;
    }
    if (gantry.current) {
      gantry.current.position.y = -0.02 + t * 0.2;
      gantry.current.position.x = Math.sin(t * Math.PI * 4) * 0.04;
    }
  });

  const toyColor = [PALETTE.clay, PALETTE.gold, PALETTE.teal, PALETTE.clayLight][Math.floor(phase * 3) % 4];

  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={inline ? [0.42, 0.38] : [0.52, 0.45]} />
        <meshStandardMaterial
          ref={mat}
          color={PALETTE.goldLight}
          emissive={PALETTE.gold}
          emissiveIntensity={0.42}
          // Opaque — transparent planes sort-flicker across the city
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -0.12, 0.03]}>
        <boxGeometry args={[0.3, 0.09, 0.06]} />
        <meshStandardMaterial color={PALETTE.tealDeep} />
      </mesh>
      <group ref={gantry} position={[0, 0, 0.04]}>
        <mesh>
          <boxGeometry args={[0.24, 0.03, 0.03]} />
          <meshStandardMaterial color={PALETTE.gold} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <coneGeometry args={[0.028, 0.07, 6]} />
          <meshStandardMaterial color={PALETTE.clay} emissive={PALETTE.gold} emissiveIntensity={0.55} />
        </mesh>
      </group>
      <group ref={toy} position={[0, -0.06, 0.05]}>
        <mesh>
          <boxGeometry args={[0.11, 0.09, 0.11]} />
          <meshStandardMaterial color={toyColor} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Street-level home printer — readable from the city view. */
export function HomePrinter({
  position,
  rotation = [0, 0, 0],
  phase = 0,
  toyColor = PALETTE.clay,
}: {
  position: Vec3;
  rotation?: Vec3;
  phase?: number;
  toyColor?: string;
}) {
  const printRef = useRef<THREE.Group>(null);
  const gantry = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    const t = (state.clock.elapsedTime * 0.22 + phase) % 1;
    const printH = 0.08 + t * 0.45;
    if (printRef.current) {
      printRef.current.scale.y = printH / 0.15;
      printRef.current.position.y = 0.12 + printH / 2;
    }
    if (gantry.current) {
      gantry.current.position.y = 0.25 + t * 0.55;
      gantry.current.position.x = Math.sin(t * Math.PI * 5) * 0.14;
    }
    if (glow.current) {
      glow.current.emissiveIntensity = 0.45;
    }
  });

  return (
    <group position={position} rotation={rotation} scale={0.85}>
      <Block size={[0.9, 0.12, 0.9]} color={PALETTE.white} position={[0, 0.06, 0]} radius={0.04} metalness={0.2} roughness={0.45} />
      <Block size={[1.05, 0.14, 1.05]} color={PALETTE.tealDeep} position={[0, -0.05, 0]} radius={0.04} />
      <Block size={[0.12, 1.35, 0.12]} color={PALETTE.teal} position={[-0.42, 0.7, -0.38]} radius={0.03} />
      <Block size={[0.12, 1.35, 0.12]} color={PALETTE.teal} position={[0.42, 0.7, -0.38]} radius={0.03} />
      <Block size={[1.05, 0.1, 0.12]} color={PALETTE.tealDeep} position={[0, 1.35, -0.38]} radius={0.03} />
      <group ref={printRef} position={[0, 0.12, 0.05]}>
        <Block size={[0.35, 0.15, 0.35]} color={toyColor} radius={0.04} />
        <Block size={[0.22, 0.12, 0.22]} color={PALETTE.gold} position={[0, 0.14, 0]} radius={0.03} />
        <Block size={[0.12, 0.18, 0.12]} color={PALETTE.clayLight} position={[0, 0.28, 0]} radius={0.03} />
      </group>
      <group ref={gantry} position={[0, 0.25, -0.15]}>
        <Block size={[0.95, 0.08, 0.12]} color={PALETTE.gold} position={[0, 0, -0.2]} radius={0.03} />
        <Block size={[0.22, 0.18, 0.22]} color={PALETTE.white} position={[0, -0.08, 0]} radius={0.04} />
        <mesh position={[0, -0.22, 0]}>
          <coneGeometry args={[0.06, 0.12, 8]} />
          <meshStandardMaterial ref={glow} color={PALETTE.clay} emissive={PALETTE.gold} emissiveIntensity={0.55} />
        </mesh>
      </group>
    </group>
  );
}
