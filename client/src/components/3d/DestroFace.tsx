import React, { useRef } from 'react';
  import { Canvas, useFrame } from '@react-three/fiber';
  import { Float, PerspectiveCamera, Environment } from '@react-three/drei';
  import * as THREE from 'three';

  export type Emotion =
    | 'neutral'
    | 'smiling'
    | 'laughing'
    | 'serious'
    | 'empathetic'
    | 'thinking'
    | 'concerned'
    | 'amused'
    | 'friendly_stern'
    | 'cyber'
    | 'cinema';

  interface DestroMaskProps {
    volume: number;
    emotion: Emotion;
  }

  const DestroMask = ({ volume = 0, emotion = 'neutral' }: DestroMaskProps) => {
    const meshRef    = useRef<THREE.Mesh>(null);
    const leftEyeRef = useRef<THREE.Mesh>(null);
    const rightEyeRef= useRef<THREE.Mesh>(null);
    const jawRef     = useRef<THREE.Mesh>(null);

    useFrame((state) => {
      if (!meshRef.current) return;
      const t = state.clock.getElapsedTime();

      // Gentle breathing float
      meshRef.current.position.y = Math.sin(t * 0.5) * 0.05;

      // ── Defaults ─────────────────────────────────────────────────────────────
      let eyeColor   = '#00cc55'; // green  = idle / task complete
      let glowInt    = 2.2 + Math.sin(t * 0.9) * 0.4;
      let jawScaleX  = 0.60;
      let distort    = 0.10;

      // ── Per-emotion overrides ────────────────────────────────────────────────
      switch (emotion) {
        // LISTENING → metallic blue
        case 'thinking':
          eyeColor  = '#1a7fff';
          glowInt   = 3.5 + volume * 14 + Math.sin(t * 1.5) * 0.8;
          distort   = 0.16 + volume * 0.1;
          break;

        // WORKING / THINKING → fire red
        case 'concerned':
          eyeColor  = '#ff3300';
          glowInt   = 4.5 + volume * 20 + Math.sin(t * 3) * 1.5;
          distort   = 0.28 + volume * 0.25;
          jawScaleX = 0.55;
          break;

        // SPEAKING → electric teal
        case 'friendly_stern':
          eyeColor  = '#00eedd';
          glowInt   = 2.8 + volume * 11;
          jawScaleX = 0.65;
          break;

        // IDLE / COMPLETE → soft green (explicit)
        case 'neutral':
          eyeColor  = '#00cc55';
          glowInt   = 1.8 + Math.sin(t * 0.8) * 0.5;
          distort   = 0.10;
          break;

        case 'cyber':
          eyeColor  = '#ff2200';
          glowInt   = 4 + volume * 20 + Math.sin(t * 8) * 1.5;
          distort   = 0.35 + volume * 0.3;
          break;
        case 'cinema':
          eyeColor  = '#00ff44';
          glowInt   = 3 + volume * 12;
          jawScaleX = 0.68;
          break;
        case 'amused':
          eyeColor  = '#00eedd';
          glowInt   = 3 + volume * 18;
          jawScaleX = 0.70;
          distort   = 0.28;
          break;
        case 'laughing':
          eyeColor  = '#00eedd';
          glowInt   = 5 + Math.sin(t * 15) * 3;
          jawScaleX = 0.90;
          distort   = 0.38;
          break;
        case 'smiling':
          eyeColor  = '#00cc55';
          jawScaleX = 0.80;
          break;
        case 'serious':
          eyeColor  = '#1a7fff';
          glowInt   = 1 + volume * 4;
          break;
        case 'empathetic':
          eyeColor  = '#00cc88';
          glowInt   = 1.5 + volume * 8;
          break;
      }

      // Apply eye colours
      if (leftEyeRef.current && rightEyeRef.current) {
        const matL = leftEyeRef.current.material as THREE.MeshStandardMaterial;
        const matR = rightEyeRef.current.material as THREE.MeshStandardMaterial;
        matL.color.set(eyeColor);  matL.emissive.set(eyeColor);  matL.emissiveIntensity = glowInt;
        matR.color.set(eyeColor);  matR.emissive.set(eyeColor);  matR.emissiveIntensity = glowInt;
      }

      // Jaw / lip-sync
      if (jawRef.current) {
        const jawTarget = -0.6 - volume * 0.6;
        jawRef.current.position.y = THREE.MathUtils.lerp(jawRef.current.position.y, jawTarget, 0.2);
        jawRef.current.scale.x    = THREE.MathUtils.lerp(jawRef.current.scale.x,    jawScaleX, 0.1);
        if (emotion === 'laughing') jawRef.current.position.y -= Math.sin(t * 25) * 0.08;
      }

      // Subtle face distortion via rotation (MeshPhysicalMaterial has no distort prop)
      if (meshRef.current) {
        meshRef.current.rotation.y = Math.sin(t * 0.3) * 0.06 * (1 + distort * 2);
      }
    });

    return (
      <group>
        {/* ── Face — mother-of-pearl MeshPhysicalMaterial ─────────────────── */}
        <mesh ref={meshRef} scale={[1, 1.2, 0.8]}>
          <sphereGeometry args={[1, 128, 128]} />
          <meshPhysicalMaterial
            color="#dde0ec"
            roughness={0.04}
            metalness={0.85}
            iridescence={1}
            iridescenceIOR={1.65}
            iridescenceThicknessRange={[120, 800] as [number, number]}
            clearcoat={1}
            clearcoatRoughness={0.04}
            reflectivity={1}
            sheen={0.6}
            sheenRoughness={0.3}
            sheenColor="#b0c0ff"
          />
        </mesh>

        {/* ── Eyes ─────────────────────────────────────────────────────────── */}
        <mesh ref={leftEyeRef} position={[-0.35, 0.38, 0.65]}>
          <sphereGeometry args={[0.095, 24, 24]} />
          <meshStandardMaterial color="#00cc55" emissive="#00cc55" emissiveIntensity={2.2} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.35, 0.38, 0.65]}>
          <sphereGeometry args={[0.095, 24, 24]} />
          <meshStandardMaterial color="#00cc55" emissive="#00cc55" emissiveIntensity={2.2} />
        </mesh>

        {/* ── Jaw — matching pearl finish, slightly darker ──────────────────── */}
        <mesh ref={jawRef} position={[0, -0.6, 0.28]} scale={[0.60, 0.40, 0.40]}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshPhysicalMaterial
            color="#c8cce0"
            roughness={0.06}
            metalness={0.80}
            iridescence={0.9}
            iridescenceIOR={1.55}
            iridescenceThicknessRange={[100, 600] as [number, number]}
            clearcoat={0.85}
            clearcoatRoughness={0.06}
          />
        </mesh>
      </group>
    );
  };

  export const DestroFace = ({
    volume  = 0,
    emotion = 'neutral',
  }: {
    volume?:  number;
    emotion?: Emotion;
  }) => (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'block' }}>
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'default' }}
        dpr={[1, 2]}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 4.5]} />

        {/* Rich multi-angle lighting to bring out the pearl iridescence */}
        <ambientLight intensity={0.35} />
        <pointLight position={[6, 8, 6]}   intensity={2.5} color="#ffffff" />
        <pointLight position={[-6, 4, 4]}  intensity={1.2} color="#d0e8ff" />
        <pointLight position={[3, -5, 3]}  intensity={0.8} color="#ffe8d0" />
        <pointLight position={[0, 2, -6]}  intensity={0.6} color="#e8d0ff" />

        {/* HDR environment — essential for clearcoat + iridescence reflections */}
        <Environment preset="studio" />

        <Float speed={1.6} rotationIntensity={0.35} floatIntensity={0.35}>
          <DestroMask volume={volume} emotion={emotion} />
        </Float>
      </Canvas>
    </div>
  );
  