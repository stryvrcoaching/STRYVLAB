'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function Signature3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const signatureRef = useRef<THREE.Points | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Create signature points
    const pointsCount = 12000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(pointsCount * 3);

    for (let i = 0; i < pointsCount; i++) {
      const angle = 0.1 * i;
      const radius = 0.05 * Math.sqrt(i);
      const noise = Math.sin(radius * 5) * 0.2;
      positions[i * 3] = (radius + noise) * Math.cos(angle);
      positions[i * 3 + 1] = (radius + noise) * Math.sin(angle);
      positions[i * 3 + 2] = Math.sin(i * 0.02) * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.008,
      color: 0x00ffc3,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });

    const signature = new THREE.Points(geometry, material);
    scene.add(signature);
    signatureRef.current = signature;

    camera.position.z = 5;

    // GSAP ScrollTrigger animations
    gsap.set(signature.position, { x: 0, y: 0, z: 0 });

    // Movement to ICP section
    gsap.to(signature.position, {
      scrollTrigger: {
        trigger: '#icp',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
      x: 2,
      z: -2,
      y: 1,
    });

    // Zoom and rotation for Pillars section
    gsap.to(signature.scale, {
      scrollTrigger: {
        trigger: '#pillars',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
      x: 2.5,
      y: 2.5,
      z: 2.5,
    });

    gsap.to(signature.rotation, {
      scrollTrigger: {
        trigger: '#pillars',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
      x: Math.PI,
      y: Math.PI / 2,
    });

    // Return to center for Simulation
    gsap.to(signature.position, {
      scrollTrigger: {
        trigger: '#simulation',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
      x: -4,
      y: 0,
      z: 0,
    });

    // Animation loop
    function animate() {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (signatureRef.current) {
        signatureRef.current.rotation.z += 0.0005;
      }
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      id="canvas-container"
    />
  );
}











