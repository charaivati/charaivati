'use client';

import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default function SolarSystemPage() {
  const mountRef = useRef(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000010);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 80;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 2, 500);
    scene.add(pointLight);

    const sunTexture = new THREE.TextureLoader().load('/textures/2k_sun.jpeg');
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    const glowTexture = new THREE.TextureLoader().load('/textures/glow.png');
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(20, 20, 1);
    sun.add(glow);

    function createPlanet(radius, texturePath, distance, speed, tilt) {
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const texture = new THREE.TextureLoader().load(texturePath);
      const material = new THREE.MeshStandardMaterial({ map: texture });
      const mesh = new THREE.Mesh(geometry, material);

      mesh.userData = { distance, speed, angle: Math.random() * Math.PI * 2, tilt };
      mesh.rotation.z = THREE.MathUtils.degToRad(tilt);

      scene.add(mesh);
      return mesh;
    }

    const earth = createPlanet(2, '/textures/2k_earth.jpg', 20, 0.01, 23.5);
    createPlanet(1, '/textures/2k_mercury.jpg', 10, 0.02, 7);
    createPlanet(1.5, '/textures/2k_venus.jpg', 15, 0.015, 177);
    createPlanet(1.8, '/textures/2k_mars.jpeg', 25, 0.008, 25);
    createPlanet(4.8, '/textures/2k_jupiter.jpeg', 30, 0.006, 3);
    const saturn = createPlanet(4, '/textures/2k_saturn.jpg', 38, 0.005, 27);
    const uranus = createPlanet(3, '/textures/2k_uranus.jpg', 46, 0.004, 98);
    createPlanet(3, '/textures/2k_neptune.jpg', 54, 0.0035, 28);

    const ringGeometry = new THREE.RingGeometry(5, 7, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    saturn.add(ring);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event) => {
      event.preventDefault();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.updateMatrixWorld();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children);
      const hovered = intersects.find((intersect) => intersect.object === earth);
      if (hovered) {
        setIsHovered(true);
        earth.material.emissive.set(0x00ff00);
      } else {
        setIsHovered(false);
        earth.material.emissive.set(0x000000);
      }
    };

    const onMouseClick = (event) => {
      event.preventDefault();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children);
      const selected = intersects.find((intersect) => intersect.object === earth);
      if (selected) {
        window.location.href = '/earth-info';
      }
    };

    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('click', onMouseClick, false);

    function animate() {
      if (isFrozen) return;
      requestAnimationFrame(animate);

      const time = Date.now() * 0.002;

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData.distance) {
          obj.userData.angle += obj.userData.speed;
          obj.position.x = obj.userData.distance * Math.cos(obj.userData.angle);
          obj.position.y = obj.userData.distance * Math.sin(obj.userData.angle) * Math.sin(THREE.MathUtils.degToRad(obj.userData.tilt));
          obj.position.z = obj.userData.distance * Math.sin(obj.userData.angle) * Math.cos(THREE.MathUtils.degToRad(obj.userData.tilt));
          obj.rotation.y += 0.002;
        }
      });

      sun.rotation.y += 0.001;

      const scale = 20 + Math.sin(time) * 1.5;
      glow.scale.set(scale, scale, 1);

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onMouseClick);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [isFrozen]);

  return (
    <>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
      <button
        onClick={() => setIsFrozen(!isFrozen)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10,
          padding: '10px',
          background: 'white',
        }}
      >
        {isFrozen ? 'Resume' : 'Freeze'}
      </button>
    </>
  );
}
