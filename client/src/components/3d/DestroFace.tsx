import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

const DestroMask = ({ volume = 0 }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);

  // Animate the mask and eyes based on audio volume
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Suble breathing motion
    meshRef.current.position.y = Math.sin(time * 0.5) * 0.1;
    
    // Reactive eye glow
    const glowIntensity = 2 + volume * 15;
    if (leftEyeRef.current && rightEyeRef.current) {
      (leftEyeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity;
      (rightEyeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity;
    }

    // Lip-sync distortion
    if (meshRef.current.material instanceof THREE.ShaderMaterial) {
       // Custom distortion logic for "talking"
    }
  });

  return (
    <group>
      {/* The Silver Mask (Beryllium-Steel) */}
      <Sphere ref={meshRef} args={[1, 64, 64]} scale={[1, 1.2, 0.8]}>
        <MeshDistortMaterial
          color="#c0c0c0"
          roughness={0.1}
          metalness={1}
          distort={0.2 + volume * 0.5}
          speed={2}
        />
      </Sphere>

      {/* Glowing Blue Eyes */}
      <mesh ref={leftEyeRef} position={[-0.35, 0.4, 0.6]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial 
          color="#00ffff" 
          emissive="#00ffff" 
          emissiveIntensity={2} 
        />
      </mesh>
      <mesh ref={rightEyeRef} position={[0.35, 0.4, 0.6]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial 
          color="#00ffff" 
          emissive="#00ffff" 
          emissiveIntensity={2} 
        />
      </mesh>

      {/* Chin/Jaw definition */}
      <Sphere position={[0, -0.6, 0.3]} scale={[0.6, 0.4, 0.4]}>
        <meshStandardMaterial color="#808080" metalness={1} roughness={0.2} />
      </Sphere>
    </group>
  );
};

export const DestroFace = ({ volume = 0 }) => {
  return (
    <div className="w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
        <pointLight position={[-10, 5, 5]} intensity={0.5} color="#00ffff" />
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <DestroMask volume={volume} />
        </Float>
        
        <gridHelper args={[20, 20, 0x444444, 0x222222]} position={[0, -2, 0]} />
      </Canvas>
    </div>
  );
};
