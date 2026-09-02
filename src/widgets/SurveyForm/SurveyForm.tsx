import React, { useMemo, useState } from 'react';
import { useFormStore } from '../../entities/survey/model/formStore';
import facilitiesData from '../../shared/api/mock/facilities.json';
import { TakePhoto } from '../../features/camera/TakePhoto';
import { Viewer3D } from '../3DViewerWidget/3DViewer';

import { useNetworkStore } from '../../entities/network/model/networkStore';

export const SurveyForm: React.FC = () => {
  const formState = useFormStore();
  const { syncStatus, isOnline } = useNetworkStore();
  const { 

    selectedZone, selectedBuilding, selectedRoom, equipmentType, 
    conditionRating, notes, photoBlobId, setField, resetForm 
  } = formState;

  const [localBlob, setLocalBlob] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Compute nested drop-down data
  const zones = facilitiesData.zones;
  const currentZone = useMemo(() => zones.find(z => z.id === selectedZone), [selectedZone]);
  const currentBuilding = useMemo(() => currentZone?.buildings.find(b => b.id === selectedBuilding), [currentZone, selectedBuilding]);

  const handlePhotoBlob = (blob: Blob) => {
    setLocalBlob(blob);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone || !selectedBuilding || !selectedRoom) {
      alert("Vui lòng chọn đầy đủ Vị trí (Khu, Tòa nhà, Phòng)!");
      return;
    }

    try {
      setIsSaving(true);
      // Gọi idb với Blob đã xử lý (nếu có)
      // Hàm saveSurveyDraft hiện tại nhận string (Base64) rồi mới parse ra Blob.
      // Tuy nhiên do yêu cầu truyền Blob ngay, ta có thể bổ sung cách ghi trực tiếp Blob xuống DB
      // Mặc định IDB hỗ trợ ghi trực tiếp Blob Object rất tốt.
      
      const dbPayload = {
        selectedZone,
        selectedBuilding,
        selectedRoom,
        equipmentType,
        conditionRating,
        notes,
      };

      // Giả lập lưu vào IDB. Để truyền Blob thẳng, nếu bạn đã sửa idb/index.ts 
      // để nhận thêm tùy chọn truyền blob trực tiếp thì gọi thẳng.
      // Dưới đây gọi saveSurveyDraft với tham số mở rộng
      const { initDB } = await import('../../shared/idb');
      const db = await initDB();
      const tx = db.transaction('surveys', 'readwrite');
      await tx.store.add({
        ...dbPayload,
        photoBlob: localBlob,
        syncStatus: 'PENDING_SYNC',
        createdAt: Date.now()
      });
      await tx.done;

      alert('Đã lưu nháp vào IndexedDB (Trạng thái PENDING_SYNC)');
      resetForm();
      setLocalBlob(null);
    } catch (err) {
      console.error(err);
      alert('Lỗi lưu nháp.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="flex flex-col min-h-screen bg-slate-50 overflow-y-auto w-full 
                 pt-[env(safe-area-inset-top,20px)] pb-[env(safe-area-inset-bottom,20px)]"
    >
      <header className="px-6 py-4 bg-white shadow-sm z-10 sticky top-0">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Khảo Sát Thiết Bị</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">Hệ thống đồng bộ ngoại tuyến VKU</p>
      </header>

      <div className="px-5 py-4">
        <Viewer3D />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-5 flex-1 pb-6">
        
        {/* Nhóm Vị Trí */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
          <h2 className="font-bold text-slate-700 text-sm">📍 Vị Trí Hiện Tại</h2>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Khu Vực</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium appearance-none"
              value={selectedZone}
              onChange={(e) => {
                setField('selectedZone', e.target.value);
                setField('selectedBuilding', '');
                setField('selectedRoom', '');
              }}
            >
              <option value="">-- Chọn Khu Vực --</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Tòa Nhà</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium appearance-none disabled:opacity-50"
              value={selectedBuilding}
              onChange={(e) => {
                setField('selectedBuilding', e.target.value);
                setField('selectedRoom', '');
              }}
              disabled={!selectedZone}
            >
              <option value="">-- Chọn Tòa Nhà --</option>
              {currentZone?.buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Phòng</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium appearance-none disabled:opacity-50"
              value={selectedRoom}
              onChange={(e) => setField('selectedRoom', e.target.value)}
              disabled={!selectedBuilding}
            >
              <option value="">-- Chọn Phòng --</option>
              {currentBuilding?.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>

        {/* Thông tin Thiết bị */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
          <h2 className="font-bold text-slate-700 text-sm">🛠️ Thông Tin Thiết Bị</h2>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Tên Thiết Bị / Mã Tài Sản</label>
            <input 
              type="text"
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500"
              placeholder="VD: Điều hòa Panasonic 1HP"
              value={equipmentType}
              onChange={(e) => setField('equipmentType', e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Tình trạng (1-5 Sao)</label>
            <input 
              type="range" min="1" max="5" 
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              value={conditionRating}
              onChange={(e) => setField('conditionRating', Number(e.target.value))}
            />
            <div className="text-center font-bold text-blue-600">{conditionRating} Sao</div>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Ghi chú</label>
            <textarea 
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none h-24"
              placeholder="Mô tả hỏng hóc..."
              value={notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </div>
        </div>

        {/* Chụp ảnh */}
        <TakePhoto onPhotoBlob={handlePhotoBlob} />
        {photoBlobId && (
          <div className="w-full p-2 bg-white rounded-xl shadow-sm border border-slate-100 flex justify-center mt-2 relative">
             <button 
                type="button"
                className="absolute top-3 right-3 bg-red-500/80 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
                onClick={() => {
                  setField('photoBlobId', null);
          setLocalBlob(null);
        }}
     >
        ✕
     </button>
     <img src={photoBlobId} alt="Preview" className="h-40 object-cover rounded-lg w-full" />
  </div>
)}

<button 
  type="submit" 
  disabled={isSaving || syncStatus === 'SYNCING'}
  className={`mt-2 w-full font-bold p-4 rounded-xl shadow-lg transition-all 
    ${isSaving || syncStatus === 'SYNCING' 
      ? 'bg-slate-500 text-white opacity-70 cursor-wait' 
      : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xl active:scale-[0.98]'}`}
>
  {isSaving ? "Đang lưu nháp..." : 
   syncStatus === 'SYNCING' ? "Đang đồng bộ dữ liệu..." : 
   "Lưu Form (PENDING_SYNC)"}
</button>

{/* Hiển thị trạng thái mạng */}
{!isOnline && (
  <div className="mt-2 text-center text-xs font-semibold text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
    ⚠️ Không có mạng. Dữ liệu sẽ lưu nháp (Offline).
  </div>
)}
{syncStatus === 'SUCCESS' && (
  <div className="mt-2 text-center text-xs font-semibold text-green-600 bg-green-50 p-2 rounded-lg border border-green-100">
    ✅ Đã đồng bộ dữ liệu thành công!
  </div>
)}

      </form>
    </div>
  );
};
