import alea from 'alea';
import { createNoise2D } from 'simplex-noise';
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshLambertMaterial } from 'three';
import { Block, CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, WORLD_RADIUS, inWorld, key3 } from './blocks';
import { texture, tileFor, TILE_COUNT } from './textures';

export type Vec3 = [number, number, number];
export interface SaveData { seed: string; position: Vec3; edits: Record<string, Block>; hotbar: Block[]; sensitivity: number; view: number }
const STORAGE_KEY = 'block-wander-save-v1';
export const defaultHotbar: Block[] = [Block.Grass, Block.Dirt, Block.Stone, Block.Sand, Block.Log, Block.Leaves, Block.Planks, Block.Brick, Block.Glass];
export function readSave(): SaveData | null {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as SaveData | null;
    if (!data || typeof data.seed !== 'string' || !Array.isArray(data.position) || !data.edits || typeof data.edits !== 'object') return null;
    return data;
  } catch { return null; }
}
export function writeSave(data: SaveData) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* Storage can be disabled. */ } }
export function clearSave() { localStorage.removeItem(STORAGE_KEY); }

type Chunk = { blocks: Uint8Array; solid?: Mesh; water?: Mesh };
const idx = (x: number, y: number, z: number) => y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
const dirs: { normal: Vec3; corners: Vec3[]; shade: number }[] = [
  { normal: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], shade: .8 },
  { normal: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], shade: .8 },
  { normal: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade: 1 },
  { normal: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade: .6 },
  { normal: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], shade: .89 },
  { normal: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], shade: .89 },
];
const solidMaterial = new MeshLambertMaterial({ map: texture, vertexColors: true, side: DoubleSide });
const waterMaterial = new MeshLambertMaterial({ map: texture, vertexColors: true, transparent: true, opacity: .66, depthWrite: false, side: DoubleSide });

export class World {
  readonly group = new Group();
  readonly edits: Record<string, Block>;
  private chunks = new Map<string, Chunk>();
  private noise: ReturnType<typeof createNoise2D>;
  private forest: ReturnType<typeof createNoise2D>;
  private treeSeed: number;
  private visible = new Set<string>();
  private queue: string[] = [];
  private lastCenter = '';
  private currentView = 0;
  constructor(readonly seed: string, edits: Record<string, Block> = {}) {
    this.edits = edits;
    this.noise = createNoise2D(alea(seed));
    this.forest = createNoise2D(alea(`${seed}-trees`));
    this.treeSeed = Math.floor(alea(`${seed}-placement`)() * 2147483647);
  }
  height(x: number, z: number): number {
    const n = this.noise(x * .015, z * .015) * 6 + this.noise(x * .055, z * .055) * 2.7 + this.noise(x * .13, z * .13) * .8;
    return Math.max(4, Math.min(23, Math.floor(11 + n)));
  }
  private tree(x: number, z: number): boolean {
    if (Math.abs(x) < 6 && Math.abs(z) < 6) return false;
    if (this.height(x, z) <= WATER_LEVEL + 1) return false;
    let hash = Math.imul(Math.floor(x / 7), 73856093) ^ Math.imul(Math.floor(z / 7), 19349663) ^ this.treeSeed;
    hash = Math.imul(hash ^ (hash >>> 16), 2246822519);
    return (hash >>> 0) / 4294967295 < .22 && this.forest(x * .026, z * .026) > -.45;
  }
  private generate(cx: number, cz: number): Chunk {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;
    for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const yTop = this.height(ox + x, oz + z);
      for (let y = 0; y <= Math.max(yTop, WATER_LEVEL); y++) {
        const b = y > yTop ? Block.Water : y === yTop ? (yTop <= WATER_LEVEL + 1 ? Block.Sand : Block.Grass) : y >= yTop - 2 ? Block.Dirt : Block.Stone;
        blocks[idx(x, y, z)] = b;
      }
    }
    // Trees originate on a coarse lattice so their canopies also cross chunk borders deterministically.
    for (let tz = Math.floor((oz - 3) / 7); tz <= Math.floor((oz + CHUNK_SIZE + 2) / 7); tz++) {
      for (let tx = Math.floor((ox - 3) / 7); tx <= Math.floor((ox + CHUNK_SIZE + 2) / 7); tx++) {
        const x = tx * 7 + 3, z = tz * 7 + 3;
        if (!inWorld(x, z) || !this.tree(x, z)) continue;
        const base = this.height(x, z);
        const set = (wx: number, y: number, wz: number, b: Block) => {
          const lx = wx - ox, lz = wz - oz;
          if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT) blocks[idx(lx, y, lz)] = b;
        };
        for (let y = base + 1; y <= base + 4; y++) set(x, y, z, Block.Log);
        for (let dy = 3; dy <= 5; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dz) > (dy === 5 ? 2 : 3)) continue;
          const lx = x + dx - ox, lz = z + dz - oz, y = base + dy;
          if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && y < WORLD_HEIGHT && blocks[idx(lx, y, lz)] === Block.Air) set(x + dx, y, z + dz, Block.Leaves);
        }
      }
    }
    for (const [key, block] of Object.entries(this.edits)) {
      const [x, y, z] = key.split(',').map(Number);
      if (Math.floor(x / CHUNK_SIZE) === cx && Math.floor(z / CHUNK_SIZE) === cz && y >= 0 && y < WORLD_HEIGHT) blocks[idx(x - ox, y, z - oz)] = block;
    }
    return { blocks };
  }
  private chunk(cx: number, cz: number): Chunk {
    const key = `${cx},${cz}`;
    let chunk = this.chunks.get(key);
    if (!chunk) { chunk = this.generate(cx, cz); this.chunks.set(key, chunk); }
    return chunk;
  }
  get(x: number, y: number, z: number): Block {
    if (!inWorld(x, z) || y < 0 || y >= WORLD_HEIGHT) return Block.Air;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    return this.chunk(cx, cz).blocks[idx(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)] as Block;
  }
  set(x: number, y: number, z: number, block: Block) {
    if (!inWorld(x, z) || y < 1 || y >= WORLD_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunk(cx, cz);
    const index = idx(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
    if (chunk.blocks[index] === block) return false;
    chunk.blocks[index] = block;
    this.edits[key3(x, y, z)] = block;
    this.rebuild(cx, cz);
    if (x % CHUNK_SIZE === 0) this.rebuild(cx - 1, cz);
    if (((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE === CHUNK_SIZE - 1) this.rebuild(cx + 1, cz);
    if (z % CHUNK_SIZE === 0) this.rebuild(cx, cz - 1);
    if (((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE === CHUNK_SIZE - 1) this.rebuild(cx, cz + 1);
    return true;
  }
  private rebuild(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    if (!this.visible.has(key)) return;
    const chunk = this.chunk(cx, cz);
    for (const old of [chunk.solid, chunk.water]) { if (old) { this.group.remove(old); old.geometry.dispose(); } }
    chunk.solid = this.mesh(cx, cz, false);
    chunk.water = this.mesh(cx, cz, true);
    if (chunk.solid) this.group.add(chunk.solid);
    if (chunk.water) this.group.add(chunk.water);
  }
  private mesh(cx: number, cz: number, liquid: boolean): Mesh | undefined {
    const chunk = this.chunk(cx, cz);
    const positions: number[] = [], uvs: number[] = [], colors: number[] = [];
    const uvCorners: [number, number][] = [[0,1],[0,0],[1,0],[1,1]];
    const quad = [0,1,2,0,2,3];
    for (let y = 0; y < WORLD_HEIGHT; y++) for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const block = chunk.blocks[idx(x, y, z)] as Block;
      if (!block || (block === Block.Water) !== liquid) continue;
      const wx = cx * CHUNK_SIZE + x, wz = cz * CHUNK_SIZE + z;
      for (let face = 0; face < 6; face++) {
        const dir = dirs[face];
        const adjacent = this.get(wx + dir.normal[0], y + dir.normal[1], wz + dir.normal[2]);
        if (liquid ? adjacent !== Block.Air : adjacent !== Block.Air && adjacent !== Block.Water && adjacent !== Block.Glass && adjacent !== Block.Leaves) {
          if (!(block === Block.Glass && adjacent !== Block.Glass) && !(block === Block.Leaves && adjacent !== Block.Leaves)) continue;
        }
        if (!liquid && block === Block.Glass && adjacent === Block.Glass) continue;
        if (!liquid && block === Block.Leaves && adjacent === Block.Leaves) continue;
        const tile = tileFor(block, face);
        const inset = .001 / TILE_COUNT;
        const u0 = tile / TILE_COUNT + inset, u1 = (tile + 1) / TILE_COUNT - inset;
        for (const i of quad) {
          const corner = dir.corners[i], uv = uvCorners[i];
          positions.push(wx + corner[0], y + corner[1] - (liquid ? .12 : 0), wz + corner[2]);
          uvs.push(uv[0] ? u1 : u0, uv[1] ? .999 : .001);
          colors.push(dir.shade, dir.shade, dir.shade);
        }
      }
    }
    if (!positions.length) return undefined;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    geometry.computeVertexNormals();
    return new Mesh(geometry, liquid ? waterMaterial : solidMaterial);
  }
  update(px: number, pz: number, view: number) {
    const cx = Math.floor(px / CHUNK_SIZE), cz = Math.floor(pz / CHUNK_SIZE);
    const center = `${cx},${cz}`;
    if (center === this.lastCenter && view === this.currentView) return;
    this.lastCenter = center;
    this.currentView = view;
    const next = new Set<string>();
    const coords: [number, number, number][] = [];
    for (let dz = -view; dz <= view; dz++) for (let dx = -view; dx <= view; dx++) {
      const x = cx + dx, z = cz + dz;
      if (x < -WORLD_RADIUS || x >= WORLD_RADIUS || z < -WORLD_RADIUS || z >= WORLD_RADIUS || dx * dx + dz * dz > (view + .45) ** 2) continue;
      const key = `${x},${z}`;
      next.add(key);
      coords.push([x, z, dx * dx + dz * dz]);
    }
    for (const key of this.visible) if (!next.has(key)) {
      const chunk = this.chunks.get(key);
      if (chunk) for (const mesh of [chunk.solid, chunk.water]) if (mesh) this.group.remove(mesh);
    }
    this.queue = [];
    this.visible = next;
    coords.sort((a, b) => a[2] - b[2]);
    for (const [x, z] of coords) {
      const key = `${x},${z}`;
      const chunk = this.chunks.get(key);
      if (chunk?.solid) {
        if (!chunk.solid.parent) this.group.add(chunk.solid);
        if (chunk.water && !chunk.water.parent) this.group.add(chunk.water);
      } else this.queue.push(key);
    }
  }
  buildNext(count = 2) {
    for (let i = 0; i < count && this.queue.length; i++) {
      const [x, z] = this.queue.shift()!.split(',').map(Number);
      this.rebuild(x, z);
    }
  }
  get pending() { return this.queue.length; }
  spawn(): Vec3 {
    let best: Vec3 = [.5, this.height(0, 0) + 2.65, .5];
    let bestScore = -Infinity;
    for (let z = -17; z <= 17; z += 2) for (let x = -17; x <= 17; x += 2) {
      const ground = this.height(x, z);
      if (ground < WATER_LEVEL + 2) continue;
      if ([1, 2, 3, 4, 5].some(dy => this.get(x, ground + dy, z) !== Block.Air)) continue;
      let slope = 0, nearbyTrees = 0, open = 0;
      for (let dz = -4; dz <= 4; dz += 2) for (let dx = -4; dx <= 4; dx += 2) {
        slope += Math.max(0, this.height(x + dx, z + dz) - ground);
      }
      for (let tz = Math.floor((z - 5) / 7); tz <= Math.floor((z + 5) / 7); tz++)
        for (let tx = Math.floor((x - 5) / 7); tx <= Math.floor((x + 5) / 7); tx++) {
          const treeX = tx * 7 + 3, treeZ = tz * 7 + 3;
          if (this.tree(treeX, treeZ) && Math.abs(treeX - x) <= 4 && Math.abs(treeZ - z) <= 4) nearbyTrees++;
        }
      for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        for (let step = 2; step <= 12; step += 2) open += Math.max(-3, Math.min(2, ground - this.height(x + dx * step, z + dz * step)));
      }
      const score = open * .4 - slope * 2 - nearbyTrees * 24 - Math.hypot(x, z) * .12;
      if (score > bestScore) { bestScore = score; best = [x + .5, ground + 2.65, z + .5]; }
    }
    return best;
  }
}
