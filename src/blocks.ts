export const CHUNK_SIZE = 16;
export const WORLD_RADIUS = 4;
export const WORLD_HEIGHT = 36;
export const WATER_LEVEL = 9;

export const enum Block {
  Air,
  Grass,
  Dirt,
  Stone,
  Sand,
  Water,
  Log,
  Leaves,
  Planks,
  Brick,
  Glass,
  Flowers,
}

export const BLOCKS = [
  { id: Block.Grass, name: '草方块', color: '#71ad56' },
  { id: Block.Dirt, name: '泥土', color: '#8c6044' },
  { id: Block.Stone, name: '石头', color: '#89949a' },
  { id: Block.Sand, name: '沙子', color: '#dfc988' },
  { id: Block.Water, name: '水', color: '#5faece' },
  { id: Block.Log, name: '原木', color: '#aa7b4a' },
  { id: Block.Leaves, name: '树叶', color: '#588d51' },
  { id: Block.Planks, name: '木板', color: '#b89563' },
  { id: Block.Brick, name: '砖块', color: '#b26f59' },
  { id: Block.Glass, name: '玻璃', color: '#b7dee0' },
  { id: Block.Flowers, name: '花砖', color: '#d99587' },
] as const;

export const SOLID = (block: Block) => block !== Block.Air && block !== Block.Water;
export const key3 = (x: number, y: number, z: number) => `${x},${y},${z}`;
export const inWorld = (x: number, z: number) => x >= -WORLD_RADIUS * CHUNK_SIZE && x < WORLD_RADIUS * CHUNK_SIZE && z >= -WORLD_RADIUS * CHUNK_SIZE && z < WORLD_RADIUS * CHUNK_SIZE;
