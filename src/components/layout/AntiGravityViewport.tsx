import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';

// AntiGravity Core Layer Configuration per specification
export const GlassCoreConfig = {
  refractionRatio: 0.98,
  fresnelPower: 2.5,
  ambientGlowColor: new THREE.Color("rgba(168, 85, 247, 0.4)"),
  specularIntensity: 1.2,
  blurPasses: 4,
  noiseGrainDensity: 0.04
};

// Custom GLSL Shader Material for the Background Cyber Matrix
const BackgroundMatrixMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#090514") },
    uGlow: { value: new THREE.Color("#7800ff") },
    uCyan: { value: new THREE.Color("#00ffff") },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uGlow;
    uniform vec3 uCyan;
    varying vec2 vUv;
    
    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      // Create a glowing radial mesh network
      vec2 center = vUv - 0.5;
      float dist = length(center);
      
      // Dynamic noise movement
      float noise = snoise(vUv * 3.0 + uTime * 0.1);
      
      // Radial glow mixed with noise
      float glowIntensity = smoothstep(0.8, 0.0, dist) * 0.5;
      vec3 finalColor = mix(uColor, uGlow, glowIntensity + noise * 0.1);
      
      // Add cyber grid lines
      float gridX = smoothstep(0.98, 1.0, fract(vUv.x * 20.0 + uTime * 0.05));
      float gridY = smoothstep(0.98, 1.0, fract(vUv.y * 20.0 + uTime * 0.05));
      float grid = max(gridX, gridY) * 0.15;
      
      finalColor = mix(finalColor, uCyan, grid);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

const BackgroundMatrix = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, 0, -10]}>
      <planeGeometry args={[100, 100]} />
      <shaderMaterial 
        ref={materialRef}
        vertexShader={BackgroundMatrixMaterial.vertexShader}
        fragmentShader={BackgroundMatrixMaterial.fragmentShader}
        uniforms={BackgroundMatrixMaterial.uniforms}
        depthWrite={false}
      />
    </mesh>
  );
};

import { MeshTransmissionMaterial } from '@react-three/drei';
import { glassRegistry, subscribeGlassRegistry } from '../../lib/GlassStore';

const TrackedGlassMeshes = () => {
  const { size, viewport } = useThree();
  const [refs, setRefs] = React.useState<React.RefObject<HTMLDivElement | null>[]>([]);

  // Listen for DOM elements requesting WebGL tracking
  React.useEffect(() => {
    const update = () => setRefs(Array.from(glassRegistry));
    update();
    return subscribeGlassRegistry(update);
  }, []);

  return (
    <>
      {refs.map((ref, i) => (
        <TrackedGlassMesh key={i} domRef={ref} size={size} viewport={viewport} />
      ))}
    </>
  );
};

const TrackedGlassMesh = ({ domRef, size, viewport }: { domRef: React.RefObject<HTMLDivElement | null>, size: any, viewport: any }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!domRef.current || !meshRef.current) return;
    const rect = domRef.current.getBoundingClientRect();
    
    // Map DOM pixels to WebGL world coordinates
    const width = (rect.width / size.width) * viewport.width;
    const height = (rect.height / size.height) * viewport.height;
    
    const x = (rect.left / size.width) * viewport.width - viewport.width / 2 + width / 2;
    const y = -(rect.top / size.height) * viewport.height + viewport.height / 2 - height / 2;
    
    meshRef.current.position.set(x, y, 1); // Z=1 to hover slightly above background
    meshRef.current.scale.set(width, height, 1);
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1]} />
      {/* Premium WebGL Shader Material for true IoR and thickness */}
      <MeshTransmissionMaterial 
        background={new THREE.Color('#06020b')}
        transmission={1}
        roughness={0.1}
        thickness={1.5}
        ior={GlassCoreConfig.refractionRatio}
        chromaticAberration={0.06}
        anisotropy={0.1}
        distortion={0.1}
        distortionScale={0.5}
        temporalDistortion={0.0}
      />
    </mesh>
  );
};

export default function AntiGravityViewport({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#06020b' }}>
      {/* Absolute positioning for the WebGL core layer */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }} gl={{ antialias: true, alpha: false }}>
          <BackgroundMatrix />
          <Environment preset="city" />
          
          {/* Inject dynamic tracked glass meshes */}
          <TrackedGlassMeshes />
        </Canvas>
      </div>

      {/* The HTML DOM UI overlays securely on top of the WebGL canvas. pointer-events-none on canvas ensures this layer gets all clicks */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
