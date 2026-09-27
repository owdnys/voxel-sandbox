import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
import { Block } from './blocks';

export const TILE_COUNT = 16;
const TILE_SIZE = 16;
const atlas = document.createElement('canvas');
atlas.width = TILE_COUNT * TILE_SIZE;
atlas.height = TILE_SIZE;
const ctx = atlas.getContext('2d')!;

const colors: Record<number, [string, string, string]> = {
  0: ['#74af55', '#589443', '#97c96b'], // grass top
  1: ['#896044', '#714b37', '#a07854'], // dirt
  2: ['#999d9a', '#7f8583', '#b2b7b1'], // stone
  3: ['#e4d39b', '#d4be7e', '#f3e3b1'], // sand
  4: ['#5daac8', '#4b98ba', '#81c6d8'], // water
  5: ['#96704a', '#795636', '#bb9461'], // log side
  6: ['#5e9954', '#427c43', '#7fb36b'], // leaves
  7: ['#bc9766', '#a88053', '#d1ae7b'], // planks
  8: ['#ae705c', '#945844', '#ce9178'], // brick
  9: ['#badadd', '#95c8d1', '#e4f3e9'], // glass
  10: ['#8a6448', '#705039', '#ad8058'], // grass side
  11: ['#b28a58', '#866640', '#d2a976'], // log top
  12: ['#dac6ac', '#c58d7d', '#efdebe'], // flowers
};

function rand(x: number, y: number, seed: number) {
  let h = Math.imul(x + seed * 317, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

for (const [indexString, palette] of Object.entries(colors)) {
  const index = Number(indexString);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const r = rand(x, y, index);
      ctx.fillStyle = palette[r < 0.15 ? 1 : r > 0.82 ? 2 : 0];
      ctx.fillRect(index * TILE_SIZE + x, y, 1, 1);
    }
  }
  if (index === 10) {
    ctx.fillStyle = '#6ca64e';
    for (let x = 0; x < TILE_SIZE; x++) ctx.fillRect(index * TILE_SIZE + x, 0, 1, 2 + Math.floor(rand(x, 13, 2) * 3));
  }
  if (index === 5 || index === 7) {
    ctx.fillStyle = '#6e4d37';
    for (let y = 4; y < TILE_SIZE; y += 5) ctx.fillRect(index * TILE_SIZE, y, TILE_SIZE, 1);
  }
  if (index === 8) {
    ctx.fillStyle = '#e1b396';
    for (let y = 4; y < TILE_SIZE; y += 6) {
      ctx.fillRect(index * TILE_SIZE, y, TILE_SIZE, 1);
      ctx.fillRect(index * TILE_SIZE + ((y / 6) % 2 ? 4 : 11), y - 5, 1, 5);
    }
  }
  if (index === 11) {
    ctx.strokeStyle = '#624931';
    ctx.strokeRect(index * TILE_SIZE + 3.5, 3.5, 9, 9);
    ctx.strokeRect(index * TILE_SIZE + 6.5, 6.5, 3, 3);
  }
  if (index === 9) {
    ctx.fillStyle = '#ecf8ef';
    ctx.fillRect(index * TILE_SIZE + 2, 2, 2, 10);
    ctx.fillRect(index * TILE_SIZE + 4, 2, 7, 2);
  }
  if (index === 12) {
    ctx.fillStyle = '#d67671';
    ctx.fillRect(index * TILE_SIZE + 5, 5, 6, 6);
    ctx.fillStyle = '#f2d486';
    ctx.fillRect(index * TILE_SIZE + 7, 7, 2, 2);
  }
}

export const texture = new CanvasTexture(atlas);
texture.magFilter = NearestFilter;
texture.minFilter = NearestFilter;
texture.colorSpace = SRGBColorSpace;

export function tileFor(block: Block, face: number): number {
  if (block === Block.Grass) return face === 2 ? 0 : face === 3 ? 1 : 10;
  if (block === Block.Log) return face === 2 || face === 3 ? 11 : 5;
  return ({ [Block.Dirt]: 1, [Block.Stone]: 2, [Block.Sand]: 3, [Block.Water]: 4,
    [Block.Leaves]: 6, [Block.Planks]: 7, [Block.Brick]: 8, [Block.Glass]: 9, [Block.Flowers]: 12 } as Record<number, number>)[block] ?? 0;
}

export function swatch(block: Block): string {
  const tile = tileFor(block, 2);
  const icon = document.createElement('canvas');
  icon.width = icon.height = TILE_SIZE;
  icon.getContext('2d')!.drawImage(atlas, tile * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  return icon.toDataURL();
}
