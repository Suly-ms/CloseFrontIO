import { DynamicInstanceBuffer } from "../DynamicBuffer";
import fragSrc from "../shaders/sea-zone/sea-zone.frag.glsl?raw";
import vertSrc from "../shaders/sea-zone/sea-zone.vert.glsl?raw";
import { createProgram } from "../utils/GlUtils";

const FLOATS_PER_INSTANCE = 3;

export class SeaZonePass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private instanceBuf: DynamicInstanceBuffer;
  private count = 0;
  private uCamera: WebGLUniformLocation;
  private uRadius: WebGLUniformLocation;
  private uMapSize: WebGLUniformLocation;
  private uPalette: WebGLUniformLocation;
  private uTerrain: WebGLUniformLocation;

  constructor(
    gl: WebGL2RenderingContext,
    private radius: number,
    private mapW: number,
    private mapH: number,
    private paletteTex: WebGLTexture,
    private terrainTex: WebGLTexture,
  ) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc, "SeaZonePass");
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uRadius = gl.getUniformLocation(this.program, "uRadius")!;
    this.uMapSize = gl.getUniformLocation(this.program, "uMapSize")!;
    this.uPalette = gl.getUniformLocation(this.program, "uPalette")!;
    this.uTerrain = gl.getUniformLocation(this.program, "uTerrain")!;

    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );

    const instanceGlBuf = gl.createBuffer()!;
    this.instanceBuf = new DynamicInstanceBuffer(
      gl,
      instanceGlBuf,
      16,
      FLOATS_PER_INSTANCE,
    );
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceGlBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, FLOATS_PER_INSTANCE * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    gl.deleteBuffer(quadBuf);
  }

  updateBeacons(beacons: { x: number; y: number; ownerID: number }[]): void {
    this.count = beacons.length;
    this.instanceBuf.ensureCapacity(this.count);
    const data = this.instanceBuf.float32;
    for (let i = 0; i < beacons.length; i++) {
      const beacon = beacons[i];
      const offset = i * FLOATS_PER_INSTANCE;
      data[offset] = beacon.x;
      data[offset + 1] = beacon.y;
      data[offset + 2] = beacon.ownerID;
    }
    if (this.count > 0) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuf.buffer);
      this.gl.bufferSubData(
        this.gl.ARRAY_BUFFER,
        0,
        data,
        0,
        this.count * FLOATS_PER_INSTANCE,
      );
    }
  }

  draw(camera: Float32Array): void {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, camera);
    gl.uniform1f(this.uRadius, this.radius);
    gl.uniform2i(this.uMapSize, this.mapW, this.mapH);
    gl.uniform1i(this.uPalette, 0);
    gl.uniform1i(this.uTerrain, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.terrainTex);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vao);
    this.instanceBuf.dispose();
  }
}
