"use client";

import React, { Suspense, useRef, useLayoutEffect, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, PerspectiveCamera, Center, useProgress, Html, ContactShadows, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useAppDispatch } from "@/lib/hooks";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";

gsap.registerPlugin(ScrollTrigger);

// --- 3D Scene Component ---
function SeatModel() {
  const meshRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/seatwise-3d-logo_compressed.glb", "https://www.gstatic.com/draco/versioned/decoders/1.5.6/");

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

  useGSAP(() => {
    if (!meshRef.current) return;

    // Initial state: Section 1 (Hero)
    gsap.set(meshRef.current.scale, { x: 3.1, y: 3.1, z: 3.1 });
    gsap.set(meshRef.current.position, { x: 3.2, y: -0.2, z: 0 });
    gsap.set(meshRef.current.rotation, { y: -Math.PI / 3, x: 0.2, z: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: "main",
        start: "top top",
        end: "bottom bottom",
        scrub: 1.5,
      },
    });

    // Transition to Section 2: Intelligent Optimization (Left Side, Profile View)
    tl.to(meshRef.current.position, {
      x: -3.5,
      y: 0,
      z: 0,
      ease: "power2.inOut",
    })
      .to(meshRef.current.rotation, {
        y: Math.PI / 2, // Profile view
        x: 0,
        z: 0,
        ease: "power2.inOut",
      }, "<")
      .to(meshRef.current.scale, {
        x: 3.8,
        y: 3.8,
        z: 3.8,
        ease: "power2.inOut",
      }, "<");

    // Transition to Section 3: Ready to Scale? (Center, Top-down, Immersive)
    tl.to(meshRef.current.position, {
      x: 0,
      y: -0.5,
      z: -2,
      ease: "power2.inOut",
    })
      .to(meshRef.current.rotation, {
        x: Math.PI / 2, // Top-down perspective
        y: 0,
        z: 0,
        ease: "power2.inOut",
      }, "<")
      .to(meshRef.current.scale, {
        x: 5.5,
        y: 5.5,
        z: 5.5,
        ease: "power2.inOut",
      }, "<");
  }, []);

  return (
    <group ref={meshRef}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

function Scene() {
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

      <rectAreaLight width={10} height={10} position={[5, 5, 5]} intensity={5} color="#3b82f6" />
      <pointLight position={[-10, -10, -10]} intensity={2} color="#60a5fa" />



      <SeatModel />

      <EffectComposer enableNormalPass={false}>
        <Bloom
          luminanceThreshold={1}
          mipmapBlur
          intensity={1.2}
          radius={0.4}
        />
      </EffectComposer>
    </>
  );
}

// --- Loading Handler Component ---
function LoadingHandler() {
  const { progress } = useProgress();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (progress < 100) {
      dispatch(setLoading(true));
    } else {
      const timer = setTimeout(() => {
        dispatch(setLoading(false));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [progress, dispatch]);

  return null;
}

// --- Main Page Component ---
export default function Home() {
  return (
    <main className="relative bg-white text-zinc-900 selection:bg-blue-200">
      {/* Fixed 3D Canvas Background */}
      <div className="fixed inset-0 h-screen w-full z-0 pointer-events-none">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 10], fov: 45 }} gl={{ alpha: true }}>
          <Suspense fallback={null}>
            <LoadingHandler />
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      {/* Content Overlay */}
      <section className="relative h-screen flex flex-col justify-center px-10 md:px-20 z-10 pointer-events-none">
        <div className="max-w-4xl pointer-events-auto">
          <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter leading-none mb-6">
            SEAT<span className="text-blue-500">WISE</span>
          </h1>
          <p className="text-xl md:text-2xl font-light text-zinc-500 max-w-xl mb-10 leading-relaxed">
            The future of venue management. Precision, speed, and intelligence in every seat.
          </p>
          <button className="px-8 py-4 bg-zinc-900 text-white font-bold uppercase tracking-widest hover:bg-blue-500 transition-colors duration-300">
            Explorer Venue
          </button>
        </div>
      </section>

      <section className="relative h-screen flex flex-col justify-center items-end px-10 md:px-20 z-10 pointer-events-none">
        <div className="max-w-xl text-right pointer-events-auto">
          <h2 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            INTELLIGENT <br /> <span className="text-blue-500">OPTIMIZATION</span>
          </h2>
          <p className="text-lg md:text-xl text-zinc-500 font-light mb-8">
            Real-time heatmaps and occupancy tracking that automatically balances your venue load. No more bottlenecks, just pure efficiency.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-zinc-200 bg-zinc-50/50 backdrop-blur-md">
              <span className="block text-3xl font-bold text-blue-500">99%</span>
              <span className="text-xs uppercase tracking-widest text-zinc-400">Efficiency</span>
            </div>
            <div className="p-4 border border-zinc-200 bg-zinc-50/50 backdrop-blur-md">
              <span className="block text-3xl font-bold text-blue-500">0.2s</span>
              <span className="text-xs uppercase tracking-widest text-zinc-400">Latency</span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative h-screen flex flex-col justify-center px-10 md:px-20 z-10 pointer-events-none">
        <div className="max-w-2xl pointer-events-auto">
          <h2 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight uppercase">
            Ready to <span className="text-blue-500">Scale?</span>
          </h2>
          <p className="text-lg md:text-xl text-zinc-500 font-light mb-10">
            From local theaters to olympic stadiums, Seatwise scales with your ambition. Secure, fast, and remarkably simple.
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
      <footer className="relative py-10 px-10 border-t border-zinc-100 z-10 flex justify-between items-center text-zinc-500 text-xs uppercase tracking-widest">
        <p>&copy; 2026 SEATWISE INDUSTRIES</p>
        <div className="flex gap-8">
          <a href="#" className="hover:text-zinc-900 transition-colors">Privacy</a>
          <a href="#" className="hover:text-zinc-900 transition-colors">Terms</a>
        </div>
      </footer>
    </main>
  );
}
