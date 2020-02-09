import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.112.1/build/three.module.js';
import 'https://cdn.jsdelivr.net/npm/simplex-noise@2.4.0/simplex-noise.js';
import {BufferGeometryUtils} from 'https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/utils/BufferGeometryUtils.js';
import {math} from './math.js';
import {utils} from './utils.js';
import {voxels_shader} from './voxels_shader.js';
import {voxels_tool} from './voxels_tool.js';


export const voxels = (function() {

  const _VOXEL_HEIGHT = 128;
  const _OCEAN_LEVEL = Math.floor(_VOXEL_HEIGHT * 0.12);
  const _BEACH_LEVEL = _OCEAN_LEVEL + 2;
  const _SNOW_LEVEL = Math.floor(_VOXEL_HEIGHT * 0.8);
  const _MOUNTAIN_LEVEL = Math.floor(_VOXEL_HEIGHT * 0.5);

  // HACKY TODO: Pass a terrain generation object through instead of these
  // loose functions.
  const _N1 = new SimplexNoise(2);
  const _N2 = new SimplexNoise(3);
  const _N3 = new SimplexNoise(4);
  function _SimplexNoise(gen, nx, ny){
    return gen.noise2D(nx, ny) * 0.5 + 0.5;
  }

  function Noise(gen, x, y, sc, octaves, persistence, exponentiation) {
    const xs = x / sc;
    const ys = y / sc;
    let amplitude = 1.0;
    let frequency = 1.0;
    let normalization = 0;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      total += _SimplexNoise(gen, xs * frequency, ys * frequency) * amplitude;
      normalization += amplitude;
      amplitude *= persistence;
      frequency *= 2.0;
    }
    total /= normalization;
    return Math.pow(total, exponentiation);
  }

  function Biome(e, m) {
    if (e < _OCEAN_LEVEL) return 'ocean';
    if (e < _BEACH_LEVEL) return 'sand';

    if (e > _SNOW_LEVEL) {
      return 'snow';
    }

    if (e > _MOUNTAIN_LEVEL) {
      if (m < 0.1) {
        return 'stone';
      } else if (m < 0.25) {
        return 'hills';
      }
    }

    // if (m < 0.1) {
    //   return 'desert';
    // }

    return 'grass';
  }

  class InstancedBlocksManager {
    constructor(game, cell) {
      this._game = game;
      this._geometryBuffers = {};
      this._meshes = {};
      this._materials = {};
      this._Create(game);
    }

    _Create(game) {
      const pxGeometry = new THREE.PlaneBufferGeometry(1, 1);
      pxGeometry.rotateY(Math.PI / 2);
      pxGeometry.translate(0.5, 0, 0);

      const nxGeometry = new THREE.PlaneBufferGeometry(1, 1);
      nxGeometry.rotateY(-Math.PI / 2);
      nxGeometry.translate(-0.5, 0, 0);

      const pyGeometry = new THREE.PlaneBufferGeometry(1, 1);
      pyGeometry.attributes.uv.array[5] = 3.0 / 4.0;
      pyGeometry.attributes.uv.array[7] = 3.0 / 4.0;
      pyGeometry.attributes.uv.array[1] = 4.0 / 4.0;
      pyGeometry.attributes.uv.array[3] = 4.0 / 4.0;
      pyGeometry.rotateX(-Math.PI / 2);
      pyGeometry.translate(0, 0.5, 0);

      const nyGeometry = new THREE.PlaneBufferGeometry(1, 1);
      nyGeometry.attributes.uv.array[5] = 1.0 / 4.0;
      nyGeometry.attributes.uv.array[7] = 1.0 / 4.0;
      nyGeometry.attributes.uv.array[1] = 2.0 / 4.0;
      nyGeometry.attributes.uv.array[3] = 2.0 / 4.0;
      nyGeometry.rotateX(Math.PI / 2);
      nyGeometry.translate(0, -0.5, 0);

      const pzGeometry = new THREE.PlaneBufferGeometry(1, 1);
      pzGeometry.translate(0, 0, 0.5);

      const nzGeometry = new THREE.PlaneBufferGeometry(1, 1);
      nzGeometry.rotateY( Math.PI );
      nzGeometry.translate(0, 0, -0.5);

      const flipGeometries = [
        pxGeometry, nxGeometry, pzGeometry, nzGeometry
      ];

      for (let g of flipGeometries) {
        g.attributes.uv.array[5] = 2.0 / 4.0;
        g.attributes.uv.array[7] = 2.0 / 4.0;
        g.attributes.uv.array[1] = 3.0 / 4.0;
        g.attributes.uv.array[3] = 3.0 / 4.0;
      }

      this._geometries = [
        pxGeometry, nxGeometry,
        pyGeometry, nyGeometry,
        pzGeometry, nzGeometry
      ];

      this._geometries = {
        cube: BufferGeometryUtils.mergeBufferGeometries(this._geometries),
        plane: pyGeometry,
      };
    }

    RebuildFromCellBlock(cells) {
      const cellsOfType = {};

      for (let k in cells) {
        const c = cells[k];
        if (!(c.type in cellsOfType)) {
          cellsOfType[c.type] = [];
        }
        if (c.visible) {
          cellsOfType[c.type].push(c);
        }
      }

      for (let k in cellsOfType) {
        this._RebuildFromCellType(cellsOfType[k], k);
      }

      for (let k in this._geometryBuffers) {
        if (!(k in cellsOfType)) {
          this._RebuildFromCellType([], k);
        }
      }
    }

    _GetBaseGeometryForCellType(cellType) {
      if (cellType == 'water') {
        return this._geometries.plane;
      }
      return this._geometries.cube;
    }

    _RebuildFromCellType(cells, cellType) {
      const textureInfo = this._game._atlas.Info[cellType];

      if (!(cellType in this._geometryBuffers)) {
        this._geometryBuffers[cellType] = new THREE.InstancedBufferGeometry();

        this._materials[cellType] = new THREE.RawShaderMaterial({
          uniforms: {
            diffuseTexture: {
              value: textureInfo.texture
            },
            skybox: {
              value: this._game._graphics._scene.background
            },
            fogDensity: {
              value:  0.005
            },
            cloudScale: {
              value: [1, 1, 1]
            }
          },
          vertexShader: voxels_shader.VS,
          fragmentShader: voxels_shader.PS,
          side: THREE.FrontSide
        });

        // HACKY: Need to have some sort of material manager and pass
        // these params.
        if (cellType == 'water') {
          this._materials[cellType].blending = THREE.NormalBlending;
          this._materials[cellType].depthWrite = false;
          this._materials[cellType].depthTest = true;
          this._materials[cellType].transparent = true;
        }

        if (cellType == 'cloud') {
          this._materials[cellType].uniforms.fogDensity.value = 0.001;
          this._materials[cellType].uniforms.cloudScale.value = [64, 10, 64];
        }

        this._meshes[cellType] = new THREE.Mesh(
            this._geometryBuffers[cellType], this._materials[cellType]);
        this._game._graphics._scene.add(this._meshes[cellType]);
      }

      this._geometryBuffers[cellType].maxInstancedCount = cells.length;

      const baseGeometry = this._GetBaseGeometryForCellType(cellType);

      this._geometryBuffers[cellType].setAttribute(
          'position', new THREE.Float32BufferAttribute(
              [...baseGeometry.attributes.position.array], 3));
      this._geometryBuffers[cellType].setAttribute(
          'uv', new THREE.Float32BufferAttribute(
              [...baseGeometry.attributes.uv.array], 2));
      this._geometryBuffers[cellType].setAttribute(
          'normal', new THREE.Float32BufferAttribute(
              [...baseGeometry.attributes.normal.array], 3));
      this._geometryBuffers[cellType].setIndex(
          new THREE.BufferAttribute(
              new Uint32Array([...baseGeometry.index.array]), 1));

      const offsets = [];
      const uvOffsets = [];
      const colors = [];

      const box = new THREE.Box3();

      for (let c in cells) {
        const curCell = cells[c];

        let randomLuminance = Noise(
            _N2, curCell.position[0], curCell.position[2], 16, 8, 0.6, 2) * 0.2 + 0.8;
        if (curCell.luminance !== undefined) {
          randomLuminance = curCell.luminance;
        } else if (cellType == 'cloud') {
          randomLuminance = 1;
        }

        const colour = textureInfo.colourRange[0].clone();
        colour.r *= randomLuminance;
        colour.g *= randomLuminance;
        colour.b *= randomLuminance;

        colors.push(colour.r, colour.g, colour.b);
        offsets.push(...curCell.position);
        uvOffsets.push(...textureInfo.uvOffset);
        box.expandByPoint(new THREE.Vector3(
            curCell.position[0],
            curCell.position[1],
            curCell.position[2]));
      }

      this._geometryBuffers[cellType].setAttribute(
          'color', new THREE.InstancedBufferAttribute(
              new Float32Array(colors), 3));
      this._geometryBuffers[cellType].setAttribute(
          'offset', new THREE.InstancedBufferAttribute(
              new Float32Array(offsets), 3));
      this._geometryBuffers[cellType].setAttribute(
          'uvOffset', new THREE.InstancedBufferAttribute(
              new Float32Array(uvOffsets), 2));
      this._geometryBuffers[cellType].attributes.offset.needsUpdate = true;
      this._geometryBuffers[cellType].attributes.uvOffset.uvOffset = true;
      this._geometryBuffers[cellType].attributes.color.uvOffset = true;

      this._geometryBuffers[cellType].boundingBox = box;
      this._geometryBuffers[cellType].boundingSphere = new THREE.Sphere();
      box.getBoundingSphere(this._geometryBuffers[cellType].boundingSphere);
    }

    Update() {
    }
  };

  const _RAND_VALS = {};

  class SparseVoxelCellBlock {
    constructor(game, parent, offset, dimensions, id) {
      this._game = game;
      this._parent = parent;
      this._atlas = game._atlas;
      this._blockOffset = offset;
      this._blockDimensions = dimensions;
      this._mgr = new InstancedBlocksManager(this._game, this);
      this._id = id;

      this._Init();
    }

    get ID() {
      return this._id;
    }

    _GenerateNoise(x, y) {
      const elevation = Math.floor(Noise(_N1, x, y, 1024, 6, 0.4, 5.65) * 128);
      const moisture = Noise(_N2, x, y, 512, 6, 0.5, 4);

      return [Biome(elevation, moisture), elevation];
    }

    _Init() {
      this._cells = {};

      for (let x = 0; x < this._blockDimensions.x; x++) {
        for (let z = 0; z < this._blockDimensions.z; z++) {
          const xPos = x + this._blockOffset.x;
          const zPos = z + this._blockOffset.z;

          const [atlasType, yOffset] = this._GenerateNoise(xPos, zPos);

          this._cells[xPos + '.' + yOffset + '.' + zPos] = {
            position: [xPos, yOffset, zPos],
            type: atlasType,
            visible: true
          };

          if (atlasType == 'ocean') {
            this._cells[xPos + '.' + _OCEAN_LEVEL + '.' + zPos] = {
              position: [xPos, _OCEAN_LEVEL, zPos],
              type: 'water',
              visible: true
            };
          } else {
            // Possibly have to generate cliffs
            let lowestAdjacent = yOffset;
            for (let xi = -1; xi <= 1; xi++) {
              for (let zi = -1; zi <= 1; zi++) {
                const [_, otherOffset] = this._GenerateNoise(xPos + xi, zPos + zi);
                lowestAdjacent = Math.min(otherOffset, lowestAdjacent);
              }
            }

            if (lowestAdjacent < yOffset) {
              const heightDifference = yOffset - lowestAdjacent;
              for (let yi = lowestAdjacent + 1; yi < yOffset; yi++) {
                this._cells[xPos + '.' + yi + '.' + zPos] = {
                  position: [xPos, yi, zPos],
                  type: 'dirt',
                  visible: true
                };
              }
            }
          }
        }
      }

      this._GenerateTrees();
    }

    _GenerateTrees() {
      // This is terrible, but works fine for demo purposes. Just a straight up
      // grid of trees, with random removal/jittering.
      for (let x = 0; x < this._blockDimensions.x; x++) {
        for (let z = 0; z < this._blockDimensions.z; z++) {
          const xPos = this._blockOffset.x + x;
          const zPos = this._blockOffset.z + z;
          if (xPos % 11 != 0 || zPos % 11 != 0) {
            continue;
          }

          const roll = Math.random();
          if (roll < 0.35) {
            const xTreePos = xPos + math.rand_int(-3, 3);
            const zTreePos = zPos + math.rand_int(-3, 3);

            const [terrainType, _] = this._GenerateNoise(xTreePos, zTreePos);
            if (terrainType != 'grass') {
              continue;
            }

            this._MakeSpruceTree(xTreePos, zTreePos);
          }
        }
      }
    }

    HasVoxelAt(x, y, z) {
      const k = this._Key(x, y, z);
      if (!(k in this._cells)) {
        return false;
      }

      return this._cells[k].visible;
    }

    InsertVoxel(cellData, overwrite=true) {
      const k = this._Key(
          cellData.position[0],
          cellData.position[1],
          cellData.position[2]);
      if (!overwrite && k in this._cells) {
        return;
      }
      this._cells[k] = cellData;
      this._parent.MarkDirty(this);
    }

    RemoveVoxel(key) {
      const v = this._cells[key];
      this._cells[key].visible = false;

      this._parent.MarkDirty(this);

      // Probably better to just pregenerate these voxels, version 2 maybe.
      const [atlasType, groundLevel] = this._GenerateNoise(
          v.position[0], v.position[2]);

      if (v.position[1] <= groundLevel) {
        for (let xi = -1; xi <= 1; xi++) {
          for (let yi = -1; yi <= 1; yi++) {
            for (let zi = -1; zi <= 1; zi++) {
              const xPos = v.position[0] + xi;
              const zPos = v.position[2] + zi;
              const yPos = v.position[1] + yi;

              const [adjacentType, groundLevelAdjacent] = this._GenerateNoise(xPos, zPos);
              const k = this._Key(xPos, yPos, zPos);

              if (!(k in this._cells) && yPos < groundLevelAdjacent) {
                let type = 'dirt';

                if (adjacentType == 'sand') {
                  type = 'sand';
                }

                if (yPos < groundLevelAdjacent - 2) {
                  type = 'stone';
                }

                // This is potentially out of bounds of the cell, so route the
                // voxel insertion via parent.
                this._parent.InsertVoxel({
                  position: [xPos, yPos, zPos],
                  type: type,
                  visible: true
                }, false);
              }
            }
          }
        }
      }
    }

    Build() {
      this._mgr.RebuildFromCellBlock(this._cells);
    }

    _Key(x, y, z) {
      return x + '.' + y + '.' + z;
    }

    _MakeSpruceTree(x, z) {
      const [_, yOffset] = this._GenerateNoise(x, z);

      // TODO: Technically, inserting into cells can go outside the bounds
      // of an individual SparseVoxelCellBlock. These calls should be routed
      // to the parent.
      const treeHeight = math.rand_int(3, 5);
      for (let y = 1; y < treeHeight; y++) {
        const yPos = y + yOffset;
        const k = this._Key(x, yPos, z);
        this._cells[k] = {
          position: [x, yPos, z],
          type: 'log_spruce',
          visible: true
        };
      }

      for (let h = 0; h < 2; h++) {
        for (let xi = -2; xi <= 2; xi++) {
          for (let zi = -2; zi <= 2; zi++) {
            if (Math.abs(xi) == 2 && Math.abs(zi) == 2) {
              continue;
            }

            const yPos = yOffset + h + treeHeight;
            const xPos = x + xi;
            const zPos = z + zi;
            const k = xPos + '.' + yPos + '.' + zPos;
            this._cells[k] = {
              position: [xPos, yPos, zPos],
              type: 'leaves_spruce',
              visible: true
            };
          }
        }
      }

      for (let h = 0; h < 2; h++) {
        for (let xi = -1; xi <= 1; xi++) {
          for (let zi = -1; zi <= 1; zi++) {
            if (Math.abs(xi) == 1 && Math.abs(zi) == 1) {
              continue;
            }

            const yPos = yOffset + h + treeHeight + 2;
            const xPos = x + xi;
            const zPos = z + zi;
            const k = xPos + '.' + yPos + '.' + zPos;
            this._cells[k] = {
              position: [xPos, yPos, zPos],
              type: 'leaves_spruce',
              visible: true
            };
          }
        }
      }
    }

    AsVoxelArray(pos, radius) {
      const x = Math.floor(pos.x);
      const y = Math.floor(pos.y);
      const z = Math.floor(pos.z);

      const voxels = [];
      for (let xi = -radius; xi <= radius; xi++) {
        for (let yi = -radius; yi <= radius; yi++) {
          for (let zi = -radius; zi <= radius; zi++) {
            const xPos = xi + x;
            const yPos = yi + y;
            const zPos = zi + z;
            const k = xPos + '.' + yPos + '.' + zPos;
            if (k in this._cells) {
              const cell = this._cells[k];
              if (!cell.visible) {
                continue;
              }

              if (cell.blinker !== undefined) {
                continue;
              }

              const position = new THREE.Vector3(
                  cell.position[0], cell.position[1], cell.position[2]);
              const half = new THREE.Vector3(0.5, 0.5, 0.5);

              const m1 = new THREE.Vector3();
              m1.copy(position);
              m1.sub(half);

              const m2 = new THREE.Vector3();
              m2.copy(position);
              m2.add(half);

              const box = new THREE.Box3(m1, m2);
              const voxelData = {...cell};
              voxelData.aabb = box;
              voxelData.key = k;
              voxels.push(voxelData);
            }
          }
        }
      }

      return voxels;
    }

    AsBox3Array(pos, radius) {
      const x = Math.floor(pos.x);
      const y = Math.floor(pos.y);
      const z = Math.floor(pos.z);

      const boxes = [];
      for (let xi = -radius; xi <= radius; xi++) {
        for (let yi = -radius; yi <= radius; yi++) {
          for (let zi = -radius; zi <= radius; zi++) {
            const xPos = xi + x;
            const yPos = yi + y;
            const zPos = zi + z;
            const k = xPos + '.' + yPos + '.' + zPos;
            if (k in this._cells) {
              const cell = this._cells[k];
              if (!cell.visible) {
                continue;
              }

              const position = new THREE.Vector3(
                  cell.position[0], cell.position[1], cell.position[2]);
              const half = new THREE.Vector3(0.5, 0.5, 0.5);

              const m1 = new THREE.Vector3();
              m1.copy(position);
              m1.sub(half);

              const m2 = new THREE.Vector3();
              m2.copy(position);
              m2.add(half);

              const box = new THREE.Box3(m1, m2);
              boxes.push(box);
            }
          }
        }
      }

      return boxes;
    }
  };

  class SparseVoxelCellManager {
    constructor(game) {
      this._game = game;
      this._cells = {};
      this._cellDimensions = new THREE.Vector3(32, 32, 32);
      this._visibleDimensions = [32, 32];
      this._dirtyBlocks = {};
      this._ids = 0;

      this._tools = [
        null,
        new voxels_tool.InsertTool(this),
        new voxels_tool.DeleteTool(this),
      ];
      this._activeTool = 0;
    }

    _Key(x, y, z) {
      return x + '.' + y + '.' + z;
    }

    _CellIndex(xp, yp) {
      const x = Math.floor(xp / this._cellDimensions.x);
      const z = Math.floor(yp / this._cellDimensions.z);
      return [x, z];
    }

    MarkDirty(block) {
      this._dirtyBlocks[block.ID] = block;
    }

    InsertVoxel(cellData, overwrite=true) {
      const [x, z] = this._CellIndex(cellData.position[0], cellData.position[2]);
      const key = this._Key(x, 0, z);

      if (key in this._cells) {
        this._cells[key].InsertVoxel(cellData, overwrite);
      }
    }

    _FindIntersections(ray, maxDistance) {
      const camera = this._game._graphics._camera;
      const cells = this.LookupCells(camera.position, maxDistance);
      const intersections = [];

      for (let c of cells) {
        const voxels = c.AsVoxelArray(camera.position, maxDistance);

        for (let v of voxels) {
          const intersectionPoint = new THREE.Vector3();

          if (ray.intersectBox(v.aabb, intersectionPoint)) {
            intersections.push({
                cell: c,
                voxel: v,
                intersectionPoint: intersectionPoint,
                distance: intersectionPoint.distanceTo(camera.position)
            });
          }
        }
      }

      intersections.sort((a, b) => {
        const d1 = a.intersectionPoint.distanceTo(camera.position);
        const d2 = b.intersectionPoint.distanceTo(camera.position);
        if (d1 < d2) {
          return -1;
        } else if (d2 < d1) {
          return 1;
        } else {
          return 0;
        }
      });

      return intersections;
    }

    ChangeActiveTool(dir) {
      if (this._tools[this._activeTool]) {
        this._tools[this._activeTool].LoseFocus();
      }

      this._activeTool += dir + this._tools.length;
      this._activeTool %= this._tools.length;
    }

    PerformAction() {
      if (this._tools[this._activeTool]) {
        this._tools[this._activeTool].PerformAction();
      }
    }

    LookupCells(pos, radius) {
      // TODO only lookup really close by
      const [x, z] = this._CellIndex(pos.x, pos.z);

      const cells = [];
      for (let xi = -1; xi <= 1; xi++) {
        for (let zi = -1; zi <= 1; zi++) {
          const key = this._Key(x + xi, 0, z + zi);
          if (key in this._cells) {
            cells.push(this._cells[key]);
          }
        }
      }

      return cells;
    }

    Update(timeInSeconds) {
      if (this._tools[this._activeTool]) {
        this._tools[this._activeTool].Update(timeInSeconds);
      }

      this._UpdateDirtyBlocks();
      this._UpdateTerrain();
    }

    _UpdateDirtyBlocks() {
      for (let k in this._dirtyBlocks) {
        const b = this._dirtyBlocks[k];
        b.Build();
        delete this._dirtyBlocks[k];
        break;
      }
    }

    _UpdateTerrain() {
      const cameraPosition = this._game._graphics._camera.position;
      const cellIndex = this._CellIndex(cameraPosition.x, cameraPosition.z);

      const xs = Math.floor((this._visibleDimensions[0] - 1 ) / 2);
      const zs = Math.floor((this._visibleDimensions[1] - 1) / 2);
      let cells = {};

      for (let x = -xs; x <= xs; x++) {
        for (let z = -zs; z <= zs; z++) {
          const xi = x + cellIndex[0];
          const zi = z + cellIndex[1];

          const key = this._Key(xi, 0, zi);
          cells[key] = [xi, zi];
        }
      }

      const intersection = utils.DictIntersection(this._cells, cells);
      const difference = utils.DictDifference(cells, this._cells);
      const recycle = Object.values(utils.DictDifference(this._cells, cells));

      cells = intersection;

      for (let k in difference) {
        const [xi, zi] = difference[k];
        const offset = new THREE.Vector3(
            xi * this._cellDimensions.x, 0, zi * this._cellDimensions.z);

        let block = recycle.pop();
        if (block) {
          // TODO MAKE PUBLIC API
          block._blockOffset = offset;
          block._Init();
        } else {
          block = new voxels.SparseVoxelCellBlock(
              this._game, this, offset, this._cellDimensions, this._ids++);
        }

        this.MarkDirty(block);

        cells[k] = block;
      }

      this._cells = cells;
    }
  }

  return {
    InstancedBlocksManager: InstancedBlocksManager,
    SparseVoxelCellBlock: SparseVoxelCellBlock,
    SparseVoxelCellManager: SparseVoxelCellManager,
  };
})();
