var canvas = document.querySelector('#canvas');
var ctx = canvas.getContext('2d');
var tracker = new tracking.ObjectTracker(['eye']);
var leftEye, rightEye;

var eyeImg = new Image();
eyeImg.src = 'eye.png';


tracker.setStepSize(1.7);

tracking.track('#video', tracker, { camera: true });

animate();

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

  }
});

function animate () {
  requestAnimationFrame(animate);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRects([leftEye, rightEye]);
}

function drawRects (rects) {
  //ctx.strokeStyle = 'red';

  rects.forEach((rect) => {
    //ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    if (!rect) return;
    ctx.drawImage(eyeImg, rect.x, rect.y, rect.width, rect.height);
    if (typeof rect.color !== 'undefined') {
      ctx.fillStyle = rect.color;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  });
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
