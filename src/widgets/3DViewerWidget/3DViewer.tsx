import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Environment } from '@react-three/drei';

export const Viewer3D: React.FC = () => {
  const [isContextLost, setIsContextLost] = useState(false);

  useEffect(() => {
    const handleContextLost = (e: Event) => {
      e.preventDefault(); // Tránh bị trình duyệt đóng băng hoàn toàn
      setIsContextLost(true);
      console.warn("WebGL Context Lost! Kích hoạt giao diện Fallback 2D.");
    };

    // Truy vấn canvas sau khi R3F mount để lắng nghe sự kiện
    const canvasElements = document.getElementsByTagName('canvas');
    if (canvasElements.length > 0) {
      canvasElements[0].addEventListener('webglcontextlost', handleContextLost);
      return () => {
        canvasElements[0].removeEventListener('webglcontextlost', handleContextLost);
      };
    }
  }, []);

  if (isContextLost) {
    return (
      <div className="w-full h-56 bg-slate-200 flex items-center justify-center rounded-2xl shadow-inner border border-slate-300">
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl">🗺️</span>
          <span className="text-slate-600 font-semibold text-sm">Bản đồ 2D (Chế độ Fallback)</span>
          <span className="text-slate-400 text-xs">WebGL đã bị ngắt để tiết kiệm RAM.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-56 rounded-2xl overflow-hidden relative shadow-md bg-gradient-to-b from-slate-50 to-slate-200">
      <Canvas 
        frameloop="demand" // Tắt render liên tục (tránh ngốn RAM/Pin)
        camera={{ position: [0, 2, 5], fov: 45 }}
        gl={{ powerPreference: 'low-power' }} // Gợi ý GPU dùng ít điện
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <Box args={[1.5, 1.5, 1.5]}>
          <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.2} />
        </Box>
        <OrbitControls enableZoom={false} autoRotate={false} />
        <Environment preset="city" />
      </Canvas>
      <div className="absolute bottom-2 right-2 bg-black/40 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
        Vuốt để xoay 3D
      </div>
    </div>
  );
};
