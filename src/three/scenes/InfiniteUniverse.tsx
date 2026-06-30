import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import { Sparkles } from "@react-three/drei";
import { ToyCity } from "./ToyCity";
import { mulberry32 } from "../parts";
import { range } from "../scroll";

// Ch.5 — zoom out: the whole world reconnects against a warm gradient sky.
export function InfiniteUniverse() {
  const scroll = useScroll();
  const cluster = useRef<THREE.Group>(null);

  const worlds = useMemo(() => {
    const rng = mulberry32(99);
    return Array.from({ length: 5 }).map((_, i) => ({
      pos: [(rng() - 0.5) * 22, (rng() - 0.5) * 10, -6 - i * 8] as [number, number, number],
      scale: 0.45 - i * 0.06,
    }));
  }, []);

  useFrame(() => {
    const pull = range(scroll.offset, 0.9, 1, 0, 1);
    if (cluster.current) {
      cluster.current.scale.setScalar(0.6 + pull * 0.5);
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

      <Sparkles count={100} scale={[36, 20, 36]} size={3.5} speed={0.25} color="#FFD23F" opacity={0.7} />
      <Sparkles count={60} scale={[44, 26, 44]} size={2} speed={0.15} color="#6FD0D9" opacity={0.6} />
    </group>
  );
}
