import React, { useEffect } from 'react';
import { SurveyForm } from '../widgets/SurveyForm/SurveyForm';
import { initNetworkListener } from '../processes/sync/offlineSync';
import { unlockStuckRecords } from '../shared/idb';

export const App: React.FC = () => {
  useEffect(() => {
    // 1. Chạy 1 lần duy nhất để gỡ deadlock nếu có
    unlockStuckRecords().then(() => {
      // 2. Khởi tạo trình lắng nghe mạng khi App mount sau khi đã unlock
      initNetworkListener();
    });
  }, []);

  return (
    <div className="w-full h-full bg-slate-50">
      <SurveyForm />
    </div>
  );
};

export default App;
