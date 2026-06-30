import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import { Block } from "../parts";
import { PALETTE } from "../palette";
import { range, clamp, STOPS } from "../scroll";

// A stylized FDM 3D printer that prints a little castle as you scroll past 50%.
export function PrinterWorkshop() {
  const gantry = useRef<THREE.Group>(null);
  const nozzle = useRef<THREE.Group>(null);
  const printRef = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const scroll = useScroll();

  // The model is built from layered slabs that reveal bottom-to-top.
  const layers = [
    { y: 0.25, w: 2.4, d: 2.4, h: 0.5, c: PALETTE.gold },
    { y: 0.75, w: 2.1, d: 2.1, h: 0.5, c: PALETTE.clayLight },
    { y: 1.25, w: 1.7, d: 1.7, h: 0.5, c: PALETTE.clay },
    { y: 1.75, w: 1.3, d: 1.3, h: 0.5, c: PALETTE.gold },
    { y: 2.25, w: 0.9, d: 0.9, h: 0.5, c: PALETTE.clayLight },
    { y: 2.8, w: 0.5, d: 0.5, h: 0.7, c: PALETTE.teal },
  ];

  useFrame((state) => {
    const o = scroll.offset;
    const p = range(o, STOPS.workshop, STOPS.archive);
    const totalH = 3.2;

    if (gantry.current) {
      gantry.current.position.y = 0.6 + p * totalH;
    }
    if (nozzle.current) {
      // Nozzle weave tied to print progress, not free-running time.
      nozzle.current.position.x = Math.sin(p * Math.PI * 8) * 0.8 * (p > 0.02 && p < 0.98 ? 1 : 0);
    }
    if (printRef.current) {
      printRef.current.children.forEach((child, i) => {
        const start = i / layers.length;
        const end = (i + 1) / layers.length;
        const reveal = clamp(range(p, start, end));
        child.scale.y = reveal;
        child.visible = reveal > 0.001;
        // anchor growth to the layer's base
        const layer = layers[i];
        (child as THREE.Group).position.y = layer.y - layer.h / 2 + (layer.h * reveal) / 2;
      });
    }
    if (glow.current) {
      const active = p > 0.02 && p < 0.98 ? 1 : 0.15;
      glow.current.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 8) * 0.25 * active;
    }
  });

  return (
    <group>
      {/* print bed */}
      <Block size={[5, 0.4, 5]} color={PALETTE.white} position={[0, 0, 0]} radius={0.08} metalness={0.3} roughness={0.4} />
      <Block size={[5.4, 0.5, 5.4]} color={PALETTE.tealDeep} position={[0, -0.4, 0]} radius={0.08} />

      {/* printed model (grows layer by layer) */}
      <group ref={printRef} position={[0, 0.2, 0]}>
        {layers.map((l, i) => (
          <group key={i} position={[0, l.y, 0]}>
            <Block size={[l.w, l.h, l.d]} color={l.c} radius={0.06} />
            {/* little corner turrets on the base layers */}
            {i < 3 &&
              [
                [-l.w / 2, -l.d / 2],
                [l.w / 2, -l.d / 2],
                [-l.w / 2, l.d / 2],
                [l.w / 2, l.d / 2],
              ].map(([x, z], k) => (
                <Block key={k} size={[0.35, l.h * 1.4, 0.35]} color={PALETTE.clayDeep} position={[x, 0, z]} radius={0.04} />
              ))}
          </group>
        ))}
      </group>

      {/* printer frame: base + uprights */}
      <Block size={[6.4, 0.6, 6]} color={PALETTE.clay} position={[0, -0.85, 0]} radius={0.1} />
      <Block size={[0.6, 8, 0.6]} color={PALETTE.tealDeep} position={[-3.1, 3.2, -2.6]} radius={0.08} metalness={0.4} roughness={0.4} />
      <Block size={[0.6, 8, 0.6]} color={PALETTE.tealDeep} position={[3.1, 3.2, -2.6]} radius={0.08} metalness={0.4} roughness={0.4} />
      <Block size={[7, 0.6, 0.6]} color={PALETTE.tealDeep} position={[0, 7, -2.6]} radius={0.08} metalness={0.4} roughness={0.4} />

      {/* moving gantry bar */}
      <group ref={gantry} position={[0, 0.6, 0]}>
        <Block size={[6.6, 0.4, 0.7]} color={PALETTE.gold} position={[0, 0, -2.6]} radius={0.06} metalness={0.5} roughness={0.3} />
        <Block size={[6.6, 0.25, 0.5]} color={PALETTE.clayLight} position={[0, 0, -1.6]} radius={0.05} />
        {/* print head carriage */}
        <group ref={nozzle} position={[0, -0.1, -1.6]}>
          <Block size={[1, 0.8, 1]} color={PALETTE.white} position={[0, -0.2, 0]} radius={0.08} metalness={0.4} roughness={0.3} />
          {/* hot nozzle cone */}
          <mesh position={[0, -0.85, 0]} castShadow>
            <coneGeometry args={[0.22, 0.5, 16]} />
            <meshStandardMaterial ref={glow} color={PALETTE.clay} emissive={PALETTE.gold} emissiveIntensity={0.7} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
