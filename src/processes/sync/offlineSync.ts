import { Network } from '@capacitor/network';
import { getAndLockPendingSurveys, updateSurveyStatus } from '../../shared/idb';
import { useNetworkStore } from '../../entities/network/model/networkStore';

const MOCK_API_URL = 'https://api.vkufieldsurvey.vanhoang.online/sync';
const TIMEOUT_MS = 25000; // 25 giây giới hạn để tránh bị OS kill app khi chạy nền

/**
 * Xử lý Batch Sync với Hono API
 */
export const syncPendingSurveys = async () => {
  const { setSyncStatus, syncStatus } = useNetworkStore.getState();
  
  // Tránh chạy song song (mặc dù IDB đã có lock record, nhưng chặn ở cấp NetworkStore tốt hơn)
  if (syncStatus === 'SYNCING') return;
  
  setSyncStatus('SYNCING');
  
  try {
    const startTime = Date.now();
    const recordsToSync = await getAndLockPendingSurveys();

    if (recordsToSync.length === 0) {
      setSyncStatus('IDLE');
      return;
    }

    console.log(`Đang đồng bộ ${recordsToSync.length} bản ghi...`);

    for (const record of recordsToSync) {
      // 1. Kiểm tra thời gian quá 25 giây thì ngắt tiến trình
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.warn('Cảnh báo: Tác vụ vượt quá giới hạn 25 giây. Tạm ngắt để nhường CPU...');
        // Unlock các record còn lại
        break; 
      }

      // 2. Đóng gói Payload với FormData
      const formData = new FormData();
      formData.append('id', record.id!.toString());
      formData.append('zone', record.selectedZone);
      formData.append('building', record.selectedBuilding);
      formData.append('room', record.selectedRoom);
      formData.append('equipmentType', record.equipmentType);
      formData.append('conditionRating', record.conditionRating.toString());
      formData.append('notes', record.notes);
      
      if (record.photoBlob) {
        formData.append('photo', record.photoBlob, `photo_${record.id}.jpg`);
      }

      try {
        // 3. Gọi giả lập Hono POST API
        const response = await fetch(MOCK_API_URL, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          // 4. Nếu 200 OK -> SYNCED, gỡ lock
          await updateSurveyStatus(record.id!, 'SYNCED', true);
        } else {
          // Lỗi Server 5xx -> Bỏ lock để thử lại sau
          await updateSurveyStatus(record.id!, 'FAILED', true);
        }
      } catch (err) {
        // Lỗi rớt mạng hoặc CORS -> Bỏ lock thử lại sau
        await updateSurveyStatus(record.id!, 'FAILED', true);
      }
    }

    setSyncStatus('SUCCESS');
    
    // Reset status after a few seconds
    setTimeout(() => {
      useNetworkStore.getState().setSyncStatus('IDLE');
    }, 3000);

  } catch (error) {
    console.error('Lỗi nghiêm trọng trong tiến trình đồng bộ ngầm:', error);
    setSyncStatus('ERROR');
  }
};

/**
 * Lắng nghe kết nối mạng từ Capacitor Network để tự động đồng bộ
 */
export const initNetworkListener = async () => {
  const { setOnlineStatus } = useNetworkStore.getState();
  
  // Khởi tạo trạng thái đầu
  const status = await Network.getStatus();
  setOnlineStatus(status.connected);

  if (status.connected) {
    syncPendingSurveys();
  }

  // Lắng nghe thay đổi
  Network.addListener('networkStatusChange', (status) => {
    setOnlineStatus(status.connected);
    console.log('Trạng thái mạng thay đổi:', status.connected ? 'ONLINE' : 'OFFLINE');
    if (status.connected) {
      syncPendingSurveys();
    }
  });
};
