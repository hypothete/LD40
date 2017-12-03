var tracker = new tracking.ObjectTracker(['eye']);
var leftEye,
  rightEye,
  midbrow = { x: 0, y: 0, a: 0 },
  mouth = { x: 0, y: 0 };

// const tex = loadTexture(gl, './img/smile.png');

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
gl.useProgram(shaderProgram);
const programInfo = {
  attribLocations: {
    vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord')
  },
  uniformLocations: {
    projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
    modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
    uSampler: gl.getUniformLocation(shaderProgram, 'uSampler')
  },
};

var mask;


///// INIT SETUP

tracker.setStepSize(1.7);
tracking.track('#video', tracker, { camera: true });

fetch(new Request('./models/faceplane.obj'))
.then((objResponse) => {
  return objResponse.text();
})
.then((objText) => {
  mask = makeModel(new OBJ.Mesh(objText), useCanvasAsTexture(maskcan));
  scene.push(mask);
  OBJ.initMeshBuffers(gl, mask.mesh);
  vec3.set(mask.translation, 0, 0, -2);
  animate();

  let img = new Image();
  img.onload = function () {
    maskctx.drawImage(img, 0,0,maskcan.width, maskcan.height);
    mask.updateTexture(maskcan);
  }
  img.src = './img/smile.png';
});

tracker.on('track', function(event) {
  let eyeData = findEyePair(event.data);
  if (eyeData.count == 1) {
    let pair = eyeData.tally[0];
    if (event.data[pair[0]].x < event.data[pair[1]].x) {
      leftEye = event.data[pair[0]];
      rightEye = event.data[pair[1]];
    }
    else{
      leftEye = event.data[pair[1]];
      rightEye = event.data[pair[0]];
    }
    leftEye.color = 'red';
    rightEye.color = 'green';
    midbrow.x = rightEye.x + rightEye.width - (rightEye.x + rightEye.width - leftEye.x)/2;
    midbrow.y = rightEye.y + rightEye.height - (rightEye.y + rightEye.height - leftEye.y)/2;
    eyedist = dist(leftEye, rightEye);
    midbrow.a = Math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x + leftEye.width/2
    ) + Math.PI/2;
    mouth.x = midbrow.x+Math.cos(midbrow.a)*eyedist*1.168;
    mouth.y = midbrow.y+Math.sin(midbrow.a)*eyedist*1.168;
    updateMaskPosition();
  }
});


/////

function animate () {
  requestAnimationFrame(animate);
  drawScene(gl, programInfo, scene);
}

function findEyePair (rects) {
  let rectParallelTally = [];
  for (let i=0; i<rects.length; i++) {
    let recta = rects[i];
    for (let j=0; j<rects.length; j++) {
      if (i == j) {
        continue;
      }
      let rectb = rects[j];
      // if rectb.y is within y range of recta
      if (rectb.y < (recta.y + recta.height) && rectb.y > recta.y) {
        rectParallelTally.push([i,j]);
      }
    }
  }
  return { count: rectParallelTally.length, tally: rectParallelTally};
}

function updateMaskPosition () {
  let hov = camera.fov * camera.ar;
  let zcam = (glcan.width/2) * Math.atan(hov/2);
  let eyedist = dist({ x: leftEye.x, y: leftEye.y }, { x: rightEye.x + rightEye.width, y: rightEye.y });

  mask.translation[2] = -zcam / (eyedist);
  let z = mask.translation[2];

  let dnx = (midbrow.x - glcan.width/2) * z / zcam;
  let dny = (midbrow.y - glcan.height/2) * z / zcam;

  mask.translation[0] = dnx;
  mask.translation[1] = dny;
  quat.fromEuler(mask.rotation, 0, 0, midbrow.a * 180 / Math.PI - 90);
}

function dist (a, b) {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}
