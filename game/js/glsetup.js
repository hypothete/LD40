const glcan = document.querySelector('#gl');
const gl = glcan.getContext('webgl');
const modelViewMatrix = mat4.create();
const projectionMatrix = mat4.create();

const vsSource = `
  attribute vec2 aTextureCoord;
  attribute vec4 aVertexPosition;

  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;

  varying vec2 vTextureCoord;

  void main() {
    vTextureCoord = aTextureCoord;
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
  }
`;

const fsSource = `
  precision highp float;

  uniform sampler2D uSampler;

  varying vec2 vTextureCoord;

  void main() {
    vec4 texelColor = texture2D(uSampler, vTextureCoord);
    gl_FragColor = texelColor;
  }
`;

const camera = {
  fov: 45 * Math.PI/ 180,
  ar: glcan.clientWidth / glcan.clientHeight,
  near: 1.0,
  far: 1000.0,
  update: function () {
    mat4.perspective(projectionMatrix, camera.fov, camera.ar, camera.near, camera.far);
  }
};
const scene = [];

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(shaderProgram));
    return null;
  }
  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function drawScene(gl, programInfo, scene) {
  gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  camera.update();

  for (let model of scene) {
    drawObject(model);
  }
}

function drawObject (model) {
  let mesh = model.mesh;
  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, model.getModelMatrix());

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.textureBuffer);
  gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, mesh.textureBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(programInfo.uniformLocations.uSampler, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
  gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, mesh.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  gl.drawElements(gl.TRIANGLES, mesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

function loadTexture (gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const pixel = new Uint8Array([0, 0, 255, 255]);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

  const image = new Image();
  image.onload = function() {
    texture.image = image;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    // assume power of 2
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  image.src = url;
  return texture;
}

function makeModel (mesh) {
  let model = {
    mesh: mesh,
    translation: vec3.create(),
    rotation: quat.create(),
    scale: vec3.fromValues(1.0,1.0,1.0),
    getModelMatrix: function () {
      return mat4.fromRotationTranslationScale(mat4.create(), model.rotation, model.translation, model.scale);
    }
  };
  return model;
}
