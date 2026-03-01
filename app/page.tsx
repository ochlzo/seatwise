"use client";

import React, { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Environment,
  PerspectiveCamera,
  Center,
  useProgress,
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
import ScrollReveal from "@/components/ui/scroll-reveal";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { useTheme } from "next-themes";
import Image from "next/image";

// @ts-expect-error - types are not correctly resolved for this extension
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib";
import { useRouter } from "next/navigation";

gsap.registerPlugin(ScrollTrigger);

// Initialize the uniforms library for RectAreaLight to avoid console warnings
if (typeof window !== "undefined") {
  RectAreaLightUniformsLib.init();
}

// --- 3D Scene Component ---
function SeatModel({ onReady }: { onReady: () => void }) {
  const meshRef = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  const { scene } = useGLTF(
    "/seatwise_final_draco.glb",
    "https://www.gstatic.com/draco/versioned/decoders/1.5.6/",
  );

  // Material optimization based on device
  const isMobile = useIsMobile();

  // Apply premium metallic material to all children
  useEffect(() => {
    if (!scene) return;
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (isMobile) {
          // Improved material for mobile to reflect environment
          child.material = new THREE.MeshStandardMaterial({
            color: "#3b82f6",
            metalness: 0.4,
            roughness: 0.2,
            flatShading: false,
          });
        } else {
          // Premium material for desktop
          child.material = new THREE.MeshPhysicalMaterial({
            color: "#3b82f6",
            metalness: 0.2,
            roughness: 0.3,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.5,
            flatShading: false,
          });
        }
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
  }, [scene, isMobile]);

  useEffect(() => {
    if (!scene) return;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geom = child.geometry as THREE.BufferGeometry;
        if (!geom.attributes.normal) {
          geom.computeVertexNormals();
          const normalAttr = geom.getAttribute(
            "normal",
          ) as THREE.BufferAttribute | null;
          if (normalAttr) {
            normalAttr.needsUpdate = true;
          }
        }
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
          const { isDesktop } = context.conditions as {
            isDesktop: boolean;
            isMobile: boolean;
          };

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
              invalidateOnRefresh: true, // Fix for mobile viewport changes
              fastScrollEnd: true, // Prevent jump/flicker on fast scrolls
              onUpdate: () => invalidate(),
            },
          });

          // Transition to Section 2: Intelligent Optimization
          tl.to(meshRef.current!.position, {
            x: config.sec2.position.x,
            y: config.sec2.position.y,
            z: config.sec2.position.z,
            duration: 1.1,
            ease: "power2.inOut",
            immediateRender: false,
          })
            .to(
              meshRef.current!.rotation,
              {
                y: config.sec2.rotation.y,
                duration: 1.1,
                ease: "power2.inOut",
              },
              "<",
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
              "<",
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
              "<",
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
              "<",
            );

          invalidate();
          onReady();
        },
      );

      return () => mm.revert();
    },
    { dependencies: [scene] },
  );

  return (
    <group ref={meshRef}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

function Scene({ onReady, isDark }: { onReady: () => void; isDark: boolean }) {
  const isMobile = useIsMobile();
  const { invalidate } = useThree();

  useEffect(() => {
    invalidate();
  }, [isDark, invalidate]);
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={40} />
      <Environment preset="city" environmentIntensity={isMobile ? 0.3 : 1} />
      <ambientLight intensity={isMobile ? 0.6 : 0.8} />
      {isMobile && !isDark && <fog attach="fog" args={["#f0f9ff", 3, 15]} />}

      {/* High-quality SpotLight shadow */}
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={3}
        color="#3b82f6"
      />

      {!isMobile && (
        <rectAreaLight
          width={10}
          height={10}
          position={[5, 5, 5]}
          intensity={5}
          color="#3b82f6"
        />
      )}

      <pointLight
        position={[-10, -10, -10]}
        intensity={isMobile ? 1 : 2}
        color="#60a5fa"
      />

      <SeatModel onReady={onReady} />

      {!isMobile && (
        <EffectComposer enableNormalPass={false}>
          <Bloom
            luminanceThreshold={1}
            mipmapBlur
            intensity={1.2}
            radius={0.4}
          />
        </EffectComposer>
      )}
    </>
  );
}

function FixedCanvasLayer() {
  const [mounted, setMounted] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 h-screen w-full z-[-10] bg-white dark:bg-zinc-950 pointer-events-none">
      {/* Radial overlay to make the center clear while blending edges */}
      <div
        className={`absolute inset-0 z-[1] transition-opacity duration-1000 ${
          isMobile
            ? "bg-[radial-gradient(circle_at_center,_transparent_0%,_#f0f7ff_50%,_white_100%)] opacity-94 dark:bg-[radial-gradient(circle_at_center,_transparent_0%,_#0b1220_60%,_#0a0a0a_100%)]"
            : "bg-[radial-gradient(circle_at_center,_transparent_0%,_white_90%)] opacity-70 dark:bg-[radial-gradient(circle_at_center,_transparent_0%,_#0b1220_70%,_#0a0a0a_100%)]"
        }`}
      />

      {/* Mobile-only subtle blue "mist" for top and bottom to frame text */}
      {isMobile && (
        <div className="absolute inset-0 bg-gradient-to-b from-blue-100/35 via-transparent to-blue-200/25 dark:from-blue-900/25 dark:to-blue-800/10 z-[2] pointer-events-none" />
      )}

      <Canvas
        shadows={!isMobile}
        dpr={1}
        frameloop="demand"
        camera={{ position: [0, 0, 10], fov: 45 }}
        gl={{
          alpha: true,
          antialias: !isMobile,
          stencil: false,
          depth: true,
          powerPreference: "high-performance",
        }}
      >
        <Suspense fallback={null}>
          <LoadingHandler modelReady={modelReady} />
          <Scene onReady={() => setModelReady(true)} isDark={isDark} />
        </Suspense>
      </Canvas>
    </div>,
    document.body,
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
  const router = useRouter();
  const dispatch = useAppDispatch();

  const navigateToDashboard = () => {
    dispatch(setLoading(true));
    router.push("/dashboard");
  };

  return (
    <main className="relative z-10 snap-y snap-mandatory bg-transparent text-zinc-900 dark:text-zinc-100 selection:bg-blue-200 dark:selection:bg-blue-800">
      <div className="fixed right-6 top-6 z-30 pointer-events-auto">
        <ThemeSwithcer />
      </div>
      {/* Fixed 3D Canvas Background */}
      <FixedCanvasLayer />

      {/* Content Overlay */}
      <section className="relative h-screen snap-start flex flex-col justify-center px-6 md:px-32 z-20 pointer-events-none">
        <div className="max-w-4xl pointer-events-auto">
          <h1 className="text-7xl md:text-9xl font-extrabold font-brand leading-none mb-6 break-words">
            seat<span className="text-blue-500">wise</span>
          </h1>
          <ScrollReveal
            textClassName="max-w-2xl mb-10 leading-relaxed drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]"
            containerClassName="!m-0 !mb-10"
          >
            <span className="block text-xl md:text-3xl font-medium md:font-light text-zinc-800 md:text-zinc-500 dark:text-zinc-200 dark:md:text-zinc-300 mb-6">
              The future of venue management. Precision, speed, and intelligence
              in every seat.
            </span>
            <span className="block text-sm md:text-xl font-bold text-blue-600 uppercase tracking-widest">
              Now in Bicol University College of Arts and Letters Amphitheater
            </span>
          </ScrollReveal>
          <div className="flex flex-row items-center gap-4 md:gap-8 flex-wrap">
            <button
              onClick={navigateToDashboard}
              className="cursor-pointer px-6 md:px-8 py-3 md:py-4 bg-zinc-900 text-white font-bold uppercase tracking-widest hover:bg-blue-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-blue-500 dark:hover:text-white transition-colors duration-300"
            >
              View Events Now!
            </button>
            <div className="flex flex-row items-center gap-4 md:gap-8">
              <Image
                src="/bu-logo.png"
                alt="Bicol University Logo"
                width={128}
                height={128}
                className="h-20 md:h-32 w-auto object-contain drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]"
              />
              <Image
                src="/icon.png"
                alt="BUCAL Logo"
                width={128}
                height={128}
                className="h-20 md:h-32 w-auto object-contain drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="relative h-screen snap-start flex flex-col justify-center items-start md:items-end px-6 md:px-32 z-20 pointer-events-none">
        <div className="max-w-xl text-left md:text-right pointer-events-auto">
          <h2 className="text-4xl md:text-7xl font-bold font-brand mb-6 tracking-tight break-words">
            pick your spot. <br />{" "}
            <span className="text-blue-500">pay in a tap.</span>
          </h2>
          <ScrollReveal
            textClassName="text-lg md:text-2xl text-zinc-800 md:text-zinc-500 dark:text-zinc-200 dark:md:text-zinc-300 font-medium md:font-light mb-8 drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]"
            containerClassName="!m-0 !mb-8"
            rotationEnd="center center"
            wordAnimationEnd="center center"
          >
            Experience cinema-style booking. Choose your favorite seat from our
            interactive map and secure it instantly via GCash. Fast, easy, and
            entirely digital.
          </ScrollReveal>
        </div>
      </section>

      <section className="relative h-screen snap-start flex flex-col justify-center px-6 md:px-32 z-20 pointer-events-none">
        <div className="max-w-2xl pointer-events-auto">
          <h2 className="text-4xl md:text-7xl font-bold font-brand mb-6 tracking-tight uppercase break-words">
            Ready to <span className="text-blue-500">Try it Out?</span>
          </h2>
          <ScrollReveal
            textClassName="text-lg md:text-2xl text-zinc-800 md:text-zinc-500 dark:text-zinc-200 dark:md:text-zinc-300 font-medium md:font-light mb-10 drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]"
            containerClassName="!m-0 !mb-10"
            rotationEnd="center center"
            wordAnimationEnd="center center"
          >
            Experience the new standard of venue management at Bicol University.
            Seatwise is live and ready for your next event — join us as we
            redefine the student experience.
          </ScrollReveal>
          <div className="flex gap-4">
            <button
              onClick={navigateToDashboard}
              className="cursor-pointer px-8 py-4 bg-blue-500 text-white font-bold uppercase tracking-widest hover:bg-zinc-900 dark:hover:bg-zinc-100 dark:hover:text-zinc-900 transition-colors duration-300"
            >
              Get Started
            </button>
            <button className="px-8 py-4 border border-zinc-300 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 font-bold uppercase tracking-widest hover:border-zinc-900 dark:hover:border-zinc-200 transition-colors duration-300">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Footer (small) */}
      <footer className="relative py-10 px-6 md:px-32 border-t border-zinc-100 dark:border-zinc-800 z-20 flex flex-col md:flex-row justify-between items-center text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-widest gap-4">
        <p>&copy; 2026 SEATWISE • CHOLO CANDELARIA • SEAN ARMENTA • BUCAL</p>
        <div className="flex gap-8">
          <a
            href="/privacy-policy"
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="/terms-of-service"
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </footer>
    </main>
  );
}
