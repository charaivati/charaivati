// Solar system code

'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default function SolarSystemPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene, camera, renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011); // dark space blue

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 20, 50);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);

    // Lights
    const pointLight = new THREE.PointLight(0xffffff, 2, 300);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft light everywhere
    scene.add(ambientLight);

    // Sun
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // bright yellow sun
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Planets
    const planets: { orbit: THREE.Object3D; speed: number }[] = [];

    const createPlanet = (size: number, color: number, distance: number, speed: number) => {
      const orbit = new THREE.Object3D();
      scene.add(orbit);

      const geometry = new THREE.SphereGeometry(size, 32, 32);
      const material = new THREE.MeshBasicMaterial({ color }); // planets glow by themselves
      const planet = new THREE.Mesh(geometry, material);
      planet.position.x = distance;
      orbit.add(planet);

      planets.push({ orbit, speed });
    };

    createPlanet(1, 0x8888ff, 10, 0.02);   // Mercury
    createPlanet(1.5, 0xff8844, 15, 0.015); // Venus
    createPlanet(2, 0x44aa44, 20, 0.01);    // Earth
    createPlanet(1.8, 0xaa4444, 25, 0.008); // Mars

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      sun.rotation.y += 0.001; // Sun slow rotation
      planets.forEach(p => {
        p.orbit.rotation.y += p.speed; // planets orbit
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh', background: 'black' }} />
  );
}
