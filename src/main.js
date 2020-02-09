import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.112.1/build/three.module.js';
import 'https://cdn.jsdelivr.net/npm/simplex-noise@2.4.0/simplex-noise.js';
import {clouds} from './clouds.js';
import {controls} from './controls.js';
import {game} from './game.js';
import {graphics} from './graphics.js';
import {math} from './math.js';
import {textures} from './textures.js';
import {voxels} from './voxels.js';


let _APP = null;


class SimonDevCraft extends game.Game {
  constructor() {
    super();
  }

  _OnInitialize() {
    this._entities = {};

    this._LoadBackground();

    this._atlas = new textures.TextureAtlas(this);
    this._atlas.onLoad = () => {
      this._entities['_voxels'] = new voxels.SparseVoxelCellManager(this);
      this._entities['_clouds'] = new clouds.CloudManager(this);
      this._entities['_controls'] = new controls.FPSControls(
          {
            cells: this._entities['_voxels'],
            scene: this._graphics.Scene,
            camera: this._graphics.Camera
          });
    };
  }

  _LoadBackground() {
    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        './resources/posx.jpg',
        './resources/posx.jpg',
        './resources/posy.jpg',
        './resources/negy.jpg',
        './resources/posx.jpg',
        './resources/posx.jpg',
    ]);
    this._graphics.Scene.background = texture;
  }

  _OnStep(timeInSeconds) {
    timeInSeconds = Math.min(timeInSeconds, 1 / 10.0);

    this._StepEntities(timeInSeconds);
  }

  _StepEntities(timeInSeconds) {
    for (let k in this._entities) {
      this._entities[k].Update(timeInSeconds);
    }
  }
}


function _Main() {
  _APP = new SimonDevCraft();
}

_Main();
