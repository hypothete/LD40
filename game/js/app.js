var glcan, gl, maskcan, maskctx, modelViewMatrix, projectionMatrix, camera, shaderProgram, programInfo, filtercan, filterctx;

var app = new Vue({
  el: '#vue',
  data: {
    mask: null,
    leftEye: null,
    rightEye: null,
    midbrow: { x: 0, y: 0, a: 0 },
    scene: [],
    tracker: new tracking.ObjectTracker(['eye']),
    trackerListener: null,
    stepData: [
      {
        name: 'title',
        title: 'Welcome'
      },
      {
        name: 'editor',
        title: 'Put stuff on your face'
      },
      {
        name: 'filter',
        title: 'Add a filter'
      },
      {
        name: 'score',
        title: 'Let\'s see how you did'
      }
    ],
    activeStep: null,
    maskOptions: [
      {
        name: '3D glasses',
        url: './img/anaglyph.png'
      },
      {
        name: 'flower crown',
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
      }
    ],
    filterOptions: [
      {
        name: 'anime',
        url: './img/filter-anime.png'
      },
      {
        name: 'beauty',
        url: './img/filter-beauty.png'
      },
      {
        name: 'fire',
        url: './img/filter-fire.png'
      },
      {
        name: 'lava lamp',
        url: './img/filter-lavalamp.png'
      },
      {
        name: 'TV',
        url: './img/filter-tv.png'
      },
      {
        name: 'vignette',
        url: './img/filter-vignette.png'
      }
    ],
    selectedFilter: null,
    maskStack: [],
    imgCache: {},
    activemenu: 'buttons',
    editorStarted: false,
    filterStarted: false,
    imgToFilter: null,
    centeredScore: 0,
    jauntyScore: 0,
    faceSizeScore: 0
  },
  computed: {
    totalScore () {
      let scores = [
        this.centeredScore,
        this.jauntyScore,
        this.faceSizeScore
      ];
      return scores.reduce((a, b) => {
        return a + b;
      });
    }
  },
  created () {
    this.activeStep = this.stepData[0];
  },
  methods: {
    startTitle () {
      this.activeStep = this.stepData[0];
      this.clearMaskStack();
      this.selectedFilter = null;
      this.imgToFilter = null;
      this.clearScores();
    },
    startEditor () {
      let self = this;
      this.activeStep = this.stepData[1];
      if (!this.editorStarted) {
        fetch(new Request('./models/faceplane.obj'))
        .then((objResponse) => {
          return objResponse.text();
        })
        .then((objText) => {
          self.loadGL();
          self.mask = makeModel(new OBJ.Mesh(objText), useCanvasAsTexture(maskcan));
          OBJ.initMeshBuffers(gl, self.mask.mesh);
          self.scene.push(self.mask);
          vec3.set(self.mask.translation, 0, 0, -2);

          let randomMask = pick(self.maskOptions);
          self.maskStack.push(randomMask);
          self.updateMaskStack();

          this.tracker.setStepSize(1.7);
          self.trackerListener = tracking.track('#video', this.tracker, { camera: true });
          this.tracker.on('track', this.trackEventHandler);

          this.editorStarted = true;

          self.animate();
        });
      }
      else {
        this.trackerListener.run();

        let randomMask = pick(self.maskOptions);
        self.maskStack.push(randomMask);
        self.updateMaskStack();
      }
    },

    startFilter () {
      // calculate scores from face tracking before continuing
      this.getCenteredScore();
      this.getJauntyScore();
      this.getFaceSizeScore();

      //continue
      this.trackerListener.stop();
      this.activeStep = this.stepData[2];
      if (!this.filterStarted) {
        this.filterStarted = true;
        filtercan = document.querySelector('#filtercan');
        filterctx = filtercan.getContext('2d');
      }
      filterctx.save();
      filterctx.translate(filtercan.width, 0);
      filterctx.scale(-1, 1);
      filterctx.drawImage(document.querySelector('#video'), 0, 0, filtercan.width, filtercan.height);
      filterctx.restore();
      filterctx.drawImage(glcan, 0, 0, filtercan.width, filtercan.height);
      this.imgToFilter = new Image();
      this.imgToFilter.src = filtercan.toDataURL(0,0,filtercan.width, filtercan.height);
    },

    selectFilter (filter) {
      let self = this;
      self.selectedFilter = filter;
      filterctx.drawImage(self.imgToFilter, 0, 0, filtercan.width, filtercan.height);
      if (!self.imgCache[filter.name]) {
        self.imgCache[filter.name] = new Image();
        self.imgCache[filter.name].onload = function () {
          filterctx.drawImage(self.imgCache[filter.name], 0, 0, filtercan.width, filtercan.height);
        }
        self.imgCache[filter.name].src = filter.url;
      }
      else {
        filterctx.drawImage(self.imgCache[filter.name], 0, 0, filtercan.width, filtercan.height);
      }
    },

    randomFilter () {
      let randFilter = pick(this.filterOptions);
      this.selectFilter(randFilter);
    },

    clearFilter () {
      this.selectedFilter = null;
      filterctx.drawImage(this.imgToFilter, 0, 0, filtercan.width, filtercan.height);
    },

    startScore () {
      this.activeStep = this.stepData[3];
    },

    loadGL () {
      glcan = document.querySelector('#gl');
      gl = glcan.getContext('webgl', {
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      });
      maskcan = document.querySelector('#masksrc');
      maskctx = maskcan.getContext('2d');
      modelViewMatrix = mat4.create();
      projectionMatrix = mat4.create();

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

      camera = {
        fov: 90 * Math.PI/ 180,
        ar: glcan.clientWidth / glcan.clientHeight,
        near: 0.1,
        far: 100.0,
        update: function () {
          mat4.perspective(projectionMatrix, camera.fov, camera.ar, camera.near, camera.far);
        }
      };

      shaderProgram = initShaderProgram(gl, vsSource, fsSource);
      gl.useProgram(shaderProgram);

      programInfo = {
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
    },

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
        if (self.imgCache[url]) {
          maskctx.drawImage(self.imgCache[url], 0, 0, maskcan.width, maskcan.height);
          self.mask.updateTexture(maskcan);
          res();
        }
        else {
          let img = new Image();
          img.onload = function () {
            maskctx.drawImage(img, 0, 0, maskcan.width, maskcan.height);
            self.mask.updateTexture(maskcan);
            self.imgCache[url] = img;
            res();
          }
          img.src = url;
        }
      });
    },

    clearMaskStack () {
      maskctx.clearRect(0, 0, maskcan.width, maskcan.height);
      this.maskStack = [];
      this.mask.updateTexture(maskcan);
    },

    updateMaskStack () {
      let self = this;
      maskctx.clearRect(0, 0, maskcan.width, maskcan.height);
      let chainHead = Promise.resolve();
      for (let mask of self.maskStack) {
        chainHead = chainHead.then(function () {
            return self.drawUrlToMask(mask.url);
        });
      }
    },

    randomMask () {
      this.maskStack.push(pick(this.maskOptions));
      this.updateMaskStack();
    },

    getCenteredScore () {
      let browdist = dist(this.midbrow, { x: glcan.width/2, y: glcan.height/2}) / (glcan.width / 2);
      this.centeredScore = 50 * (1 - Math.min(1, browdist)) | 0;
    },

    getJauntyScore () {
      this.jauntyScore = Math.abs(90 - 180 * this.midbrow.a / Math.PI) | 0;
    },

    getFaceSizeScore () {
      let eyedist = dist({ x: this.leftEye.x, y: this.leftEye.y }, { x: this.rightEye.x + this.rightEye.width, y: this.rightEye.y });
      this.faceSizeScore = 100 * (eyedist / glcan.width) | 0;
    },

    clearScores () {
      this.centeredScore = 0;
      this.jauntyScore = 0;
      this.faceSizeScore = 0;
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
