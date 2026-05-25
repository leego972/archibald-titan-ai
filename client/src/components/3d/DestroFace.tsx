import React, { useRef } from 'react';
  import { Canvas, useFrame } from '@react-three/fiber';
  import { Float, PerspectiveCamera } from '@react-three/drei';
  import * as THREE from 'three';

  export type Emotion =
    | 'neutral' | 'smiling' | 'laughing' | 'serious' | 'empathetic'
    | 'thinking' | 'concerned' | 'amused' | 'friendly_stern' | 'cyber' | 'cinema';

  const DestroMask = ({ volume = 0, emotion = 'neutral' }: { volume: number; emotion: Emotion }) => {
    const meshRef     = useRef<THREE.Mesh>(null);
    const leftEyeRef  = useRef<THREE.Mesh>(null);
    const rightEyeRef = useRef<THREE.Mesh>(null);
    const jawRef      = useRef<THREE.Mesh>(null);

    useFrame((state) => {
      if (!meshRef.current) return;
      const t = state.clock.getElapsedTime();
      meshRef.current.position.y = Math.sin(t * 0.5) * 0.05;

      let eyeColor  = '#00cc55'; // green = idle/complete
      let glowInt   = 2.2 + Math.sin(t * 0.9) * 0.4;
      let jawScaleX = 0.60;

      switch (emotion) {
        case 'thinking':       eyeColor = '#1a7fff'; glowInt = 3.5 + volume * 14; break; // listening = blue
        case 'concerned':      eyeColor = '#ff3300'; glowInt = 5 + volume * 22 + Math.sin(t * 3) * 1.5; jawScaleX = 0.55; break; // working = red
        case 'friendly_stern': eyeColor = '#00eedd'; glowInt = 2.8 + volume * 11; jawScaleX = 0.65; break; // speaking = teal
        case 'neutral':        eyeColor = '#00cc55'; glowInt = 1.8 + Math.sin(t * 0.8) * 0.5; break;
        case 'cyber':          eyeColor = '#ff2200'; glowInt = 4 + volume * 20; break;
        case 'cinema':         eyeColor = '#00ff44'; glowInt = 3 + volume * 12; jawScaleX = 0.68; break;
        case 'laughing':       eyeColor = '#00eedd'; glowInt = 5 + Math.sin(t * 15) * 3; jawScaleX = 0.9; break;
        case 'smiling':        eyeColor = '#00cc55'; jawScaleX = 0.8; break;
        case 'serious':        eyeColor = '#1a7fff'; glowInt = 1 + volume * 4; break;
        case 'empathetic':     eyeColor = '#00cc88'; glowInt = 1.5 + volume * 8; break;
        case 'amused':         eyeColor = '#00eedd'; glowInt = 3 + volume * 18; jawScaleX = 0.7; break;
      }

      if (leftEyeRef.current && rightEyeRef.current) {
        const mL = leftEyeRef.current.material as THREE.MeshStandardMaterial;
        const mR = rightEyeRef.current.material as THREE.MeshStandardMaterial;
        mL.color.set(eyeColor); mL.emissive.set(eyeColor); mL.emissiveIntensity = glowInt;
        mR.color.set(eyeColor); mR.emissive.set(eyeColor); mR.emissiveIntensity = glowInt;
      }

      if (jawRef.current) {
        const jt = -0.6 - volume * 0.6;
        jawRef.current.position.y = THREE.MathUtils.lerp(jawRef.current.position.y, jt, 0.2);
        jawRef.current.scale.x    = THREE.MathUtils.lerp(jawRef.current.scale.x, jawScaleX, 0.1);
        if (emotion === 'laughing') jawRef.current.position.y -= Math.sin(t * 25) * 0.08;
      }

      // Slowly rotate to show pearl sheen from different angles
      if (meshRef.current) {
        meshRef.current.rotation.y = Math.sin(t * 0.25) * 0.15;
      }
    });

    return (
      <group>
        {/* Face — low metalness so it responds to lights, strong emissive so always visible */}
        <mesh ref={meshRef} scale={[1, 1.2, 0.8]}>
          <sphereGeometry args={[1, 96, 96]} />
          <meshStandardMaterial
            color="#b8bdd8"
            roughness={0.20}
            metalness={0.15}
            emissive="#1e2240"
            emissiveIntensity={3.5}
          />
        </mesh>

        {/* Subtle inner glow layer — slightly larger, very dark, pure emissive */}
        <mesh scale={[1.01, 1.21, 0.81]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial
            color="#000000"
            emissive="#2a3060"
            emissiveIntensity={1.2}
            transparent
            opacity={0.18}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Eyes */}
        <mesh ref={leftEyeRef} position={[-0.35, 0.38, 0.65]}>
          <sphereGeometry args={[0.10, 24, 24]} />
          <meshStandardMaterial color="#00cc55" emissive="#00cc55" emissiveIntensity={3} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.35, 0.38, 0.65]}>
          <sphereGeometry args={[0.10, 24, 24]} />
          <meshStandardMaterial color="#00cc55" emissive="#00cc55" emissiveIntensity={3} />
        </mesh>

        {/* Jaw */}
        <mesh ref={jawRef} position={[0, -0.6, 0.28]} scale={[0.60, 0.40, 0.40]}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshStandardMaterial
            color="#9096b8"
            roughness={0.22}
            metalness={0.12}
            emissive="#141830"
            emissiveIntensity={2.8}
          />
        </mesh>
      </group>
    );
  };

  export const DestroFace = ({
    volume  = 0,
    emotion = 'neutral',
  }: { volume?: number; emotion?: Emotion }) => (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'block' }}>
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'default' }}
        dpr={[1, 2]}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 4.5]} />

        <ambientLight intensity={2.0} />
        <directionalLight position={[0, 0, 6]}  intensity={5.0} color="#ffffff" />
        <directionalLight position={[0, 4, 4]}  intensity={2.5} color="#c8d8ff" />
        <directionalLight position={[4, -2, 4]} intensity={1.5} color="#ffd8c0" />
        <directionalLight position={[-4,-2, 4]} intensity={1.5} color="#c0d8ff" />

        <Float speed={1.6} rotationIntensity={0.3} floatIntensity={0.3}>
          <DestroMask volume={volume} emotion={emotion} />
        </Float>
      </Canvas>
    </div>
  );
  