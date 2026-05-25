import React, { useRef } from 'react';
  import { Canvas, useFrame } from '@react-three/fiber';
  import { Float, PerspectiveCamera } from '@react-three/drei';
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
    const meshRef = useRef<THREE.Mesh>(null);
    const leftEyeRef = useRef<THREE.Mesh>(null);
    const rightEyeRef = useRef<THREE.Mesh>(null);
    const jawRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
      if (!meshRef.current) return;
      const time = state.clock.getElapsedTime();

      meshRef.current.position.y = Math.sin(time * 0.5) * 0.05;

      let eyeColor = '#00ffff';
      let glowIntensity = 2 + volume * 15;
      let jawScaleX = 0.6;

      switch (emotion) {
        case 'cyber':
          eyeColor = '#ff2200';
          glowIntensity = 4 + volume * 20 + Math.sin(time * 8) * 1.5;
          jawScaleX = 0.62;
          break;
        case 'cinema':
          eyeColor = '#00ff44';
          glowIntensity = 3 + volume * 12 + Math.sin(time * 3) * 0.8;
          jawScaleX = 0.68;
          break;
        case 'thinking':
          eyeColor = '#00ccff';
          glowIntensity = 1.5 + Math.sin(time * 2) * 1;
          break;
        case 'concerned':
          eyeColor = '#44ccff';
          glowIntensity = 1.2 + volume * 5;
          jawScaleX = 0.55;
          break;
        case 'amused':
          eyeColor = '#00ffff';
          glowIntensity = 3 + volume * 18;
          jawScaleX = 0.7;
          break;
        case 'friendly_stern':
          eyeColor = '#00eebb';
          glowIntensity = 2.5 + volume * 10;
          jawScaleX = 0.65;
          break;
        case 'laughing':
          eyeColor = '#00ffff';
          glowIntensity = 5 + Math.sin(time * 15) * 3;
          jawScaleX = 0.9;
          break;
        case 'smiling':
          jawScaleX = 0.8;
          break;
        case 'serious':
          eyeColor = '#0088ff';
          glowIntensity = 1 + volume * 4;
          break;
        case 'empathetic':
          eyeColor = '#00ffaa';
          glowIntensity = 1.5 + volume * 8;
          break;
      }

      if (leftEyeRef.current && rightEyeRef.current) {
        const matL = leftEyeRef.current.material as THREE.MeshStandardMaterial;
        const matR = rightEyeRef.current.material as THREE.MeshStandardMaterial;
        matL.color.set(eyeColor);
        matL.emissive.set(eyeColor);
        matL.emissiveIntensity = glowIntensity;
        matR.color.set(eyeColor);
        matR.emissive.set(eyeColor);
        matR.emissiveIntensity = glowIntensity;
      }

      if (jawRef.current) {
        const jawTarget = -0.6 - (volume * 0.6);
        jawRef.current.position.y = THREE.MathUtils.lerp(jawRef.current.position.y, jawTarget, 0.2);
        jawRef.current.scale.x = THREE.MathUtils.lerp(jawRef.current.scale.x, jawScaleX, 0.1);
        if (emotion === 'laughing') {
          jawRef.current.position.y -= Math.sin(time * 25) * 0.08;
        }
      }
    });

    return (
      <group>
        <mesh ref={meshRef} scale={[1, 1.2, 0.8]}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial color="#b8b8c8" roughness={0.08} metalness={0.95} />
        </mesh>
        <mesh ref={leftEyeRef} position={[-0.35, 0.4, 0.6]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.35, 0.4, 0.6]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
        </mesh>
        <mesh ref={jawRef} position={[0, -0.6, 0.3]} scale={[0.6, 0.4, 0.4]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#707080" metalness={0.95} roughness={0.15} />
        </mesh>
      </group>
    );
  };

  export const DestroFace = ({ volume = 0, emotion = 'neutral' }: { volume?: number; emotion?: Emotion }) => {
    return (
      <div style={{ width: '100%', height: '100%', background: '#000', display: 'block' }}>
        <Canvas
          gl={{ preserveDrawingBuffer: true, antialias: false, powerPreference: 'default' }}
          dpr={[1, 2]}
          style={{ display: 'block', width: '100%', height: '100%' }}
        >
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={1.2} color="#ffffff" />
          <pointLight position={[-10, 5, 5]} intensity={0.6} color="#00ffff" />
          <Float speed={1.8} rotationIntensity={0.4} floatIntensity={0.4}>
            <DestroMask volume={volume} emotion={emotion} />
          </Float>
        </Canvas>
      </div>
    );
  };
  