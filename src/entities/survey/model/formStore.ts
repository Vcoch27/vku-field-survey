import { create } from 'zustand';

export interface FormState {
  selectedZone: string;
  selectedBuilding: string;
  selectedRoom: string;
  equipmentType: string;
  conditionRating: number;
  notes: string;
  photoBlobId: string | null; // Có thể lưu object URL hoặc ID của ảnh trong DB tạm thời
  
  setField: <K extends keyof Omit<FormState, 'setField' | 'resetForm'>>(
    field: K,
    value: FormState[K]
  ) => void;
  resetForm: () => void;
}

const initialState: Omit<FormState, 'setField' | 'resetForm'> = {
  selectedZone: '',
  selectedBuilding: '',
  selectedRoom: '',
  equipmentType: '',
  conditionRating: 0,
  notes: '',
  photoBlobId: null,
};

export const useFormStore = create<FormState>((set) => ({
  ...initialState,
  setField: (field, value) => set((state) => ({ ...state, [field]: value })),
  resetForm: () => set(initialState),
}));
