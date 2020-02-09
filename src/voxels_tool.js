import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.112.1/build/three.module.js';


export const voxels_tool = (function() {

  // HACKY TODO: Separate luminance and highlight, right now one overwrites the
  // other.
  class InsertTool {
    constructor(parent) {
      this._parent = parent;
      this._cell = null;
      this._prev = null;
      this._blinkTimer = 0;
      this._luminance = 1;
    }

    LoseFocus() {
      if (this._prev) {
        this._parent.MarkDirty(this._prev.cell);
        this._prev.cell.RemoveVoxel(
            this._prev.cell._Key(
                this._prevVoxel.position[0],
                this._prevVoxel.position[1],
                this._prevVoxel.position[2]));
        this._prev = null;
        this._prevVoxel = null;
      }
    }

    PerformAction() {
      this.LoseFocus();

      const camera = this._parent._game._graphics._camera;
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);

      const ray = new THREE.Ray(camera.position, forward);
      const intersections = this._parent._FindIntersections(ray, 5);
      if (!intersections.length) {
        return;
      }

      const possibleCoords = [...intersections[0].voxel.position];
      possibleCoords[1] += 1;

      if (!intersections[0].cell.HasVoxelAt(
          possibleCoords[0], possibleCoords[1], possibleCoords[2])) {
        intersections[0].cell.InsertVoxel({
            position: [...possibleCoords],
            type: 'stone',
            visible: true
        }, true);
      }
    }

    Update(timeInSeconds) {
      const camera = this._parent._game._graphics._camera;
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);

      const ray = new THREE.Ray(camera.position, forward);
      const intersections = this._parent._FindIntersections(ray, 5);
      if (intersections.length) {
        if (this._prev) {
          this._parent.MarkDirty(this._prev.cell);
          this._prev.cell.RemoveVoxel(
              this._prev.cell._Key(
                  this._prevVoxel.position[0],
                  this._prevVoxel.position[1],
                  this._prevVoxel.position[2]));
        }
        const cur = intersections[0];
        const newVoxel = {
          position: [...cur.voxel.position],
          visible: true,
          type: 'stone',
          blinker: true
        };
        newVoxel.position[1] += 1;

        if (cur.cell.HasVoxelAt(newVoxel.position[0],
                                newVoxel.position[1],
                                newVoxel.position[2])) {
          return;
        }

        this._prev = cur;
        this._prevVoxel = newVoxel;
        this._blinkTimer -= timeInSeconds;
        if (this._blinkTimer < 0) {
          this._blinkTimer = 0.25;
          if (this._luminance == 1) {
            this._luminance = 2;
          } else {
            this._luminance = 1;
          }
        }
        const k = cur.cell._Key(newVoxel.position[0],
                                newVoxel.position[1],
                                newVoxel.position[2]);
        intersections[0].cell.InsertVoxel(newVoxel);
        intersections[0].cell._cells[k].luminance = this._luminance;
      }
    }
  };

  class DeleteTool {
    constructor(parent) {
      this._parent = parent;
      this._cell = null;
      this._blinkTimer = 0;
      this._luminance = 1;
    }

    LoseFocus() {
      if (this._prev) {
        this._prev.cell._cells[this._prev.voxel.key].luminance = 1;
        this._parent.MarkDirty(this._prev.cell);
      }
    }

    PerformAction() {
      const camera = this._parent._game._graphics._camera;
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);

      const ray = new THREE.Ray(camera.position, forward);
      const intersections = this._parent._FindIntersections(ray, 5);
      if (!intersections.length) {
        return;
      }

      intersections[0].cell.RemoveVoxel(intersections[0].voxel.key);
    }

    Update(timeInSeconds) {
      this.LoseFocus();

      const camera = this._parent._game._graphics._camera;
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);

      const ray = new THREE.Ray(camera.position, forward);
      const intersections = this._parent._FindIntersections(ray, 5);
      if (intersections.length) {
        this._prev = intersections[0];
        this._blinkTimer -= timeInSeconds;
        if (this._blinkTimer < 0) {
          this._blinkTimer = 0.25;
          if (this._luminance == 1) {
            this._luminance = 2;
          } else {
            this._luminance = 1;
          }
        }
        intersections[0].cell._cells[intersections[0].voxel.key].luminance = this._luminance;
        this._parent.MarkDirty(intersections[0].cell);
      }
    }
  };

  return {
    InsertTool: InsertTool,
    DeleteTool: DeleteTool,
  };
})();
