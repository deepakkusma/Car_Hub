import { useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

export function CarModel(props: any) {
    const group = useRef<THREE.Group>(null);
    const { scene } = useGLTF("/models/ford.glb");

    return (
        <group ref={group} {...props} dispose={null}>
            <primitive object={scene} />
        </group>
    );
}

// Preload the model
useGLTF.preload("/models/ford.glb");
