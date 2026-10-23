#version 300 es
precision highp float;
precision highp usampler2D;

uniform sampler2D uPalette;
uniform usampler2D uTerrain;
uniform ivec2 uMapSize;

in vec2 vWorldPos;
in vec2 vCirclePos;
flat in float vOwnerID;
out vec4 fragColor;

void main() {
  float distanceFromCenter = length(vCirclePos);
  if (distanceFromCenter > 1.0) discard;

  ivec2 tile = ivec2(floor(vWorldPos));
  if (any(lessThan(tile, ivec2(0))) || any(greaterThanEqual(tile, uMapSize))) {
    discard;
  }
  uint terrainByte = texelFetch(uTerrain, tile, 0).r;
  if ((terrainByte & (1u << 7u)) != 0u) discard;

  float edge = smoothstep(0.94, 1.0, distanceFromCenter);
  float alpha = mix(0.12, 0.48, edge);
  float paletteU = (vOwnerID + 0.5) / 4096.0;
  vec3 ownerColor = texture(uPalette, vec2(paletteU, 0.25)).rgb;
  fragColor = vec4(ownerColor, alpha);
}
