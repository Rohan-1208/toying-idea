import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useScroll, Sparkles } from "@react-three/drei";
import { ToyCity } from "./ToyCity";
import { mulberry32 } from "../parts";
import { range } from "../scroll";

// Ch.5 — zoom out: the world reconnects (one full city + light distant clones).
export function InfiniteUniverse() {
  const scroll = useScroll();
  const cluster = useRef<THREE.Group>(null);
  const scaleRef = useRef(0.6);

  const worlds = useMemo(() => {
    const rng = mulberry32(99);
    return Array.from({ length: 2 }).map((_, i) => ({
      pos: [(rng() - 0.5) * 18, (rng() - 0.5) * 8, -8 - i * 10] as [number, number, number],
      scale: 0.38 - i * 0.08,
    }));
  }, []);

  useFrame((_, dt) => {
    const pull = range(scroll.offset, 0.9, 1, 0, 1);
    const target = 0.6 + pull * 0.5;
    scaleRef.current += (target - scaleRef.current) * (1 - Math.exp(-dt * 6));
    if (cluster.current) {
      cluster.current.scale.setScalar(scaleRef.current);
      cluster.current.position.y = pull * 3;
    }
  });

  return (
    <group ref={cluster}>
      <ToyCity />

      {worlds.map((w, i) => (
        <group key={i} position={w.pos} scale={w.scale}>
          <ToyCity />
        </group>
      ))}

      <Sparkles count={60} scale={[36, 20, 36]} size={3.5} speed={0.2} color="#FFD23F" opacity={0.55} />
      <Sparkles count={40} scale={[44, 26, 44]} size={2} speed={0.12} color="#6FD0D9" opacity={0.45} />
    </group>
  );
}
