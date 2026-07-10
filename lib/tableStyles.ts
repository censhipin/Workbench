export interface TableStyle {
  name: string;
  headerBg: string;
  headerColor: string;
  rowEvenBg: string;
  rowOddBg: string;
  borderColor: string;
  accentBorder?: string;
}

export const TABLE_STYLES: TableStyle[] = [
  {
    name: '雾霾蓝',
    headerBg: '#5B7B9A',
    headerColor: '#ffffff',
    rowEvenBg: '#ffffff',
    rowOddBg: '#EDF2F7',
    borderColor: '#DCE4EC',
  },
  {
    name: '鼠尾草绿',
    headerBg: '#7A9A7A',
    headerColor: '#ffffff',
    rowEvenBg: '#ffffff',
    rowOddBg: '#F0F5F0',
    borderColor: '#DCE6DC',
  },
  {
    name: '干枯玫瑰',
    headerBg: '#B5838D',
    headerColor: '#ffffff',
    rowEvenBg: '#ffffff',
    rowOddBg: '#FBF0F2',
    borderColor: '#F0E0E4',
  },
  {
    name: '燕麦杏',
    headerBg: '#C4A882',
    headerColor: '#ffffff',
    rowEvenBg: '#ffffff',
    rowOddBg: '#F9F4EB',
    borderColor: '#EDE4D8',
  },
  {
    name: '经典蓝',
    headerBg: '#2D5F8A',
    headerColor: '#ffffff',
    rowEvenBg: '#ffffff',
    rowOddBg: '#E8F0FE',
    borderColor: '#CDD9E8',
  },
  {
    name: '松石绿',
    headerBg: '#2F7A6E',
    headerColor: '#ffffff',
    rowEvenBg: '#ffffff',
    rowOddBg: '#E6F2EF',
    borderColor: '#C8DCD6',
  },
  {
    name: '暖阳橙',
    headerBg: '#C77D4A',
    headerColor: '#ffffff',
    rowEvenBg: '#ffffff',
    rowOddBg: '#FDF2E8',
    borderColor: '#F0E0D0',
  },
  {
    name: '高级灰',
    headerBg: '#6B7280',
    headerColor: '#ffffff',
    rowEvenBg: '#ffffff',
    rowOddBg: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
];
