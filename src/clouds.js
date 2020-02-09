import {math} from './math.js';
import {voxels} from './voxels.js';


export const clouds = (function() {

  class CloudBlock {
    constructor(game) {
      this._game = game;
      this._mgr = new voxels.InstancedBlocksManager(this._game);
      this._CreateClouds();
    }

    _CreateClouds() {
      this._cells = {};

      for (let i = 0; i < 25; i++) {
        const x = Math.floor(math.rand_range(-1000, 1000));
        const z = Math.floor(math.rand_range(-1000, 1000));

        const num = math.rand_int(2, 5);
        for (let j = 0; j < num; j++) {
          const w = 128;
          const h = 128;
          const xi = Math.floor(math.rand_range(-w * 0.75, w * 0.75));
          const zi = Math.floor(math.rand_range(-h * 0.75, h * 0.75));

          const xPos = x + xi;
          const zPos = z + zi;

          const k = xPos + '.' + zPos;
          this._cells[k] = {
            position: [xPos, 200, zPos],
            type: 'cloud',
            visible: true
          }
        }
      }

      this._mgr.RebuildFromCellBlock(this._cells);
    }
  }

  class CloudManager {
    constructor(game) {
      this._game = game;
      this._Init();
    }

    _Init() {
      this._clouds = new CloudBlock(this._game);
    }

    Update(_) {
      const cameraPosition = this._game._graphics._camera.position;

      this._clouds._mgr._meshes['cloud'].position.x = cameraPosition.x;
      this._clouds._mgr._meshes['cloud'].position.z = cameraPosition.z;
    }
  }

  return {
    CloudManager: CloudManager
  };
})();
