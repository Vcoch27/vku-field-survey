import React, { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useFormStore } from '../../entities/survey/model/formStore';
import { base64ToBlob } from '../../shared/idb';

export const TakePhoto: React.FC<{ onPhotoBlob: (blob: Blob) => void }> = ({ onPhotoBlob }) => {
  const [error, setError] = useState<string | null>(null);
  const setField = useFormStore((state) => state.setField);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async () => {
    try {
      setError(null);
      // Gọi Capacitor Camera gốc
      const image = await Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });

      if (image.base64String) {
        // Truyền ngay vào base64ToBlob để tránh giữ Base64 quá lâu trên RAM
        const blob = base64ToBlob(image.base64String, `image/${image.format}`);
        onPhotoBlob(blob);
        
        // Tạo URL tạm thời để hiển thị Preview
        const objectUrl = URL.createObjectURL(blob);
        setField('photoBlobId', objectUrl);
      }
    } catch (err: any) {
      console.warn("Camera Error:", err);
      setError('Lỗi lấy máy ảnh (hoặc bị từ chối quyền). Vui lòng dùng tính năng chọn file dự phòng.');
    }
  };

  const handleFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onPhotoBlob(file); // Bản thân file đã là một thể hiện của Blob
      const objectUrl = URL.createObjectURL(file);
      setField('photoBlobId', objectUrl);
    }
  };

  return (
    <div className="flex flex-col gap-2 my-2 w-full">
      <button 
        type="button"
        onClick={handleCapture}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold active:scale-95 transition-transform shadow-md flex items-center justify-center gap-2"
      >
        <span>📸 Chụp Ảnh Báo Cáo</span>
      </button>
      
      {/* UI Fallback khi Camera lỗi/từ chối */}
      {error && (
        <div className="flex flex-col gap-2 p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
          <span className="text-red-600 text-xs font-semibold">{error}</span>
          <input 
            type="file" 
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileFallback}
            className="text-sm block w-full text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-red-100 file:text-red-700
              hover:file:bg-red-200 cursor-pointer"
          />
        </div>
      )}
    </div>
  );
};
