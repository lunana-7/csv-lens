export const SAMPLE_CSV = [
  'Date,Channel,Product,Region,Units,Revenue',
  ...Array.from({ length: 72 }, (_, index) => {
    const products = ['Studio notebook', 'Everyday tote', 'Desk planner', 'Ceramic mug'];
    const channels = ['Online store', 'Retail', 'Wholesale'];
    const regions = ['North', 'West', 'East', 'South'];
    const units = 3 + ((index * 7) % 23);
    const price = [18, 32, 24, 16][index % 4];
    const day = String(1 + Math.floor(index / 3)).padStart(2, '0');
    return `2026-10-${day},${channels[index % 3]},${products[index % 4]},${regions[Math.floor(index / 3) % 4]},${units},${(units * price).toFixed(2)}`;
  }),
].join('\n');
