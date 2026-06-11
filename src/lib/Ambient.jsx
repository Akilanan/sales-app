// Ambient.jsx — the cinematic 3D layer of the login.
//
// A studio-lit EXPLODED-VIEW machined spindle in a dark volume with a teal-&-orange
// film grade, volumetric-style light shafts, and a cursor-reactive ember storm.
// Tuned per a deep r3f/Three.js pass (igloo/lusion-grade, tablet-fast):
//   • the spindle is FOUR separate machined parts (closed lathe solids). Hovering
//     near it eases them apart along the axis (damped, spring-like) and they
//     reassemble when the cursor leaves — an engineering exploded drawing, live.
//   • god-ray style light shafts: additive gradient planes (CanvasTexture baked
//     once) — NOT WebGL postprocessing (EffectComposer floods depth-stencil
//     warnings on this r3f v8 / drei 9 stack; do not re-add it).
//   • SPARK STORM: a recycled GPU points system that erupts embers where the
//     cursor moves, with gravity + drag physics. Zero per-frame allocations.
//   • camera rig: one-shot boot dolly + perpetual breathing drift + a gentle
//     pointer-driven ORBIT (lookAt pinned) so the part has real parallax.
//   • matte brushed steel (MeshPhysicalMaterial, low envMapIntensity, faint
//     anisotropy/clearcoat) — NOT glossy chrome. Env baked ONCE (frames={1}).
//   • render loop HARD-PARKS when the tab is hidden or the canvas is offscreen
//     (setFrameloop) — the battery/thermal win for a 24/7 console.
//   • adaptive DPR via PerformanceMonitor; all owned geometries/textures disposed.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Float, ContactShadows, Environment, Lightformer, PerformanceMonitor,
  AdaptiveEvents, Sparkles,
} from "@react-three/drei";
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";

// Status tints the single EDGE accent — the metal itself stays steel.
const ACCENT = { ok: "#5EE7FF", warn: "#E0A53C", bad: "#F1564C" };
const EMBER = "#ff7a1a"; // warm welding ember — the orange half of the grade
const FOG = "#05070c";

// ---- shared pointer state (one window listener; consumed by camera, spindle,
// spark storm). NDC coords; `speed` accumulates motion and decays per-frame. ----
// Starts far off-screen so the spindle renders ASSEMBLED until real pointer data
// arrives (the default must not sit inside the hover-explode radius). `active`
// flips on first real move — orbit/tilt stay neutral until then.
const PTR = { x: -2, y: -2, speed: 0, active: false };
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

function usePointerFeed() {
  useEffect(() => {
    let lastX = 0, lastY = 0, has = false;
    const onMove = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1); // NDC: +y up
      if (has) PTR.speed = Math.min(3, PTR.speed + Math.abs(nx - lastX) + Math.abs(ny - lastY));
      lastX = nx; lastY = ny; has = true;
      PTR.x = nx; PTR.y = ny; PTR.active = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
}

// ---- camera rig: boot dolly → breathing drift + pointer orbit ----------------
function CameraRig({ lookX }) {
  const camera = useThree((s) => s.camera);
  const armed = useRef(false);
  useEffect(() => { camera.position.z = 7.4; armed.current = true; }, [camera]);
  useFrame((state, dt0) => {
    if (!armed.current) return;
    const dt = Math.min(dt0, 0.05);
    if (Math.abs(camera.position.z - 6.2) > 0.002) {
      camera.position.z += (6.2 - camera.position.z) * dt * 2.2;
    }
    const t = state.clock.elapsedTime;
    // breathing + pointer orbit, both eased — never snappy, never frozen
    const px = PTR.active ? PTR.x : 0, py = PTR.active ? PTR.y : 0;
    const ox = Math.sin(t * 0.16) * 0.15 + px * 0.42;
    const oy = 0.2 + Math.sin(t * 0.12) * 0.07 + py * 0.22;
    camera.position.x += (ox - camera.position.x) * Math.min(dt * 2.4, 1);
    camera.position.y += (oy - camera.position.y) * Math.min(dt * 2.4, 1);
    camera.lookAt(lookX, 0.08, 0);
  });
  return null;
}

// ---- exploded-view spindle ----------------------------------------------------
// The turned profile split into FOUR closed solids (each profile starts/ends at
// r=0 so every part reads as a complete machined piece when separated).
const PART_DEFS = [
  { pts: [[0, -1.36], [0.64, -1.36], [0.64, -1.12], [0.47, -1.0], [0, -1.0]],                          off: [0.0, -0.6, 0.0],  spin: 0.55 },  // base flange
  { pts: [[0, -1.0], [0.47, -1.0], [0.64, -0.88], [0.51, -0.8], [0.51, -0.12], [0, -0.12]],            off: [0.16, -0.22, 0.08], spin: -0.4 }, // lower collar + barrel
  { pts: [[0, -0.12], [0.51, -0.12], [0.76, 0.0], [0.76, 0.16], [0.5, 0.27], [0.43, 0.31], [0, 0.31]], off: [-0.14, 0.24, -0.06], spin: 0.65 }, // mid flange
  { pts: [[0, 0.31], [0.43, 0.31], [0.43, 0.9], [0.31, 1.05], [0.31, 1.16], [0, 1.26]],                off: [0.0, 0.68, 0.0],  spin: -0.5 },  // neck + nose
];

function Spindle({ status = "ok", scale = 1 }) {
  const tilt = useRef();
  const spin = useRef();
  const partRefs = useRef([]);
  const explode = useRef(0);
  const camera = useThree((s) => s.camera);

  const geos = useMemo(
    () =>
      PART_DEFS.map((d) => {
        const g = new THREE.LatheGeometry(d.pts.map(([r, y]) => new THREE.Vector2(r, y)), 128);
        g.computeVertexNormals();
        return g;
      }),
    []
  );
  // Own them → dispose them. r3f only auto-disposes declarative resources.
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    if (spin.current) spin.current.rotation.y += dt * (status === "bad" ? 0.22 : 0.12);
    if (tilt.current) {
      // pointer-reactive parallax tilt — eased, never snappy (neutral until input)
      const px = PTR.active ? PTR.x : 0, py = PTR.active ? PTR.y : 0;
      tilt.current.rotation.x += ((py * 0.22) - tilt.current.rotation.x) * 0.045;
      tilt.current.rotation.z += ((px * 0.14) - tilt.current.rotation.z) * 0.045;

      // hover proximity (screen-space) → exploded-view factor. The canvas is
      // pointer-transparent, so proximity is computed from the shared NDC feed.
      tmpA.setFromMatrixPosition(tilt.current.matrixWorld).project(camera);
      const dx = PTR.x - tmpA.x, dy = PTR.y - tmpA.y;
      const target = dx * dx + dy * dy < 0.14 ? 1 : 0;
      explode.current += (target - explode.current) * Math.min(dt * 3.4, 1);
      const e0 = explode.current;
      const e = e0 * e0 * (3 - 2 * e0); // smoothstep — mechanical ease, no bounce
      for (let i = 0; i < PART_DEFS.length; i++) {
        const p = partRefs.current[i];
        if (!p) continue;
        const d = PART_DEFS[i];
        p.position.set(d.off[0] * e, d.off[1] * e, d.off[2] * e);
        p.rotation.y = d.spin * e;
      }
    }
  });

  return (
    <group ref={tilt} scale={scale}>
      <group ref={spin} rotation={[0.16, 0, 0.05]}>
        {geos.map((g, i) => (
          <group key={i} ref={(el) => (partRefs.current[i] = el)}>
            <mesh geometry={g}>
              {/* matte BRUSHED steel — reads photographed, not AI-chrome */}
              <meshPhysicalMaterial
                color="#9aa4b6" metalness={0.72} roughness={0.44} envMapIntensity={0.66}
                anisotropy={0.5} anisotropyRotation={Math.PI / 2} clearcoat={0.24} clearcoatRoughness={0.4}
              />
            </mesh>
          </group>
        ))}
      </group>
      {/* restrained electric edge kiss (not a flood); shifts with status */}
      <pointLight position={[3.1, 1.5, 1.1]} intensity={3.4} distance={9} color={ACCENT[status] || ACCENT.ok} />
    </group>
  );
}

// ---- god-ray style light shafts (fake volumetrics, zero postprocessing) -------
// Additive gradient planes; the beam texture is baked ONCE into a CanvasTexture
// (bright at top, soft edges, fades to transparent) — black + additive = invisible.
function makeBeamTexture() {
  const w = 64, h = 128;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const fy = Math.pow(1 - y / (h - 1), 1.7); // bright top → dark bottom
    for (let x = 0; x < w; x++) {
      const fx = Math.pow(Math.sin((Math.PI * x) / (w - 1)), 1.6); // soft edges
      const i = (y * w + x) * 4;
      const a = fy * fx;
      img.data[i] = 207 * a; img.data[i + 1] = 230 * a; img.data[i + 2] = 255 * a;
      img.data[i + 3] = 255 * a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SHAFTS = [
  { x: -0.7, z: 0.0,  w: 1.7, o: 0.10 },
  { x: 0.05, z: -0.2, w: 0.8, o: 0.17 },
  { x: 0.9,  z: -0.4, w: 2.6, o: 0.06 },
];

function LightShafts({ x }) {
  const group = useRef();
  const tex = useMemo(() => makeBeamTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((state) => {
    // an almost-imperceptible sway — the shafts feel like live light, not decals
    if (group.current) group.current.rotation.z = -0.42 + Math.sin(state.clock.elapsedTime * 0.07) * 0.025;
  });
  return (
    <group ref={group} position={[x + 0.7, 2.7, -1.1]} rotation={[0, 0, -0.42]}>
      {SHAFTS.map((s, i) => (
        <mesh key={i} position={[s.x, -4.0, s.z]}>
          <planeGeometry args={[s.w, 9.5]} />
          <meshBasicMaterial
            map={tex} transparent opacity={s.o} depthWrite={false} side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending} toneMapped={false} fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---- SPARK STORM: cursor-reactive embers with gravity + drag physics ----------
// A fixed-size recycled particle pool (zero allocations per frame). Moving the
// pointer erupts embers at the cursor's world position; they arc up, drag, fall,
// and cool from white-hot orange to nothing (per-particle vertex color fade).
function SparkStorm({ count = 260 }) {
  const camera = useThree((s) => s.camera);
  const data = useMemo(
    () => ({
      pos: new Float32Array(count * 3),
      col: new Float32Array(count * 3),
      vel: new Float32Array(count * 3),
      life: new Float32Array(count),
      max: new Float32Array(count),
    }),
    [count]
  );
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(data.col, 3));
    return g;
  }, [data]);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    PTR.speed = Math.max(0, PTR.speed * (1 - dt * 3.4)); // decay the motion energy

    // emitter = pointer unprojected onto the z=0.8 plane (just in front of the part)
    tmpA.set(PTR.x, PTR.y, 0.5).unproject(camera);
    tmpB.copy(tmpA).sub(camera.position).normalize();
    const tPlane = (0.8 - camera.position.z) / tmpB.z;
    const emitting = Number.isFinite(tPlane) && tPlane > 0;
    if (emitting) tmpA.copy(camera.position).addScaledVector(tmpB, tPlane);

    let spawn = emitting && PTR.speed > 0.05 ? Math.min(7, (1 + PTR.speed * 9) | 0) : 0;

    for (let i = 0; i < count; i++) {
      const k = i * 3;
      if (data.life[i] > 0) {
        data.life[i] -= dt;
        data.vel[k + 1] -= 2.6 * dt;          // gravity
        data.vel[k] *= 1 - 0.7 * dt;          // air drag
        data.vel[k + 1] *= 1 - 0.18 * dt;
        data.vel[k + 2] *= 1 - 0.7 * dt;
        data.pos[k] += data.vel[k] * dt;
        data.pos[k + 1] += data.vel[k + 1] * dt;
        data.pos[k + 2] += data.vel[k + 2] * dt;
        const f = Math.max(0, data.life[i] / data.max[i]);
        const ff = f * f; // hot → cool falloff
        data.col[k] = 1.35 * ff;
        data.col[k + 1] = 0.5 * ff;
        data.col[k + 2] = 0.12 * ff;
      } else if (spawn > 0) {
        spawn--;
        const a = Math.random() * Math.PI * 2;
        const sp = 0.5 + Math.random() * 1.7;
        data.pos[k] = tmpA.x + (Math.random() - 0.5) * 0.14;
        data.pos[k + 1] = tmpA.y + (Math.random() - 0.5) * 0.14;
        data.pos[k + 2] = tmpA.z + (Math.random() - 0.5) * 0.14;
        data.vel[k] = Math.cos(a) * sp * 0.55;
        data.vel[k + 1] = 0.9 + Math.random() * 1.5;
        data.vel[k + 2] = Math.sin(a) * sp * 0.3;
        data.max[i] = data.life[i] = 0.6 + Math.random() * 0.9;
      } else {
        data.col[k] = data.col[k + 1] = data.col[k + 2] = 0; // additive black = invisible
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial
        size={0.055} sizeAttenuation transparent depthWrite={false} vertexColors
        blending={THREE.AdditiveBlending} toneMapped={false}
      />
    </points>
  );
}

// ---- frameloop governor: 0% GPU when hidden/offscreen --------------------------
function FrameloopGovernor() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const apply = (run) => setFrameloop(run ? "always" : "never");
    const onVis = () => apply(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    let io;
    const el = gl?.domElement;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([e]) => apply(e.isIntersecting && !document.hidden),
        { threshold: 0.01 }
      );
      io.observe(el);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
      setFrameloop("always");
    };
  }, [setFrameloop, gl]);
  return null;
}

// ---- the scene -----------------------------------------------------------------
// Aspect-responsive: WIDE → the spindle floats at the centre seam of the split
// login (the Spline robot owns the left column, the sign-in panel the right);
// NARROW (phone) → centred top-third behind the sign-in card.
function Scene({ status }) {
  usePointerFeed();
  const aspect = useThree((s) => s.viewport.aspect);
  const wide = aspect > 1.15;
  const x = wide ? 0.3 : 0.1;
  const scale = wide ? 0.62 : 0.46;
  const groupY = wide ? 0.45 : 1.12;

  return (
    <>
      <AdaptiveEvents />
      <FrameloopGovernor />
      <CameraRig lookX={wide ? 0.2 : 0} />

      <fog attach="fog" args={[FOG, 6.0, 12.5]} />
      <ambientLight intensity={0.3} />
      {/* cool key + cool fill = the teal half of the grade */}
      <directionalLight position={[3.5, 6, 4]} intensity={1.25} />
      <directionalLight position={[-4, 2, -2]} intensity={0.45} color="#c6cede" />
      {/* warm ember bounce from below = the orange half */}
      <pointLight position={[x - 0.3, -1.6, 1.4]} intensity={2.6} distance={7.5} color={EMBER} />

      {/* exploded-view machined part */}
      <group position={[x, groupY, 0]}>
        <Float speed={1.0} rotationIntensity={0.1} floatIntensity={0.14}>
          <Spindle status={status} scale={scale} />
        </Float>
      </group>

      {/* frosted-glass jewel near the base — catches the cyan kiss + ember bounce */}
      <Float speed={1.5} rotationIntensity={0.7} floatIntensity={0.5}>
        <mesh position={[x - 0.05, -0.8, 0.75]}>
          <icosahedronGeometry args={[scale * 0.5, 0]} />
          <meshPhysicalMaterial
            transmission={1} thickness={0.35} roughness={0.05} ior={1.5} metalness={0}
            color="#eaffff" attenuationColor="#5EE7FF" attenuationDistance={0.8}
            clearcoat={0.7} clearcoatRoughness={0.08} iridescence={0.7} iridescenceIOR={1.35} specularIntensity={1}
          />
        </mesh>
      </Float>

      {/* god-ray shafts behind the part — the part silhouettes against live light */}
      <LightShafts x={x} />

      {/* cursor-reactive ember eruption (physics) */}
      <SparkStorm />

      {/* ambient drifting embers — two warm layers + cool dust motes for depth */}
      <Sparkles count={90} scale={[7.5, 7, 4]} position={[x, 0.35, 0.6]} size={3.6} speed={0.5} opacity={0.9} color={EMBER} noise={1.8} />
      <Sparkles count={30} scale={[9, 8, 5]} position={[x, 0.2, -0.8]} size={6} speed={0.22} opacity={0.4} color="#ff9a4d" noise={1.2} />
      <Sparkles count={30} scale={[9, 7, 5]} position={[x - 0.6, 0.6, -0.5]} size={1.6} speed={0.18} opacity={0.45} color="#dfe7f5" noise={1} />

      {/* soft contact shadow — grounds the floating part (no opaque floor plane:
          that created a black void + hard horizon on wide viewports) */}
      <ContactShadows position={[x, -1.55, 0]} opacity={0.45} scale={7} blur={3.2} far={3.4} color="#03040a" resolution={256} />

      {/* Inline lightformer studio — baked ONCE (frames=1). Reflections live here,
          not in point lights. Cool neutrals + one cyan + one ember kiss. */}
      <Environment frames={1} resolution={256}>
        <Lightformer intensity={1.7} color="#eef1f7" position={[3, 3, 3]} scale={[7, 7, 1]} />
        <Lightformer intensity={1.0} color="#c6cede" position={[-4, 1, -3]} scale={[6, 6, 1]} />
        <Lightformer intensity={0.7} color="#5EE7FF" position={[-2, -2, 2]} scale={[6, 2, 1]} />
        <Lightformer intensity={0.6} color={EMBER} position={[2.5, -2, 1]} scale={[5, 2, 1]} />
      </Environment>
    </>
  );
}

export default function Ambient({ status = "ok" }) {
  const [dpr, setDpr] = useState(1.5);
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true">
      <Canvas
        dpr={dpr}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.2, 6.2], fov: 34 }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.02;
          // preventDefault lets the browser RESTORE a lost context instead of black-for-good
          gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault(), false);
        }}
      >
        {/* live FPS-driven DPR — crisp on desktop, survivable on weak/throttling tablets */}
        <PerformanceMonitor onIncline={() => setDpr(2)} onDecline={() => setDpr(1)} flipflops={3} onFallback={() => setDpr(1)} />
        <Scene status={status} />
      </Canvas>
    </div>
  );
}
