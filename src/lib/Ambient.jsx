// Ambient.jsx — ONE crafted, studio-lit, MATTE machined part.
// Tuned per a deep r3f/Three.js research pass (igloo/lusion-grade + tablet-fast):
//   • matte brushed steel (MeshPhysicalMaterial + low envMapIntensity + faint
//     anisotropy/clearcoat) — NOT glossy chrome; blue is a restrained edge kiss.
//   • filmic grade via the Canvas default ACES tone curve (toneMappingExposure).
//   • env baked ONCE (frames={1}); inline Lightformer studio (no HDR fetch).
//   • render loop HARD-PARKS when the tab is hidden or the canvas is offscreen
//     (setFrameloop) — the big battery/thermal win for a 24/7 console.
//   • adaptive DPR via PerformanceMonitor (survives weak tablets + thermal throttle).
//   • no per-frame cast-shadow pass (ContactShadows carries the ground shadow).
//   • owns + disposes its LatheGeometry (no VRAM leak across logins).
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, ContactShadows, Environment, Lightformer, PerformanceMonitor, AdaptiveEvents, Text3D, Center } from "@react-three/drei";
import { useRef, useMemo, useEffect, useState, Suspense } from "react";
import * as THREE from "three";

// Status tints the single EDGE accent — the metal itself stays steel.
const ACCENT = { ok: "#5EE7FF", warn: "#E0A53C", bad: "#F1564C" };
const FOG = "#06080c";

// A turned spindle profile (radius, height) revolved around Y — grooves + flange
// catch the soft env reflections as it rotates, reading as a real machined part.
function spindleProfile() {
  const p = (r, y) => new THREE.Vector2(r, y);
  return [
    p(0.0, -1.36), p(0.64, -1.36), p(0.64, -1.12),
    p(0.47, -1.0), p(0.64, -0.88), p(0.51, -0.8),
    p(0.51, -0.12), p(0.76, 0.0), p(0.76, 0.16),
    p(0.5, 0.27), p(0.43, 0.31), p(0.43, 0.9),
    p(0.31, 1.05), p(0.31, 1.16), p(0.0, 1.26),
  ];
}

// One-shot boot dolly — the camera eases forward (z 7.2 -> 6.2) on mount so the
// login "boots like an instrument". Isolated from the spindle; runs only while
// the canvas is visible (frameloop is parked offscreen). Hero route only.
function BootDolly() {
  const camera = useThree((s) => s.camera);
  const armed = useRef(false);
  useEffect(() => { camera.position.z = 7.2; armed.current = true; }, [camera]);
  useFrame((_, dt) => {
    if (!armed.current) return;
    if (Math.abs(camera.position.z - 6.2) > 0.002) {
      camera.position.z += (6.2 - camera.position.z) * Math.min(dt, 0.05) * 2.4;
    }
  });
  return null;
}

function Spindle({ status = "ok", scale = 1 }) {
  const tilt = useRef();
  const spin = useRef();
  const rim = useRef();
  const ptr = useRef({ x: 0.2, y: -0.05 });
  const geo = useMemo(() => {
    const g = new THREE.LatheGeometry(spindleProfile(), 128);
    g.computeVertexNormals();
    return g;
  }, []);
  // Own it → dispose it. r3f only auto-disposes declarative resources, not this.
  useEffect(() => () => geo.dispose(), [geo]);

  const setFrameloop = useThree((s) => s.setFrameloop);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const onMove = (e) => {
      ptr.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // HARD-PARK the render loop when hidden/offscreen (0% GPU, no rAF) — restore on return.
  useEffect(() => {
    const apply = (run) => setFrameloop(run ? "always" : "never");
    const onVis = () => apply(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    let io;
    const el = gl?.domElement;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver(([e]) => apply(e.isIntersecting && !document.hidden), { threshold: 0.01 });
      io.observe(el);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
      setFrameloop("always");
    };
  }, [setFrameloop, gl]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    if (spin.current) spin.current.rotation.y += d * (status === "bad" ? 0.2 : 0.11);
    if (tilt.current) {
      tilt.current.rotation.x += ((-ptr.current.y * 0.24) - tilt.current.rotation.x) * 0.04;
      tilt.current.rotation.z += ((ptr.current.x * 0.15) - tilt.current.rotation.z) * 0.04;
    }
  });

  return (
    <group ref={tilt} scale={scale}>
      <group ref={spin} rotation={[0.16, 0, 0.05]}>
        <mesh geometry={geo}>
          {/* matte BRUSHED steel — low envMapIntensity + faint anisotropy streak +
              soft clearcoat lacquer. Reads photographed, not AI-chrome. */}
          <meshPhysicalMaterial
            color="#9aa4b6" metalness={0.7} roughness={0.46} envMapIntensity={0.62}
            anisotropy={0.5} anisotropyRotation={Math.PI / 2} clearcoat={0.22} clearcoatRoughness={0.4}
          />
        </mesh>
      </group>
      {/* restrained electric-blue EDGE kiss (not a flood); shifts with status */}
      <pointLight ref={rim} position={[3.1, 1.5, 1.1]} intensity={3} distance={9} color={ACCENT[status] || ACCENT.ok} />
    </group>
  );
}

export default function Ambient({ status = "ok", variant = "ambient" }) {
  const hero = variant === "hero";
  const [dpr, setDpr] = useState(1.5);
  return (
    <div className={`${hero ? "absolute" : "fixed"} inset-0 pointer-events-none`} style={{ zIndex: 0 }} aria-hidden="true">
      <Canvas
        dpr={dpr}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.2, 6.2], fov: 34 }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.0;
          // preventDefault lets the browser RESTORE a lost context instead of going black for good
          gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault(), false);
        }}
      >
        {/* live FPS-driven DPR — crisp on desktop, survivable on weak/throttling tablets */}
        <PerformanceMonitor onIncline={() => setDpr(2)} onDecline={() => setDpr(1)} flipflops={3} onFallback={() => setDpr(1)} />
        <AdaptiveEvents />
        {hero && <BootDolly />}

        <fog attach="fog" args={[FOG, 6.5, 11]} />
        <ambientLight intensity={0.32} />
        <directionalLight position={[3.5, 6, 4]} intensity={1.15} />
        <directionalLight position={[-4, 2, -2]} intensity={0.4} color="#c6cede" />

        <group position={hero ? [1.25, 0.55, 0] : [2.4, 0.2, 0]}>
          <Float speed={1.0} rotationIntensity={0.1} floatIntensity={0.15}>
            <Spindle status={status} scale={hero ? 1.2 : 1.4} />
          </Float>
          <ContactShadows position={[0, hero ? -1.95 : -2.15, 0]} opacity={0.7} scale={8} blur={2.6} far={4} color="#0a0e16" resolution={256} />
        </group>

        {/* Inline lightformer studio — baked ONCE (frames=1). The reflections live
            here, not in point lights. Mostly neutral; one restrained blue kiss. */}
        <Environment frames={1} resolution={256}>
          <Lightformer intensity={1.5} color="#eef1f7" position={[3, 3, 3]} scale={[7, 7, 1]} />
          <Lightformer intensity={0.9} color="#c6cede" position={[-4, 1, -3]} scale={[6, 6, 1]} />
          <Lightformer intensity={0.6} color="#5EE7FF" position={[-2, -2, 2]} scale={[6, 2, 1]} />
        </Environment>

        {/* in-scene extruded wordmark — matte metal, catches the same studio light
            as the machined part (one milled object). Hero only. */}
        {hero && (
          <Suspense fallback={null}>
            <Float speed={0.9} rotationIntensity={0.06} floatIntensity={0.1}>
              <Center position={[-0.55, 1.0, 0]} rotation={[-0.04, 0.18, 0.02]}>
                <Text3D font="/fonts/helvetiker_bold.typeface.json" size={0.38} height={0.11} curveSegments={5} bevelEnabled bevelThickness={0.014} bevelSize={0.011} bevelSegments={3}>
                  PRANA
                  <meshStandardMaterial color="#9aa4b6" metalness={0.7} roughness={0.46} envMapIntensity={0.62} />
                </Text3D>
              </Center>
            </Float>
          </Suspense>
        )}

        {/* frosted-glass crystal accent — native PBR transmission off the env map
            (cheap, no FBO). Ties to the inset-edge-light button language. Hero only. */}
        {hero && (
          <Float speed={1.4} rotationIntensity={0.6} floatIntensity={0.5}>
            <mesh position={[2.05, -0.5, 0.7]}>
              <icosahedronGeometry args={[0.38, 0]} />
              <meshPhysicalMaterial transmission={1} thickness={0.5} roughness={0.12} ior={1.45} metalness={0} color="#d6f7ff" attenuationColor="#5EE7FF" attenuationDistance={1.2} clearcoat={0.3} clearcoatRoughness={0.2} />
            </mesh>
          </Float>
        )}
      </Canvas>
    </div>
  );
}
