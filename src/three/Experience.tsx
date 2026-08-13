import { useRef, Suspense, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { ScrollControls, Scroll, useScroll, ContactShadows } from "@react-three/drei";
import { EffectComposer, Vignette } from "@react-three/postprocessing";
import { PALETTE } from "./palette";
import { SCROLL_PAGES, MOBILE_SCROLL_PAGES, windowAt, chapterProgress, STOPS, lerp } from "./scroll";
import { CameraRig } from "./CameraRig";
import { ScrollBridge } from "./ScrollBridge";
import { ToyCity } from "./scenes/ToyCity";
import { PrinterWorkshop } from "./scenes/PrinterWorkshop";
import { Gallery } from "./scenes/Gallery";
import { InfiniteUniverse } from "./scenes/InfiniteUniverse";
import { Overlay } from "../ui/Overlay";
import { useDeviceProfile } from "../hooks/useDeviceProfile";

const STAGE = {
  city: 0,
  workshop: -40,
  archive: -80,
  universe: -120,
};

function Stage({
  start,
  end,
  fade = 0.1,
  children,
  ...props
}: {
  start: number;
  end: number;
  fade?: number;
  children: React.ReactNode;
} & React.ComponentProps<"group">) {
  const ref = useRef<THREE.Group>(null);
  const shown = useRef(false);
  const scroll = useScroll();

  useFrame(() => {
    if (!ref.current) return;
    const v = windowAt(scroll.offset, start, end, fade);
    if (v > 0.12) shown.current = true;
    else if (v < 0.02) shown.current = false;
    if (ref.current.visible !== shown.current) {
      ref.current.visible = shown.current;
    }
  });

  return (
    <group ref={ref} {...props} visible={false}>
      {children}
    </group>
  );
}

function CityStage() {
  const scroll = useScroll();
  const diveRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  const shown = useRef(true);

  useFrame((_, dt) => {
    const o = scroll.offset;
    const target = chapterProgress(o, STOPS.dive, STOPS.workshop);
    // Faster settle near rest so opening frames don't oscillate
    const rate = o < 0.08 ? 14 : 8;
    diveRef.current = lerp(diveRef.current, target, 1 - Math.exp(-dt * rate));

    const v = windowAt(o, STOPS.hero, 0.64, 0.1);
    if (v > 0.1) shown.current = true;
    else if (v < 0.02) shown.current = false;
    if (groupRef.current && groupRef.current.visible !== shown.current) {
      groupRef.current.visible = shown.current;
    }
  });

  return (
    <group ref={groupRef} position={[0, STAGE.city, 0]}>
      <ToyCity diveRef={diveRef} />
    </group>
  );
}

function Lights({ reduced }: { reduced: boolean }) {
  const scroll = useScroll();
  const fill = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fillAmt = useRef(0.55);
  const shadowSize = reduced ? 1024 : 2048;
  const shadowsOn = useRef(false);

  useFrame((_, dt) => {
    const o = scroll.offset;
    const indoors = windowAt(o, 0.3, 0.55, 0.1);
    const handoff = windowAt(o, 0.48, 0.64, 0.12);
    const target = 0.55 + indoors * 0.35 + handoff * 0.2;
    fillAmt.current = lerp(fillAmt.current, target, 1 - Math.exp(-dt * 5));
    if (fill.current) fill.current.intensity = fillAmt.current;

    // Keep shadows off during the opening city view — map acne looks like flicker
    const wantShadows = !reduced && o > 0.18;
    if (key.current && shadowsOn.current !== wantShadows) {
      key.current.castShadow = wantShadows;
      shadowsOn.current = wantShadows;
    }
  });

  return (
    <>
      <hemisphereLight args={[PALETTE.white, PALETTE.creamDeep, 1.1]} />
      <ambientLight ref={fill} intensity={0.55} />
      <directionalLight
        ref={key}
        position={[12, 18, 8]}
        intensity={reduced ? 1.25 : 1.4}
        castShadow={false}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-far={60}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
        color={"#FFF3DC"}
      />
      <directionalLight position={[-10, 6, -8]} intensity={0.4} color={PALETTE.teal} />
      <pointLight position={[0, 6, 6]} intensity={0.4} color={PALETTE.gold} />
      <pointLight position={[2, -20, 8]} intensity={0.7} color="#FFF3DC" distance={40} />
      <pointLight position={[0, -36, 6]} intensity={1.0} color="#FFF0D4" distance={28} />
    </>
  );
}

function World({ reduced }: { reduced: boolean }) {
  return (
    <>
      <CameraRig />
      <ScrollBridge />
      <Lights reduced={reduced} />

      <CityStage />

      <Stage start={0.36} end={0.8} fade={0.12} position={[0, STAGE.workshop, 0]}>
        <PrinterWorkshop />
        {!reduced && (
          <ContactShadows
            position={[0, -1.3, 0]}
            opacity={0.3}
            scale={22}
            blur={2.8}
            far={9}
            color={PALETTE.clayDeep}
            frames={1}
          />
        )}
      </Stage>

      <Stage start={0.6} end={0.95} fade={0.12} position={[0, STAGE.archive, 0]}>
        <Gallery />
      </Stage>

      <Stage start={0.84} end={1.05} fade={0.1} position={[0, STAGE.universe, 0]}>
        <InfiniteUniverse />
      </Stage>
    </>
  );
}

/** Soft vignette only — bloom made the opening city strobe with emissive windows. */
function SoftVignette({ ready }: { ready: boolean }) {
  if (!ready) return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Vignette eskil={false} offset={0.35} darkness={0.18} />
    </EffectComposer>
  );
}

export function Experience() {
  const { mobile, reducedMotion } = useDeviceProfile();
  const lite = mobile || reducedMotion;
  const scrollPages = mobile ? MOBILE_SCROLL_PAGES : SCROLL_PAGES;
  const [fxReady, setFxReady] = useState(false);

  useEffect(() => {
    // Let the first frames settle before mounting postprocessing
    const t = window.setTimeout(() => setFxReady(true), lite ? 200 : 600);
    return () => window.clearTimeout(t);
  }, [lite]);

  return (
    <Canvas
      shadows={!lite}
      dpr={lite ? [1, 1] : [1, 1.5]}
      gl={{
        antialias: !lite,
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
        depth: true,
      }}
      camera={{ fov: mobile ? 44 : 40, near: 0.1, far: 400, position: [24, 16, 24] }}
      frameloop="always"
    >
      <color attach="background" args={[PALETTE.cream]} />
      <fog attach="fog" args={[PALETTE.cream, lite ? 42 : 55, lite ? 145 : 175]} />

      <Suspense fallback={null}>
        <ScrollControls pages={scrollPages} damping={mobile ? 0.45 : 0.35}>
          <World reduced={lite} />
          <Scroll html style={{ width: "100%" }}>
            <Overlay scrollPages={scrollPages} />
          </Scroll>
        </ScrollControls>
      </Suspense>

      {!lite && <SoftVignette ready={fxReady} />}
    </Canvas>
  );
}
