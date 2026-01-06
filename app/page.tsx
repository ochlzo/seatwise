"use client";

import React, { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Float,
  PerspectiveCamera,
  Center,
  useProgress,
  Html,
  ContactShadows,
  useGLTF,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useAppDispatch } from "@/lib/hooks";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";
import { useIsMobile } from "@/hooks/use-mobile";
import { createPortal } from "react-dom";

// @ts-ignore - types are not correctly resolved for this extension
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib";

gsap.registerPlugin(ScrollTrigger);

// Initialize the uniforms library for RectAreaLight to avoid console warnings
if (typeof window !== "undefined") {
  RectAreaLightUniformsLib.init();
}

// --- 3D Scene Component ---
function SeatModel({ onReady }: { onReady: () => void }) {
  const meshRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(
    "/seatwise-3d-logo_compressed.glb",
    "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
  );

  // Apply premium metallic material to all children
  useEffect(() => {
    if (!scene) return;
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: "#3b82f6", // Blue primary
          metalness: 0.2,
          roughness: 0.3,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          envMapIntensity: 1.5,
          flatShading: false,
        });
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
  }, [scene]);

  useGSAP(
    () => {
      if (!meshRef.current || !scene) return;

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 768px)",
          isMobile: "(max-width: 767px)",
        },
        (context) => {
          const { isDesktop } = context.conditions as any;

          // Configuration based on screen size
          const config = isDesktop
            ? {
              initialScale: { x: 3.1, y: 3.1, z: 3.1 },
              initialPosition: { x: 3.2, y: -0.2, z: 0 },
              initialRotation: { y: -Math.PI / 3, x: 0.2, z: 0 },
              sec2: {
                position: { x: -3.5, y: -0.3, z: 0 },
                rotation: { y: -Math.PI * 0.6 },
                scale: 2.7,
              },
              sec3: {
                position: { x: 3.2, y: 0.3, z: 0 },
                rotation: { x: Math.PI / 3, y: -Math.PI / 1.9 },
                scale: 2.4,
              },
            }
            : {
              // Mobile specific values
              initialScale: { x: 2.2, y: 2.2, z: 2.2 },
              initialPosition: { x: 0, y: -1.0, z: 0 },
              initialRotation: { y: -Math.PI / 3, x: 0.2, z: 0 },
              sec2: {
                position: { x: 0, y: 0.2, z: 0 },
                rotation: { y: -Math.PI * 0.8 },
                scale: 1.8,
              },
              sec3: {
                position: { x: 0, y: -0.5, z: 0 },
                rotation: { x: Math.PI / 3, y: -Math.PI / 1.1 },
                scale: 1.6,
              },
            };

          // Initial state: Section 1 (Hero)
          gsap.set(meshRef.current!.scale, config.initialScale);
          gsap.set(meshRef.current!.position, config.initialPosition);
          gsap.set(meshRef.current!.rotation, config.initialRotation);

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: "main",
              start: "top top",
              end: "bottom bottom",
              scrub: 1, // Smoother scrub
            },
          });

          // Transition to Section 2: Intelligent Optimization
          tl.to(meshRef.current!.position, {
            x: config.sec2.position.x,
            y: config.sec2.position.y,
            z: config.sec2.position.z,
            duration: 1.1,
            ease: "power2.inOut",
          })
            .to(
              meshRef.current!.rotation,
              {
                y: config.sec2.rotation.y,
                duration: 1.1,
                ease: "power2.inOut",
              },
              "<"
            )
            .to(
              meshRef.current!.scale,
              {
                x: config.sec2.scale,
                y: config.sec2.scale,
                z: config.sec2.scale,
                duration: 1.1,
                ease: "power2.inOut",
              },
              "<"
            );

          // Transition to Section 3: Ready to Scale?
          tl.to(meshRef.current!.position, {
            x: config.sec3.position.x,
            y: config.sec3.position.y,
            z: config.sec3.position.z,
            duration: 1.3,
            ease: "power2.inOut",
          })
            .to(
              meshRef.current!.rotation,
              {
                x: config.sec3.rotation.x,
                y: config.sec3.rotation.y,
                duration: 1.3,
                ease: "power2.inOut",
              },
              "<"
            )
            .to(
              meshRef.current!.scale,
              {
                x: config.sec3.scale,
                y: config.sec3.scale,
                z: config.sec3.scale,
                duration: 1.3,
                ease: "power2.inOut",
              },
              "<"
            );

          onReady();
        }
      );

      return () => mm.revert();
    },
    { dependencies: [scene] }
  );

  return (
    <group ref={meshRef}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

function Scene({ onReady }: { onReady: () => void }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={40} />
      <Environment preset="city" />
      <ambientLight intensity={0.8} />

      {/* High-quality SpotLight shadow */}
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={3}
        color="#3b82f6"
      />

      <rectAreaLight
        width={10}
        height={10}
        position={[5, 5, 5]}
        intensity={5}
        color="#3b82f6"
      />
      <pointLight position={[-10, -10, -10]} intensity={2} color="#60a5fa" />

      <SeatModel onReady={onReady} />

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={1.2} radius={0.4} />
      </EffectComposer>
    </>
  );
}

function FixedCanvasLayer() {
  const [mounted, setMounted] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 h-screen w-full z-[-10] bg-white pointer-events-none ${isMobile ? "blur-[4px]" : ""}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0, 10], fov: 45 }}
        gl={{ alpha: true }}
      >
        <Suspense fallback={null}>
          <LoadingHandler modelReady={modelReady} />
          <Scene onReady={() => setModelReady(true)} />
        </Suspense>
      </Canvas>
    </div>,
    document.body
  );
}

// --- Loading Handler Component ---
function LoadingHandler({ modelReady }: { modelReady: boolean }) {
  const { progress } = useProgress();
  const dispatch = useAppDispatch();

  useEffect(() => {
    // We stay in loading state as long as assets are downloading OR the model isn't initialized
    if (progress < 100 || !modelReady) {
      dispatch(setLoading(true));
    } else {
      // Small artificial delay to ensure the canvas has swapped from white/clear to fully rendered
      const timer = setTimeout(() => {
        dispatch(setLoading(false));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [progress, modelReady, dispatch]);

  return null;
}

// --- Main Page Component ---
export default function Home() {
  return (
    <main className="relative z-10 snap-y snap-mandatory bg-transparent text-zinc-900 selection:bg-blue-200">
      {/* Fixed 3D Canvas Background */}
      <FixedCanvasLayer />

      {/* Content Overlay */}
      <section className="relative h-screen snap-start flex flex-col justify-center px-6 md:px-20 z-20 pointer-events-none">
        <div className="max-w-4xl pointer-events-auto">
          <h1 className="text-7xl md:text-9xl font-extrabold font-brand leading-none mb-6 break-words">
            seat<span className="text-blue-500">wise</span>
          </h1>
          <p className="text-xl md:text-2xl font-medium md:font-light text-zinc-800 md:text-zinc-500 max-w-xl mb-10 leading-relaxed drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]">
            The future of venue management. Precision, speed, and intelligence
            in every seat.
          </p>
          <button className="px-8 py-4 bg-zinc-900 text-white font-bold uppercase tracking-widest hover:bg-blue-500 transition-colors duration-300">
            Explorer Venue
          </button>
        </div>
      </section>

      <section className="relative h-screen snap-start flex flex-col justify-center items-start md:items-end px-6 md:px-20 z-20 pointer-events-none">
        <div className="max-w-xl text-left md:text-right pointer-events-auto">
          <h2 className="text-4xl md:text-7xl font-bold font-brand mb-6 tracking-tight break-words">
            intelligent <br />{" "}
            <span className="text-blue-500">optimization</span>
          </h2>
          <p className="text-lg md:text-xl text-zinc-800 md:text-zinc-500 font-medium md:font-light mb-8 drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]">
            Real-time heatmaps and occupancy tracking that automatically
            balances your venue load. No more bottlenecks, just pure efficiency.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-zinc-200 bg-zinc-50/50 backdrop-blur-md">
              <span className="block text-3xl font-bold text-blue-500">
                99%
              </span>
              <span className="text-xs uppercase tracking-widest text-zinc-400">
                Efficiency
              </span>
            </div>
            <div className="p-4 border border-zinc-200 bg-zinc-50/50 backdrop-blur-md">
              <span className="block text-3xl font-bold text-blue-500">
                0.2s
              </span>
              <span className="text-xs uppercase tracking-widest text-zinc-400">
                Latency
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative h-screen snap-start flex flex-col justify-center px-6 md:px-20 z-20 pointer-events-none">
        <div className="max-w-2xl pointer-events-auto">
          <h2 className="text-4xl md:text-7xl font-bold font-brand mb-6 tracking-tight uppercase break-words">
            Ready to <span className="text-blue-500">Scale?</span>
          </h2>
          <p className="text-lg md:text-xl text-zinc-800 md:text-zinc-500 font-medium md:font-light mb-10 drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]">
            From local theaters to olympic stadiums, Seatwise scales with your
            ambition. Secure, fast, and remarkably simple.
          </p>
          <div className="flex gap-4">
            <button className="px-8 py-4 bg-blue-500 text-white font-bold uppercase tracking-widest hover:bg-zinc-900 transition-colors duration-300">
              Get Started
            </button>
            <button className="px-8 py-4 border border-zinc-300 text-zinc-900 font-bold uppercase tracking-widest hover:border-zinc-900 transition-colors duration-300">
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* Footer (small) */}
      <footer className="relative py-10 px-6 md:px-20 border-t border-zinc-100 z-20 flex flex-col md:flex-row justify-between items-center text-zinc-500 text-xs uppercase tracking-widest gap-4">
        <p>&copy; 2026 SEATWISE INDUSTRIES</p>
        <div className="flex gap-8">
          <a href="#" className="hover:text-zinc-900 transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-zinc-900 transition-colors">
            Terms
          </a>
        </div>
      </footer>
    </main>
  );
}
