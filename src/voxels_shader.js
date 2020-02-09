
export const voxels_shader = (function() {

const _VS = `
precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform float fogDensity;
uniform vec3 cloudScale;

// Attributes
attribute vec3 position;
attribute vec3 normal;
attribute vec3 color;
attribute vec2 uv;

// Instance attributes
attribute vec3 offset;
attribute vec2 uvOffset;

// Outputs
varying vec2 vUV;
varying vec4 vColor;
varying vec4 vLight;
varying vec3 vNormal;
varying float vFog;

#define saturate(a) clamp( a, 0.0, 1.0 )


float _Fog2(const vec3 worldPosition, const float density) {
  vec4 viewPosition = modelViewMatrix * vec4(worldPosition, 1.0);

  float att = density * viewPosition.z;
  att = att * att * -1.442695;
  return 1.0 - clamp(exp2(att), 0.0, 1.0);
}

vec4 _ComputeLighting() {
  // Hardcoded vertex lighting is the best lighting.
  float lighting = clamp(dot(normal, normalize(vec3(1, 1, 0.5))), 0.0, 1.0);
  vec3 diffuseColour = vec3(1, 1, 1);
  vec4 diffuseLighting = vec4(diffuseColour * lighting, 1);

  lighting = clamp(dot(normal, normalize(vec3(-1, 1, -1))), 0.0, 1.0);
  diffuseColour = vec3(0.25, 0.25, 0.25);
  diffuseLighting += vec4(diffuseColour * lighting, 1);

  lighting = clamp(dot(normal, normalize(vec3(1, 1, 1))), 0.0, 1.0);
  diffuseColour = vec3(0.5, 0.5, 0.5);
  diffuseLighting += vec4(diffuseColour * lighting, 1);

  vec4 ambientLighting = vec4(1, 1, 1, 1);

  return diffuseLighting + ambientLighting;
}

void main(){
  vec3 worldPosition = offset + position * cloudScale;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);

  vUV = uv * uvOffset;
  vNormal = normalize(worldPosition - cameraPosition);
  vFog = _Fog2(worldPosition, fogDensity);

  vLight = _ComputeLighting();
  vColor = vec4(color, 1);
}
`;

const _PS = `
precision highp float;

uniform sampler2D diffuseTexture;
uniform samplerCube skybox;

varying vec2 vUV;
varying vec4 vColor;
varying vec4 vLight;
varying vec3 vNormal;
varying float vFog;

#define saturate(a) clamp( a, 0.0, 1.0 )

vec3 _ACESFilmicToneMapping(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return saturate((x*(a*x+b))/(x*(c*x+d)+e));
}

void main() {
  vec4 fragmentColor = texture2D(diffuseTexture, vUV);
  fragmentColor *= vColor;
  fragmentColor *= vLight;

  vec4 outColor = vec4(
      _ACESFilmicToneMapping(fragmentColor.xyz), fragmentColor.a);
  vec4 fogColor = textureCube(skybox, vNormal);

  gl_FragColor = mix(outColor, fogColor, vFog);
}
`;

  return {
    VS: _VS,
    PS: _PS,
  };
})();
