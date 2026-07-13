import { useRef, Suspense } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { ScrollControls, Scroll, useScroll, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { PALETTE } from "./palette";
import { SCROLL_PAGES, MOBILE_SCROLL_PAGES, windowAt, chapterProgress, STOPS } from "./scroll";
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
  fade = 0.05,
  children,
  ...props
}: {
  start: number;
  end: number;
  fade?: number;
  children: React.ReactNode;
} & React.ComponentProps<"group">) {
  const ref = useRef<THREE.Group>(null);
  const scroll = useScroll();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.visible = windowAt(scroll.offset, start, end, fade) > 0.001;
  });
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  );
}

function CityStage() {
  const scroll = useScroll();
  const diveRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const o = scroll.offset;
    diveRef.current = chapterProgress(o, STOPS.dive, STOPS.workshop);
    if (groupRef.current) {
      groupRef.current.visible = windowAt(o, STOPS.hero, STOPS.workshop + 0.08, 0.05) > 0.001;
    }
  });

  return (
    <group ref={groupRef} position={[0, STAGE.city, 0]}>
      <ToyCity diveRef={diveRef} />
    </group>
  );
}

function Lights({ reduced }: { reduced: boolean }) {
  const shadowSize = reduced ? 1024 : 2048;
  return (
    <>
      <hemisphereLight args={[PALETTE.white, PALETTE.creamDeep, 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[12, 18, 8]}
        intensity={reduced ? 1.35 : 1.7}
        castShadow={!reduced}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0004}
        color={"#FFF3DC"}
      />
      <directionalLight position={[-10, 6, -8]} intensity={0.45} color={PALETTE.teal} />
      <pointLight position={[0, 6, 6]} intensity={0.5} color={PALETTE.gold} />
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

      <Stage start={0.42} end={0.72} position={[0, STAGE.workshop, 0]}>
        <PrinterWorkshop />
        {!reduced && (
          <ContactShadows
            position={[0, -1.3, 0]}
            opacity={0.4}
            scale={22}
            blur={2.6}
            far={9}
            color={PALETTE.clayDeep}
          />
        )}
      </Stage>

      <Stage start={0.66} end={0.92} position={[0, STAGE.archive, 0]}>
        <Gallery />
      </Stage>

      <Stage start={0.88} end={1.02} fade={0.04} position={[0, STAGE.universe, 0]}>
        <InfiniteUniverse />
      </Stage>
    </>
  );
}

export function Experience() {
  const { mobile, reducedMotion } = useDeviceProfile();
  const lite = mobile || reducedMotion;
  const scrollPages = mobile ? MOBILE_SCROLL_PAGES : SCROLL_PAGES;

  return (
    <Canvas
      shadows={!lite}
      dpr={lite ? [1, 1.15] : [1, 1.8]}
      gl={{ antialias: !lite, powerPreference: "high-performance" }}
      camera={{ fov: mobile ? 42 : 38, near: 0.1, far: 400, position: [15, 11, 15] }}
    >
      <color attach="background" args={[PALETTE.cream]} />
      <fog attach="fog" args={[PALETTE.cream, lite ? 28 : 34, lite ? 110 : 135]} />

      <Suspense fallback={null}>
        <ScrollControls pages={scrollPages} damping={mobile ? 0.34 : 0.18}>
          <World reduced={lite} />
          <Scroll html style={{ width: "100%" }}>
            <Overlay scrollPages={scrollPages} />
          </Scroll>
        </ScrollControls>
      </Suspense>

      {!lite && (
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.7} />
          <Vignette eskil={false} offset={0.2} darkness={0.45} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
