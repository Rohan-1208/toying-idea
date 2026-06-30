import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Block } from "../parts";
import { PALETTE } from "../palette";

type Vec3 = [number, number, number];

// ---- Procedural collectible figurines ----

function Dragon({ color = PALETTE.clay }: { color?: string }) {
  const segs = 9;
  return (
    <group rotation={[0, 0.4, 0]}>
      {Array.from({ length: segs }).map((_, i) => {
        const t = i / (segs - 1);
        const s = 0.55 - t * 0.32;
        const x = (t - 0.5) * 3.2;
        const y = Math.sin(t * Math.PI * 1.6) * 0.55;
        return (
          <group key={i} position={[x, y, 0]}>
            <mesh castShadow>
              <icosahedronGeometry args={[s, 0]} />
              <meshStandardMaterial color={color} roughness={0.5} flatShading />
            </mesh>
            <mesh position={[0, s * 0.8, 0]} castShadow>
              <coneGeometry args={[s * 0.4, s * 0.9, 4]} />
              <meshStandardMaterial color={PALETTE.gold} roughness={0.4} flatShading />
            </mesh>
          </group>
        );
      })}
      <mesh position={[-1.7, 0.1, 0]} castShadow>
        <coneGeometry args={[0.45, 0.9, 6]} />
        <meshStandardMaterial color={color} roughness={0.5} flatShading />
      </mesh>
    </group>
  );
}

function ChessKnight({ color = PALETTE.teal }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.85, 0.4, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.65, 0.7, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.4, 0.1]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.9, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0.05, 1.7, 0.45]} rotation={[0.6, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.7, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Robot({ color = PALETTE.gold }: { color?: string }) {
  return (
    <group>
      <Block size={[1.2, 1.3, 0.9]} color={color} position={[0, 0.7, 0]} radius={0.12} />
      <Block size={[1, 0.9, 0.8]} color={PALETTE.white} position={[0, 1.75, 0]} radius={0.16} />
      <mesh position={[-0.22, 1.8, 0.42]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={PALETTE.teal} emissive={PALETTE.teal} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.22, 1.8, 0.42]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={PALETTE.teal} emissive={PALETTE.teal} emissiveIntensity={0.6} />
      </mesh>
      <Block size={[0.3, 0.9, 0.3]} color={PALETTE.clay} position={[-0.8, 0.7, 0]} radius={0.12} />
      <Block size={[0.3, 0.9, 0.3]} color={PALETTE.clay} position={[0.8, 0.7, 0]} radius={0.12} />
      <Block size={[0.4, 0.6, 0.4]} color={PALETTE.clayDeep} position={[-0.35, -0.1, 0]} radius={0.1} />
      <Block size={[0.4, 0.6, 0.4]} color={PALETTE.clayDeep} position={[0.35, -0.1, 0]} radius={0.1} />
      <mesh position={[0, 2.35, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={PALETTE.clay} emissive={PALETTE.clay} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function Shelf({
  position,
  children,
  spin = 1,
}: {
  position: Vec3;
  children: React.ReactNode;
  spin?: number;
}) {
  const inner = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (inner.current) inner.current.rotation.y = state.clock.elapsedTime * 0.4 * spin;
  });
  return (
    <group position={position}>
      <Block size={[4.6, 0.35, 2.6]} color={PALETTE.creamDeep} radius={0.08} metalness={0.1} roughness={0.7} />
      <Block size={[4.2, 0.1, 2.2]} color={PALETTE.white} position={[0, 0.2, 0]} radius={0.04} />
      <group ref={inner} position={[0, 1.1, 0]}>
        {children}
      </group>
    </group>
  );
}

// Ch.4 — floating display shelves with rotating collectibles.
export function Gallery() {
  return (
    <group>
      <Shelf position={[-5.2, 1.6, 0]} spin={1}>
        <group scale={0.9}>
          <Dragon color={PALETTE.clay} />
        </group>
      </Shelf>
      <Shelf position={[0, -1.2, 1.5]} spin={-1}>
        <ChessKnight color={PALETTE.teal} />
      </Shelf>
      <Shelf position={[5.4, 2.2, -0.5]} spin={1}>
        <Robot color={PALETTE.gold} />
      </Shelf>
      <Shelf position={[-3.4, -2.6, -1]} spin={-1}>
        <group scale={0.7}>
          <Dragon color={PALETTE.teal} />
        </group>
      </Shelf>
      <Shelf position={[4.4, -1.8, 1.8]} spin={1}>
        <ChessKnight color={PALETTE.clayLight} />
      </Shelf>
    </group>
  );
}
