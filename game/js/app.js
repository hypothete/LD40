///// INIT SETUP

var app = new Vue({
  el: '#vue',
  data: {
    mask: null,
    leftEye: null,
    rightEye: null,
    midbrow: { x: 0, y: 0, a: 0 },
    scene: [],
    tracker: new tracking.ObjectTracker(['eye']),
    maskOptions: [
      {
        name: 'anaglyph',
        url: './img/anaglyph.png'
      },
      {
        name: 'flower-crown',
        url: './img/flower-crown.png'
      },
      {
        name: 'greek',
        url: './img/greek.png'
      },
      {
        name: 'smile',
        url: './img/smile.png'
      },
      {
        name: 'senpai',
        url: './img/senpai.png'
      },
      {
        name: '*clear*',
        url: ''
      }
    ],
    maskStack: []
  },
  directives: {
    loaded: {
      inserted: function (el, binding, vnode) {
        let self = vnode.context;
        fetch(new Request('./models/faceplane.obj'))
        .then((objResponse) => {
          return objResponse.text();
        })
        .then((objText) => {
          self.mask = makeModel(new OBJ.Mesh(objText), useCanvasAsTexture(maskcan));
          self.scene.push(self.mask);
          OBJ.initMeshBuffers(gl, self.mask.mesh);
          vec3.set(self.mask.translation, 0, 0, -2);
          let randomMask = pick(self.maskOptions);
          self.maskStack.push(randomMask);
          self.updateMaskStack();

          self.tracker.setStepSize(1.7);
          tracking.track('#video', self.tracker, { camera: true });
          self.tracker.on('track', self.trackEventHandler);

          self.animate();
        });
      }
    }
  },
  methods: {

    animate () {
      requestAnimationFrame(this.animate);
      drawScene(gl, programInfo, this.scene);
    },

    trackEventHandler (event) {
      let eyeData = this.findEyePair(event.data);
      if (eyeData.count == 1) {
        let pair = eyeData.tally[0];
        if (event.data[pair[0]].x < event.data[pair[1]].x) {
          this.leftEye = event.data[pair[0]];
          this.rightEye = event.data[pair[1]];
        }
        else {
          this.leftEye = event.data[pair[1]];
          this.rightEye = event.data[pair[0]];
        }
        this.midbrow.x = this.rightEye.x + this.rightEye.width - (this.rightEye.x + this.rightEye.width - this.leftEye.x)/2;
        this.midbrow.y = this.rightEye.y + this.rightEye.height - (this.rightEye.y + this.rightEye.height - this.leftEye.y)/2;

        this.midbrow.a = Math.atan2(
          this.rightEye.y - this.leftEye.y,
          this.rightEye.x - this.leftEye.x + this.leftEye.width/2
        ) + Math.PI/2;
        this.updateMaskPosition();
      }
    },

    findEyePair (rects) {
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
    },

    updateMaskPosition () {
      let hov = camera.fov * camera.ar;
      let zcam = (glcan.width/2) * Math.atan(hov/2);
      let eyedist = dist({ x: this.leftEye.x, y: this.leftEye.y }, { x: this.rightEye.x + this.rightEye.width, y: this.rightEye.y });

      this.mask.translation[2] = -zcam / (eyedist);
      let z = this.mask.translation[2];

      let dnx = (this.midbrow.x - glcan.width/2) * z / zcam;
      let dny = (this.midbrow.y - glcan.height/2) * z / zcam;

      this.mask.translation[0] = dnx;
      this.mask.translation[1] = dny;
      quat.fromEuler(this.mask.rotation, 0, 0, this.midbrow.a * 180 / Math.PI - 90);
    },

    drawUrlToMask(url) {
      let self = this;
      return new Promise(function (res) {
        let img = new Image();
        img.onload = function () {
          maskctx.drawImage(img, 0, 0, maskcan.width, maskcan.height);
          self.mask.updateTexture(maskcan);
          res();
        }
        img.src = url;
      });
    },

    updateMaskStack () {
      let self = this;
      maskctx.clearRect(0, 0, maskcan.width, maskcan.height);
      if (self.maskStack[self.maskStack.length-1].url.length === 0) {
        self.mask.updateTexture(maskcan);
        self.maskStack = [];
        return;
      }
      let chainHead = Promise.resolve();

      for (let mask of self.maskStack) {
        chainHead.then(function () {
            return self.drawUrlToMask(mask.url);
        });
      }
    }

  }
});

/////

function dist (a, b) {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

function pick (arr) {
  return arr[Math.floor(arr.length * Math.random())];
}
