export interface JigLocation {
    address: string; // 治具番地 (e.g. "A-1-1")
    x: number; // Top-Left X %
    y: number; // Top-Left Y %
    width: number; // Width %
    height: number; // Height %
    backgroundColor?: string; // Optional custom fill color
    type?: 'rack' | 'aisle' | 'label'; // Type of item
    fontSize?: number; // Optional font size for labels
}

export interface JigMapData {
    imageUrl: string | null;
    locations: JigLocation[];
}
