#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;
layout(location = 1) in vec3 aBeacon; // tileX, tileY, ownerID

uniform mat3 uCamera;
uniform float uRadius;

out vec2 vWorldPos;
out vec2 vCirclePos;
flat out float vOwnerID;

void main() {
  vec2 center = aBeacon.xy + 0.5;
  vec2 offset = (aPos - 0.5) * (2.0 * uRadius);
  vec2 worldPos = center + offset;
  vWorldPos = worldPos;
  vCirclePos = (aPos - 0.5) * 2.0;
  vOwnerID = aBeacon.z;
  gl_Position = vec4((uCamera * vec3(worldPos, 1.0)).xy, 0.0, 1.0);
}
