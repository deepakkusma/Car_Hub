import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Stage } from "@react-three/drei";
import { CarModel } from "~/components/3d/CarModel";
import { Suspense, useRef } from "react";
import * as THREE from "three";

function RotatingScene() {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.5; // Smooth rotation speed
        }
    });

    return (
        <group ref={groupRef}>
            <CarModel />
        </group>
    );
}

export function RevolvingCar() {
    return (
        <div className="w-full h-full min-h-[300px] relative flex items-center justify-center">
            <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 150], fov: 40 }} gl={{ alpha: true }}>
                <Suspense fallback={null}>
                    <Stage environment="city" intensity={0.6}>
                        <RotatingScene />
                    </Stage>
                    <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={4} />
                </Suspense>
            </Canvas>
        </div>
    );
}
