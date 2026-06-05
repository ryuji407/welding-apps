import type { JigMapData } from '../types/jigMap';

const NAVY = '#1e2a4a';
const BEIGE = '#f5f0e0';

export const INITIAL_JIG_MAP_DATA: JigMapData = {
    imageUrl: null,
    locations: [
        /* ===== Labels (Aisles / Annotations) ===== */
        { address: "空き\n台車", type: "aisle", x: 1, y: 4, width: 7, height: 10, fontSize: 11 },
        { address: "通路", type: "aisle", x: 41, y: 30, width: 10, height: 14, fontSize: 20 },
        { address: "通路", type: "aisle", x: 0.5, y: 47, width: 7, height: 8, fontSize: 14 },
        { address: "窓", type: "aisle", x: 91, y: 47, width: 7, height: 8, fontSize: 14 },
        { address: "通路", type: "aisle", x: 18, y: 93, width: 12, height: 5, fontSize: 14 },
        { address: "通路", type: "aisle", x: 62, y: 89, width: 10, height: 5, fontSize: 14 },
        { address: "低頻度", type: "label", x: 89, y: 0.5, width: 10, height: 3, fontSize: 10 },
        { address: "高頻度", type: "label", x: 89, y: 95, width: 10, height: 3, fontSize: 10 },

        /* ===== Row 8 (Top - y: 3%) ===== */
        { address: "8B", type: "rack", backgroundColor: NAVY, x: 8, y: 3, width: 19, height: 7 },
        { address: "その他必要品", type: "rack", backgroundColor: BEIGE, x: 28, y: 3, width: 31, height: 7 },
        { address: "8A", type: "rack", backgroundColor: NAVY, x: 62, y: 3, width: 24, height: 7 },

        /* ===== Row 7 (y: 12%) ===== */
        { address: "7D", type: "rack", backgroundColor: NAVY, x: 8, y: 12, width: 17, height: 7 },
        { address: "7C", type: "rack", backgroundColor: NAVY, x: 27, y: 12, width: 12, height: 7 },
        { address: "7B", type: "rack", backgroundColor: NAVY, x: 52, y: 12, width: 11, height: 7 },
        { address: "7A", type: "rack", backgroundColor: NAVY, x: 64, y: 12, width: 22, height: 7 },

        /* ===== Row 6 (y: 25%) ===== */
        { address: "6E", type: "rack", backgroundColor: NAVY, x: 8, y: 25, width: 15, height: 7 },
        { address: "6D", type: "rack", backgroundColor: NAVY, x: 25, y: 25, width: 14, height: 7 },
        { address: "6C", type: "rack", backgroundColor: NAVY, x: 52, y: 25, width: 11, height: 7 },
        { address: "6B", type: "rack", backgroundColor: NAVY, x: 64, y: 25, width: 11, height: 7 },
        { address: "6A", type: "rack", backgroundColor: NAVY, x: 76, y: 25, width: 10, height: 7 },

        /* ===== Row 5 (y: 35%) - Left: 2-row split ===== */
        { address: "5I", type: "rack", backgroundColor: NAVY, x: 8, y: 35, width: 9, height: 3.8 },
        { address: "5F", type: "rack", backgroundColor: NAVY, x: 8, y: 39.2, width: 9, height: 3.8 },
        { address: "5H", type: "rack", backgroundColor: NAVY, x: 18, y: 35, width: 9, height: 3.8 },
        { address: "5E", type: "rack", backgroundColor: NAVY, x: 18, y: 39.2, width: 9, height: 3.8 },
        { address: "5G", type: "rack", backgroundColor: NAVY, x: 28, y: 35, width: 11, height: 3.8 },
        { address: "5D", type: "rack", backgroundColor: NAVY, x: 28, y: 39.2, width: 11, height: 3.8 },
        { address: "5C", type: "rack", backgroundColor: NAVY, x: 52, y: 35, width: 11, height: 7.5 },
        { address: "5B", type: "rack", backgroundColor: NAVY, x: 64, y: 35, width: 11, height: 7.5 },
        { address: "5A", type: "rack", backgroundColor: NAVY, x: 76, y: 35, width: 10, height: 7.5 },

        /* ===== Row 4 (y: 46%) - Left: 2-row split, 4 columns ===== */
        { address: "4K", type: "rack", backgroundColor: NAVY, x: 8, y: 46, width: 7.5, height: 3.8 },
        { address: "4G", type: "rack", backgroundColor: NAVY, x: 8, y: 50.2, width: 7.5, height: 3.8 },
        { address: "4J", type: "rack", backgroundColor: NAVY, x: 16, y: 46, width: 7.5, height: 3.8 },
        { address: "4F", type: "rack", backgroundColor: NAVY, x: 16, y: 50.2, width: 7.5, height: 3.8 },
        { address: "4I", type: "rack", backgroundColor: NAVY, x: 24, y: 46, width: 7.5, height: 3.8 },
        { address: "4E", type: "rack", backgroundColor: NAVY, x: 24, y: 50.2, width: 7.5, height: 3.8 },
        { address: "4H", type: "rack", backgroundColor: NAVY, x: 32, y: 46, width: 7, height: 3.8 },
        { address: "4D", type: "rack", backgroundColor: NAVY, x: 32, y: 50.2, width: 7, height: 3.8 },
        { address: "4C", type: "rack", backgroundColor: NAVY, x: 52, y: 46, width: 11, height: 7.5 },
        { address: "4B", type: "rack", backgroundColor: NAVY, x: 64, y: 46, width: 11, height: 7.5 },
        { address: "4A", type: "rack", backgroundColor: NAVY, x: 76, y: 46, width: 10, height: 7.5 },

        /* ===== Row 3 (y: 57%) - Left: 2-row split ===== */
        { address: "3G", type: "rack", backgroundColor: NAVY, x: 8, y: 57, width: 14, height: 3.8 },
        { address: "3E", type: "rack", backgroundColor: NAVY, x: 8, y: 61.2, width: 14, height: 3.8 },
        { address: "3F", type: "rack", backgroundColor: NAVY, x: 25, y: 57, width: 14, height: 3.8 },
        { address: "3D", type: "rack", backgroundColor: NAVY, x: 25, y: 61.2, width: 14, height: 3.8 },
        { address: "3C", type: "rack", backgroundColor: NAVY, x: 52, y: 57.5, width: 11, height: 7.5 },
        { address: "3B", type: "rack", backgroundColor: NAVY, x: 64, y: 57.5, width: 11, height: 7.5 },
        { address: "3A", type: "rack", backgroundColor: NAVY, x: 76, y: 57.5, width: 10, height: 7.5 },

        /* ===== Row 2 (y: 68%) - Left: 2-row split, 3 columns ===== */
        { address: "2I", type: "rack", backgroundColor: NAVY, x: 8, y: 68, width: 9, height: 3.8 },
        { address: "2H", type: "rack", backgroundColor: NAVY, x: 18, y: 68, width: 9, height: 3.8 },
        { address: "2E", type: "rack", backgroundColor: NAVY, x: 18, y: 72.2, width: 9, height: 3.8 },
        { address: "2G", type: "rack", backgroundColor: NAVY, x: 28, y: 68, width: 11, height: 3.8 },
        { address: "2D", type: "rack", backgroundColor: NAVY, x: 28, y: 72.2, width: 11, height: 3.8 },
        { address: "2C", type: "rack", backgroundColor: NAVY, x: 52, y: 68.5, width: 11, height: 7.5 },
        { address: "2B", type: "rack", backgroundColor: NAVY, x: 64, y: 68.5, width: 11, height: 7.5 },
        { address: "2A", type: "rack", backgroundColor: NAVY, x: 76, y: 68.5, width: 10, height: 7.5 },

        /* ===== Row 1 (y: 79%) ===== */
        { address: "1E", type: "rack", backgroundColor: NAVY, x: 8, y: 79, width: 15, height: 7 },
        { address: "1D", type: "rack", backgroundColor: NAVY, x: 25, y: 79, width: 14, height: 7 },
        { address: "1C", type: "rack", backgroundColor: NAVY, x: 52, y: 79, width: 8.5, height: 7.5 },
        { address: "1B", type: "rack", backgroundColor: NAVY, x: 61, y: 79, width: 8.5, height: 7.5 },
        { address: "1A", type: "rack", backgroundColor: NAVY, x: 70, y: 79, width: 16, height: 7.5 },

        /* ===== Row 0 (Bottom - y: 91%) ===== */
        { address: "0C", type: "rack", backgroundColor: NAVY, x: 52, y: 93, width: 6, height: 3 },
        { address: "0B", type: "rack", backgroundColor: NAVY, x: 58.5, y: 93, width: 6, height: 3 },
        { address: "0A", type: "rack", backgroundColor: NAVY, x: 52, y: 96.5, width: 12.5, height: 3 },
        { address: "カート\n置き場", type: "rack", backgroundColor: BEIGE, x: 66, y: 93, width: 18, height: 6.5 },
    ]
};
