/*
  Simplified version of Yahoo's gifshot library which does gif encoding
  https://github.com/yahoo/gifshot
*/

;(function(window, document, navigator, undefined) {
var utils, error, defaultOptions, isSupported, isExistingImagesGIFSupported, NeuQuant, processFrameWorker, gifWriter, AnimatedGIF, getBase64GIF, existingImages, screenShot, createGIF, API;
utils = function () {
  var utils = {
    'URL': window.URL || window.webkitURL || window.mozURL || window.msURL,
    'getUserMedia': function () {
      var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
      return getUserMedia ? getUserMedia.bind(navigator) : getUserMedia;
    }(),
    'requestAnimFrame': window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame,
    'requestTimeout': function (callback, delay) {
      callback = callback || utils.noop;
      delay = delay || 0;
      if (!utils.requestAnimFrame) {
        return setTimeout(callback, delay);
      }
      var start = new Date().getTime(), handle = new Object(), requestAnimFrame = utils.requestAnimFrame;
      function loop() {
        var current = new Date().getTime(), delta = current - start;
        delta >= delay ? callback.call() : handle.value = requestAnimFrame(loop);
      }
      handle.value = requestAnimFrame(loop);
      return handle;
    },
    'Blob': window.Blob || window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder,
    'btoa': function () {
      var btoa = window.btoa || function (input) {
        var output = '', i = 0, l = input.length, key = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=', chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        while (i < l) {
          chr1 = input.charCodeAt(i++);
          chr2 = input.charCodeAt(i++);
          chr3 = input.charCodeAt(i++);
          enc1 = chr1 >> 2;
          enc2 = (chr1 & 3) << 4 | chr2 >> 4;
          enc3 = (chr2 & 15) << 2 | chr3 >> 6;
          enc4 = chr3 & 63;
          if (isNaN(chr2))
            enc3 = enc4 = 64;
          else if (isNaN(chr3))
            enc4 = 64;
          output = output + key.charAt(enc1) + key.charAt(enc2) + key.charAt(enc3) + key.charAt(enc4);
        }
        return output;
      };
      return btoa ? btoa.bind(window) : function () {
      };
    }(),
    'isObject': function (obj) {
      return obj && Object.prototype.toString.call(obj) === '[object Object]';
    },
    'isEmptyObject': function (obj) {
      return utils.isObject(obj) && !Object.keys(obj).length;
    },
    'isArray': function (arr) {
      return arr && Array.isArray(arr);
    },
    'isFunction': function (func) {
      return func && typeof func === 'function';
    },
    'isElement': function (elem) {
      return elem && elem.nodeType === 1;
    },
    'isString': function (value) {
      return typeof value === 'string' || Object.prototype.toString.call(value) === '[object String]';
    },
    'isSupported': {
      'canvas': function () {
        var el = document.createElement('canvas');
        return el && el.getContext && el.getContext('2d');
      },
      'webworkers': function () {
        return window.Worker;
      },
      'blob': function () {
        return utils.Blob;
      },
      'Uint8Array': function () {
        return window.Uint8Array;
      },
      'Uint32Array': function () {
        return window.Uint32Array;
      },
      'videoCodecs': function () {
        var testEl = document.createElement('video'), supportObj = {
            'mp4': false,
            'h264': false,
            'ogv': false,
            'ogg': false,
            'webm': false
          };
        try {
          if (testEl && testEl.canPlayType) {
            supportObj.mp4 = testEl.canPlayType('video/mp4; codecs="mp4v.20.8"') !== '';
            supportObj.h264 = (testEl.canPlayType('video/mp4; codecs="avc1.42E01E"') || testEl.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) !== '';
            supportObj.ogv = testEl.canPlayType('video/ogg; codecs="theora"') !== '';
            supportObj.ogg = testEl.canPlayType('video/ogg; codecs="theora"') !== '';
            supportObj.webm = testEl.canPlayType('video/webm; codecs="vp8, vorbis"') !== -1;
          }
        } catch (e) {
        }
        return supportObj;
      }()
    },
    'noop': function () {
    },
    'each': function (collection, callback) {
      var x, len;
      if (utils.isArray(collection)) {
        x = -1;
        len = collection.length;
        while (++x < len) {
          if (callback(x, collection[x]) === false) {
            break;
          }
        }
      } else if (utils.isObject(collection)) {
        for (x in collection) {
          if (collection.hasOwnProperty(x)) {
            if (callback(x, collection[x]) === false) {
              break;
            }
          }
        }
      }
    },
    'mergeOptions': function deepMerge(defaultOptions, userOptions) {
      if (!utils.isObject(defaultOptions) || !utils.isObject(userOptions) || !Object.keys) {
        return;
      }
      var newObj = {};
      utils.each(defaultOptions, function (key, val) {
        newObj[key] = defaultOptions[key];
      });
      utils.each(userOptions, function (key, val) {
        var currentUserOption = userOptions[key];
        if (!utils.isObject(currentUserOption)) {
          newObj[key] = currentUserOption;
        } else {
          if (!defaultOptions[key]) {
            newObj[key] = currentUserOption;
          } else {
            newObj[key] = deepMerge(defaultOptions[key], currentUserOption);
          }
        }
      });
      return newObj;
    },
    'setCSSAttr': function (elem, attr, val) {
      if (!utils.isElement(elem)) {
        return;
      }
      if (utils.isString(attr) && utils.isString(val)) {
        elem.style[attr] = val;
      } else if (utils.isObject(attr)) {
        utils.each(attr, function (key, val) {
          elem.style[key] = val;
        });
      }
    },
    'removeElement': function (node) {
      if (!utils.isElement(node)) {
        return;
      }
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    },
    'createWebWorker': function (content) {
      if (!utils.isString(content)) {
        return {};
      }
      try {
        var blob = new utils.Blob([content], { 'type': 'text/javascript' }), objectUrl = utils.URL.createObjectURL(blob), worker = new Worker(objectUrl);
        return {
          'objectUrl': objectUrl,
          'worker': worker
        };
      } catch (e) {
        return '' + e;
      }
    },
    'getExtension': function (src) {
      return src.substr(src.lastIndexOf('.') + 1, src.length);
    },
    'getFontSize': function (options) {
      options = options || {};
      if (!document.body || options.resizeFont === false) {
        return options.fontSize;
      }
      var text = options.text, containerWidth = options.gifWidth, fontSize = parseInt(options.fontSize, 10), minFontSize = parseInt(options.minFontSize, 10), div = document.createElement('div'), span = document.createElement('span');
      div.setAttribute('width', containerWidth);
      div.appendChild(span);
      span.innerHTML = text;
      span.style.fontSize = fontSize + 'px';
      span.style.textIndent = '-9999px';
      span.style.visibility = 'hidden';
      document.body.appendChild(span);
      while (span.offsetWidth > containerWidth && fontSize >= minFontSize) {
        span.style.fontSize = --fontSize + 'px';
      }
      document.body.removeChild(span);
      return fontSize + 'px';
    },
    'webWorkerError': false
  };
  return utils;
}();
error = function (utils) {
  var error = {
    'validate': function (skipObj) {
      skipObj = utils.isObject(skipObj) ? skipObj : {};
      var errorObj = {};
      utils.each(error.validators, function (indece, currentValidator) {
        var errorCode = currentValidator.errorCode;
        if (!skipObj[errorCode] && !currentValidator.condition) {
          errorObj = currentValidator;
          errorObj.error = true;
          return false;
        }
      });
      delete errorObj.condition;
      return errorObj;
    },
    'isValid': function (skipObj) {
      var errorObj = error.validate(skipObj), isValid = errorObj.error !== true ? true : false;
      return isValid;
    },
    'validators': [
      {
        'condition': utils.isFunction(utils.getUserMedia),
        'errorCode': 'getUserMedia',
        'errorMsg': 'The getUserMedia API is not supported in your browser'
      },
      {
        'condition': utils.isSupported.canvas(),
        'errorCode': 'canvas',
        'errorMsg': 'Canvas elements are not supported in your browser'
      },
      {
        'condition': utils.isSupported.webworkers(),
        'errorCode': 'webworkers',
        'errorMsg': 'The Web Workers API is not supported in your browser'
      },
      {
        'condition': utils.isFunction(utils.URL),
        'errorCode': 'window.URL',
        'errorMsg': 'The window.URL API is not supported in your browser'
      },
      {
        'condition': utils.isSupported.blob(),
        'errorCode': 'window.Blob',
        'errorMsg': 'The window.Blob File API is not supported in your browser'
      },
      {
        'condition': utils.isSupported.Uint8Array(),
        'errorCode': 'window.Uint8Array',
        'errorMsg': 'The window.Uint8Array function constructor is not supported in your browser'
      },
      {
        'condition': utils.isSupported.Uint32Array(),
        'errorCode': 'window.Uint32Array',
        'errorMsg': 'The window.Uint32Array function constructor is not supported in your browser'
      }
    ],
    'messages': {
      'videoCodecs': {
        'errorCode': 'videocodec',
        'errorMsg': 'The video codec you are trying to use is not supported in your browser'
      }
    }
  };
  return error;
}(utils);
defaultOptions = {
  'sampleInterval': 10,
  'numWorkers': 2,
  'gifWidth': 200,
  'gifHeight': 200,
  'interval': 0.1,
  'numFrames': 10,
  'images': [],
  'video': null,
  'text': '',
  'fontWeight': 'normal',
  'fontSize': '16px',
  'minFontSize': '10px',
  'resizeFont': false,
  'fontFamily': 'sans-serif',
  'fontColor': '#ffffff',
  'textAlign': 'center',
  'textBaseline': 'bottom',
  'textXCoordinate': null,
  'textYCoordinate': null,
  'progressCallback': function (captureProgress) {
  },
  'completeCallback': function () {
  },
  'saveRenderingContexts': false,
  'savedRenderingContexts': [],
  'crossOrigin': 'Anonymous'
};
isSupported = function () {
  return error.isValid();
};
isExistingImagesGIFSupported = function () {
  var skipObj = { 'getUserMedia': true };
  return error.isValid(skipObj);
};
NeuQuant = function () {
  function NeuQuant() {
    var netsize = 256;
    var prime1 = 499;
    var prime2 = 491;
    var prime3 = 487;
    var prime4 = 503;
    var minpicturebytes = 3 * prime4;
    var maxnetpos = netsize - 1;
    var netbiasshift = 4;
    var ncycles = 100;
    var intbiasshift = 16;
    var intbias = 1 << intbiasshift;
    var gammashift = 10;
    var gamma = 1 << gammashift;
    var betashift = 10;
    var beta = intbias >> betashift;
    var betagamma = intbias << gammashift - betashift;
    var initrad = netsize >> 3;
    var radiusbiasshift = 6;
    var radiusbias = 1 << radiusbiasshift;
    var initradius = initrad * radiusbias;
    var radiusdec = 30;
    var alphabiasshift = 10;
    var initalpha = 1 << alphabiasshift;
    var alphadec;
    var radbiasshift = 8;
    var radbias = 1 << radbiasshift;
    var alpharadbshift = alphabiasshift + radbiasshift;
    var alpharadbias = 1 << alpharadbshift;
    var thepicture;
    var lengthcount;
    var samplefac;
    var network;
    var netindex = [];
    var bias = [];
    var freq = [];
    var radpower = [];
    function NeuQuantConstructor(thepic, len, sample) {
      var i;
      var p;
      thepicture = thepic;
      lengthcount = len;
      samplefac = sample;
      network = new Array(netsize);
      for (i = 0; i < netsize; i++) {
        network[i] = new Array(4);
        p = network[i];
        p[0] = p[1] = p[2] = (i << netbiasshift + 8) / netsize | 0;
        freq[i] = intbias / netsize | 0;
        bias[i] = 0;
      }
    }
    function colorMap() {
      var map = [];
      var index = new Array(netsize);
      for (var i = 0; i < netsize; i++)
        index[network[i][3]] = i;
      var k = 0;
      for (var l = 0; l < netsize; l++) {
        var j = index[l];
        map[k++] = network[j][0];
        map[k++] = network[j][1];
        map[k++] = network[j][2];
      }
      return map;
    }
    function inxbuild() {
      var i;
      var j;
      var smallpos;
      var smallval;
      var p;
      var q;
      var previouscol;
      var startpos;
      previouscol = 0;
      startpos = 0;
      for (i = 0; i < netsize; i++) {
        p = network[i];
        smallpos = i;
        smallval = p[1];
        for (j = i + 1; j < netsize; j++) {
          q = network[j];
          if (q[1] < smallval) {
            smallpos = j;
            smallval = q[1];
          }
        }
        q = network[smallpos];
        if (i != smallpos) {
          j = q[0];
          q[0] = p[0];
          p[0] = j;
          j = q[1];
          q[1] = p[1];
          p[1] = j;
          j = q[2];
          q[2] = p[2];
          p[2] = j;
          j = q[3];
          q[3] = p[3];
          p[3] = j;
        }
        if (smallval != previouscol) {
          netindex[previouscol] = startpos + i >> 1;
          for (j = previouscol + 1; j < smallval; j++) {
            netindex[j] = i;
          }
          previouscol = smallval;
          startpos = i;
        }
      }
      netindex[previouscol] = startpos + maxnetpos >> 1;
      for (j = previouscol + 1; j < 256; j++) {
        netindex[j] = maxnetpos;
      }
    }
    function learn() {
      var i;
      var j;
      var b;
      var g;
      var r;
      var radius;
      var rad;
      var alpha;
      var step;
      var delta;
      var samplepixels;
      var p;
      var pix;
      var lim;
      if (lengthcount < minpicturebytes) {
        samplefac = 1;
      }
      alphadec = 30 + (samplefac - 1) / 3;
      p = thepicture;
      pix = 0;
      lim = lengthcount;
      samplepixels = lengthcount / (3 * samplefac);
      delta = samplepixels / ncycles | 0;
      alpha = initalpha;
      radius = initradius;
      rad = radius >> radiusbiasshift;
      if (rad <= 1) {
        rad = 0;
      }
      for (i = 0; i < rad; i++) {
        radpower[i] = alpha * ((rad * rad - i * i) * radbias / (rad * rad));
      }
      if (lengthcount < minpicturebytes) {
        step = 3;
      } else if (lengthcount % prime1 !== 0) {
        step = 3 * prime1;
      } else {
        if (lengthcount % prime2 !== 0) {
          step = 3 * prime2;
        } else {
          if (lengthcount % prime3 !== 0) {
            step = 3 * prime3;
          } else {
            step = 3 * prime4;
          }
        }
      }
      i = 0;
      while (i < samplepixels) {
        b = (p[pix + 0] & 255) << netbiasshift;
        g = (p[pix + 1] & 255) << netbiasshift;
        r = (p[pix + 2] & 255) << netbiasshift;
        j = contest(b, g, r);
        altersingle(alpha, j, b, g, r);
        if (rad !== 0) {
          alterneigh(rad, j, b, g, r);
        }
        pix += step;
        if (pix >= lim) {
          pix -= lengthcount;
        }
        i++;
        if (delta === 0) {
          delta = 1;
        }
        if (i % delta === 0) {
          alpha -= alpha / alphadec;
          radius -= radius / radiusdec;
          rad = radius >> radiusbiasshift;
          if (rad <= 1) {
            rad = 0;
          }
          for (j = 0; j < rad; j++) {
            radpower[j] = alpha * ((rad * rad - j * j) * radbias / (rad * rad));
          }
        }
      }
    }
    function map(b, g, r) {
      var i;
      var j;
      var dist;
      var a;
      var bestd;
      var p;
      var best;
      bestd = 1000;
      best = -1;
      i = netindex[g];
      j = i - 1;
      while (i < netsize || j >= 0) {
        if (i < netsize) {
          p = network[i];
          dist = p[1] - g;
          if (dist >= bestd) {
            i = netsize;
          } else {
            i++;
            if (dist < 0) {
              dist = -dist;
            }
            a = p[0] - b;
            if (a < 0) {
              a = -a;
            }
            dist += a;
            if (dist < bestd) {
              a = p[2] - r;
              if (a < 0) {
                a = -a;
              }
              dist += a;
              if (dist < bestd) {
                bestd = dist;
                best = p[3];
              }
            }
          }
        }
        if (j >= 0) {
          p = network[j];
          dist = g - p[1];
          if (dist >= bestd) {
            j = -1;
          } else {
            j--;
            if (dist < 0) {
              dist = -dist;
            }
            a = p[0] - b;
            if (a < 0) {
              a = -a;
            }
            dist += a;
            if (dist < bestd) {
              a = p[2] - r;
              if (a < 0) {
                a = -a;
              }
              dist += a;
              if (dist < bestd) {
                bestd = dist;
                best = p[3];
              }
            }
          }
        }
      }
      return best;
    }
    function process() {
      learn();
      unbiasnet();
      inxbuild();
      return colorMap();
    }
    function unbiasnet() {
      var i;
      var j;
      for (i = 0; i < netsize; i++) {
        network[i][0] >>= netbiasshift;
        network[i][1] >>= netbiasshift;
        network[i][2] >>= netbiasshift;
        network[i][3] = i;
      }
    }
    function alterneigh(rad, i, b, g, r) {
      var j;
      var k;
      var lo;
      var hi;
      var a;
      var m;
      var p;
      lo = i - rad;
      if (lo < -1) {
        lo = -1;
      }
      hi = i + rad;
      if (hi > netsize) {
        hi = netsize;
      }
      j = i + 1;
      k = i - 1;
      m = 1;
      while (j < hi || k > lo) {
        a = radpower[m++];
        if (j < hi) {
          p = network[j++];
          try {
            p[0] -= a * (p[0] - b) / alpharadbias | 0;
            p[1] -= a * (p[1] - g) / alpharadbias | 0;
            p[2] -= a * (p[2] - r) / alpharadbias | 0;
          } catch (e) {
          }
        }
        if (k > lo) {
          p = network[k--];
          try {
            p[0] -= a * (p[0] - b) / alpharadbias | 0;
            p[1] -= a * (p[1] - g) / alpharadbias | 0;
            p[2] -= a * (p[2] - r) / alpharadbias | 0;
          } catch (e) {
          }
        }
      }
    }
    function altersingle(alpha, i, b, g, r) {
      var n = network[i];
      var alphaMult = alpha / initalpha;
      n[0] -= alphaMult * (n[0] - b) | 0;
      n[1] -= alphaMult * (n[1] - g) | 0;
      n[2] -= alphaMult * (n[2] - r) | 0;
    }
    function contest(b, g, r) {
      var i;
      var dist;
      var a;
      var biasdist;
      var betafreq;
      var bestpos;
      var bestbiaspos;
      var bestd;
      var bestbiasd;
      var n;
      bestd = ~(1 << 31);
      bestbiasd = bestd;
      bestpos = -1;
      bestbiaspos = bestpos;
      for (i = 0; i < netsize; i++) {
        n = network[i];
        dist = n[0] - b;
        if (dist < 0) {
          dist = -dist;
        }
        a = n[1] - g;
        if (a < 0) {
          a = -a;
        }
        dist += a;
        a = n[2] - r;
        if (a < 0) {
          a = -a;
        }
        dist += a;
        if (dist < bestd) {
          bestd = dist;
          bestpos = i;
        }
        biasdist = dist - (bias[i] >> intbiasshift - netbiasshift);
        if (biasdist < bestbiasd) {
          bestbiasd = biasdist;
          bestbiaspos = i;
        }
        betafreq = freq[i] >> betashift;
        freq[i] -= betafreq;
        bias[i] += betafreq << gammashift;
      }
      freq[bestpos] += beta;
      bias[bestpos] -= betagamma;
      return bestbiaspos;
    }
    NeuQuantConstructor.apply(this, arguments);
    var exports = {};
    exports.map = map;
    exports.process = process;
    return exports;
  }
  return NeuQuant;
}();
processFrameWorker = function (NeuQuant) {
  var workerCode = function () {
    try {
      self.onmessage = function (ev) {
        var data = ev.data || {};
        var response;
        if (data.gifshot) {
          response = workerMethods.run(data);
          postMessage(response);
        }
      };
    } catch (e) {
    }
    var workerMethods = {
      'dataToRGB': function (data, width, height) {
        var i = 0, length = width * height * 4, rgb = [];
        while (i < length) {
          rgb.push(data[i++]);
          rgb.push(data[i++]);
          rgb.push(data[i++]);
          i++;
        }
        return rgb;
      },
      'componentizedPaletteToArray': function (paletteRGB) {
        var paletteArray = [], i, r, g, b;
        for (i = 0; i < paletteRGB.length; i += 3) {
          r = paletteRGB[i];
          g = paletteRGB[i + 1];
          b = paletteRGB[i + 2];
          paletteArray.push(r << 16 | g << 8 | b);
        }
        return paletteArray;
      },
      'processFrameWithQuantizer': function (imageData, width, height, sampleInterval) {
        var rgbComponents = this.dataToRGB(imageData, width, height), nq = new NeuQuant(rgbComponents, rgbComponents.length, sampleInterval), paletteRGB = nq.process(), paletteArray = new Uint32Array(this.componentizedPaletteToArray(paletteRGB)), numberPixels = width * height, indexedPixels = new Uint8Array(numberPixels), k = 0, i, r, g, b;
        for (i = 0; i < numberPixels; i++) {
          r = rgbComponents[k++];
          g = rgbComponents[k++];
          b = rgbComponents[k++];
          indexedPixels[i] = nq.map(r, g, b);
        }
        return {
          pixels: indexedPixels,
          palette: paletteArray
        };
      },
      'run': function (frame) {
        var width = frame.width, height = frame.height, imageData = frame.data, palette = frame.palette, sampleInterval = frame.sampleInterval;
        return this.processFrameWithQuantizer(imageData, width, height, sampleInterval);
      }
    };
    return workerMethods;
  };
  return workerCode;
}(NeuQuant);
gifWriter = function gifWriter(buf, width, height, gopts) {
  var p = 0;
  gopts = gopts === undefined ? {} : gopts;
  var loop_count = gopts.loop === undefined ? null : gopts.loop;
  var global_palette = gopts.palette === undefined ? null : gopts.palette;
  if (width <= 0 || height <= 0 || width > 65535 || height > 65535)
    throw 'Width/Height invalid.';
  function check_palette_and_num_colors(palette) {
    var num_colors = palette.length;
    if (num_colors < 2 || num_colors > 256 || num_colors & num_colors - 1)
      throw 'Invalid code/color length, must be power of 2 and 2 .. 256.';
    return num_colors;
  }
  buf[p++] = 71;
  buf[p++] = 73;
  buf[p++] = 70;
  buf[p++] = 56;
  buf[p++] = 57;
  buf[p++] = 97;
  var gp_num_colors_pow2 = 0;
  var background = 0;
  buf[p++] = width & 255;
  buf[p++] = width >> 8 & 255;
  buf[p++] = height & 255;
  buf[p++] = height >> 8 & 255;
  buf[p++] = (global_palette !== null ? 128 : 0) | gp_num_colors_pow2;
  buf[p++] = background;
  buf[p++] = 0;
  if (loop_count !== null) {
    if (loop_count < 0 || loop_count > 65535)
      throw 'Loop count invalid.';
    buf[p++] = 33;
    buf[p++] = 255;
    buf[p++] = 11;
    buf[p++] = 78;
    buf[p++] = 69;
    buf[p++] = 84;
    buf[p++] = 83;
    buf[p++] = 67;
    buf[p++] = 65;
    buf[p++] = 80;
    buf[p++] = 69;
    buf[p++] = 50;
    buf[p++] = 46;
    buf[p++] = 48;
    buf[p++] = 3;
    buf[p++] = 1;
    buf[p++] = loop_count & 255;
    buf[p++] = loop_count >> 8 & 255;
    buf[p++] = 0;
  }
  var ended = false;
  this.addFrame = function (x, y, w, h, indexed_pixels, opts) {
    if (ended === true) {
      --p;
      ended = false;
    }
    opts = opts === undefined ? {} : opts;
    if (x < 0 || y < 0 || x > 65535 || y > 65535)
      throw 'x/y invalid.';
    if (w <= 0 || h <= 0 || w > 65535 || h > 65535)
      throw 'Width/Height invalid.';
    if (indexed_pixels.length < w * h)
      throw 'Not enough pixels for the frame size.';
    var using_local_palette = true;
    var palette = opts.palette;
    if (palette === undefined || palette === null) {
      using_local_palette = false;
      palette = global_palette;
    }
    if (palette === undefined || palette === null)
      throw 'Must supply either a local or global palette.';
    var num_colors = check_palette_and_num_colors(palette);
    var min_code_size = 0;
    while (num_colors >>= 1)
      ++min_code_size;
    num_colors = 1 << min_code_size;
    var delay = opts.delay === undefined ? 0 : opts.delay;
    var disposal = opts.disposal === undefined ? 0 : opts.disposal;
    if (disposal < 0 || disposal > 3)
      throw 'Disposal out of range.';
    var use_transparency = false;
    var transparent_index = 0;
    if (opts.transparent !== undefined && opts.transparent !== null) {
      use_transparency = true;
      transparent_index = opts.transparent;
      if (transparent_index < 0 || transparent_index >= num_colors)
        throw 'Transparent color index.';
    }
    if (disposal !== 0 || use_transparency || delay !== 0) {
      buf[p++] = 33;
      buf[p++] = 249;
      buf[p++] = 4;
      buf[p++] = disposal << 2 | (use_transparency === true ? 1 : 0);
      buf[p++] = delay & 255;
      buf[p++] = delay >> 8 & 255;
      buf[p++] = transparent_index;
      buf[p++] = 0;
    }
    buf[p++] = 44;
    buf[p++] = x & 255;
    buf[p++] = x >> 8 & 255;
    buf[p++] = y & 255;
    buf[p++] = y >> 8 & 255;
    buf[p++] = w & 255;
    buf[p++] = w >> 8 & 255;
    buf[p++] = h & 255;
    buf[p++] = h >> 8 & 255;
    buf[p++] = using_local_palette === true ? 128 | min_code_size - 1 : 0;
    if (using_local_palette === true) {
      for (var i = 0, il = palette.length; i < il; ++i) {
        var rgb = palette[i];
        buf[p++] = rgb >> 16 & 255;
        buf[p++] = rgb >> 8 & 255;
        buf[p++] = rgb & 255;
      }
    }
    p = GifWriterOutputLZWCodeStream(buf, p, min_code_size < 2 ? 2 : min_code_size, indexed_pixels);
  };
  this.end = function () {
    if (ended === false) {
      buf[p++] = 59;
      ended = true;
    }
    return p;
  };
  function GifWriterOutputLZWCodeStream(buf, p, min_code_size, index_stream) {
    buf[p++] = min_code_size;
    var cur_subblock = p++;
    var clear_code = 1 << min_code_size;
    var code_mask = clear_code - 1;
    var eoi_code = clear_code + 1;
    var next_code = eoi_code + 1;
    var cur_code_size = min_code_size + 1;
    var cur_shift = 0;
    var cur = 0;
    function emit_bytes_to_buffer(bit_block_size) {
      while (cur_shift >= bit_block_size) {
        buf[p++] = cur & 255;
        cur >>= 8;
        cur_shift -= 8;
        if (p === cur_subblock + 256) {
          buf[cur_subblock] = 255;
          cur_subblock = p++;
        }
      }
    }
    function emit_code(c) {
      cur |= c << cur_shift;
      cur_shift += cur_code_size;
      emit_bytes_to_buffer(8);
    }
    var ib_code = index_stream[0] & code_mask;
    var code_table = {};
    emit_code(clear_code);
    for (var i = 1, il = index_stream.length; i < il; ++i) {
      var k = index_stream[i] & code_mask;
      var cur_key = ib_code << 8 | k;
      var cur_code = code_table[cur_key];
      if (cur_code === undefined) {
        cur |= ib_code << cur_shift;
        cur_shift += cur_code_size;
        while (cur_shift >= 8) {
          buf[p++] = cur & 255;
          cur >>= 8;
          cur_shift -= 8;
          if (p === cur_subblock + 256) {
            buf[cur_subblock] = 255;
            cur_subblock = p++;
          }
        }
        if (next_code === 4096) {
          emit_code(clear_code);
          next_code = eoi_code + 1;
          cur_code_size = min_code_size + 1;
          code_table = {};
        } else {
          if (next_code >= 1 << cur_code_size)
            ++cur_code_size;
          code_table[cur_key] = next_code++;
        }
        ib_code = k;
      } else {
        ib_code = cur_code;
      }
    }
    emit_code(ib_code);
    emit_code(eoi_code);
    emit_bytes_to_buffer(1);
    if (cur_subblock + 1 === p) {
      buf[cur_subblock] = 0;
    } else {
      buf[cur_subblock] = p - cur_subblock - 1;
      buf[p++] = 0;
    }
    return p;
  }
};
AnimatedGIF = function (utils, frameWorkerCode, NeuQuant, GifWriter) {
  var AnimatedGIF = function (options) {
    this.canvas = null;
    this.ctx = null;
    this.repeat = 0;
    this.frames = [];
    this.numRenderedFrames = 0;
    this.onRenderCompleteCallback = utils.noop;
    this.onRenderProgressCallback = utils.noop;
    this.workers = [];
    this.availableWorkers = [];
    this.generatingGIF = false;
    this.options = options;
    this.initializeWebWorkers(options);
  };
  AnimatedGIF.prototype = {
    'workerMethods': frameWorkerCode(),
    'initializeWebWorkers': function (options) {
      var processFrameWorkerCode = NeuQuant.toString() + '(' + frameWorkerCode.toString() + '());', webWorkerObj, objectUrl, webWorker, numWorkers, x = -1, workerError = '';
      numWorkers = options.numWorkers;
      while (++x < numWorkers) {
        webWorkerObj = utils.createWebWorker(processFrameWorkerCode);
        if (utils.isObject(webWorkerObj)) {
          objectUrl = webWorkerObj.objectUrl;
          webWorker = webWorkerObj.worker;
          this.workers.push({
            'worker': webWorker,
            'objectUrl': objectUrl
          });
          this.availableWorkers.push(webWorker);
        } else {
          workerError = webWorkerObj;
          utils.webWorkerError = !!webWorkerObj;
        }
      }
      this.workerError = workerError;
      this.canvas = document.createElement('canvas');
      this.canvas.width = options.gifWidth;
      this.canvas.height = options.gifHeight;
      this.ctx = this.canvas.getContext('2d');
      this.frames = [];
    },
    'getWorker': function () {
      return this.availableWorkers.pop();
    },
    'freeWorker': function (worker) {
      this.availableWorkers.push(worker);
    },
    'byteMap': function () {
      var byteMap = [];
      for (var i = 0; i < 256; i++) {
        byteMap[i] = String.fromCharCode(i);
      }
      return byteMap;
    }(),
    'bufferToString': function (buffer) {
      var numberValues = buffer.length, str = '', x = -1;
      while (++x < numberValues) {
        str += this.byteMap[buffer[x]];
      }
      return str;
    },
    'onFrameFinished': function (progressCallback) {
      var self = this, frames = self.frames, options = self.options;
      hasExistingImages = !!(options.images || []).length;
      allDone = frames.every(function (frame) {
        return !frame.beingProcessed && frame.done;
      });
      self.numRenderedFrames++;
      if (hasExistingImages) {
        progressCallback(self.numRenderedFrames / frames.length);
      }
      self.onRenderProgressCallback(self.numRenderedFrames * 0.75 / frames.length);
      if (allDone) {
        if (!self.generatingGIF) {
          self.generateGIF(frames, self.onRenderCompleteCallback);
        }
      } else {
        utils.requestTimeout(function () {
          self.processNextFrame();
        }, 1);
      }
    },
    'processFrame': function (position) {
      var AnimatedGifContext = this, options = this.options, progressCallback = options.progressCallback, sampleInterval = options.sampleInterval, frames = this.frames, frame, worker, done = function (ev) {
          var data = ev.data;
          delete frame.data;
          frame.pixels = Array.prototype.slice.call(data.pixels);
          frame.palette = Array.prototype.slice.call(data.palette);
          frame.done = true;
          frame.beingProcessed = false;
          AnimatedGifContext.freeWorker(worker);
          AnimatedGifContext.onFrameFinished(progressCallback);
        };
      frame = frames[position];
      if (frame.beingProcessed || frame.done) {
        this.onFrameFinished();
        return;
      }
      frame.sampleInterval = sampleInterval;
      frame.beingProcessed = true;
      frame.gifshot = true;
      worker = this.getWorker();
      if (worker) {
        worker.onmessage = done;
        worker.postMessage(frame);
      } else {
        done({ 'data': AnimatedGifContext.workerMethods.run(frame) });
      }
    },
    'startRendering': function (completeCallback) {
      this.onRenderCompleteCallback = completeCallback;
      for (var i = 0; i < this.options.numWorkers && i < this.frames.length; i++) {
        this.processFrame(i);
      }
    },
    'processNextFrame': function () {
      var position = -1;
      for (var i = 0; i < this.frames.length; i++) {
        var frame = this.frames[i];
        if (!frame.done && !frame.beingProcessed) {
          position = i;
          break;
        }
      }
      if (position >= 0) {
        this.processFrame(position);
      }
    },
    'generateGIF': function (frames, callback) {
      var buffer = [], gifOptions = { 'loop': this.repeat }, options = this.options, interval = options.interval, existingImages = options.images, hasExistingImages = !!existingImages.length, height = options.gifHeight, width = options.gifWidth, gifWriter = new GifWriter(buffer, width, height, gifOptions), onRenderProgressCallback = this.onRenderProgressCallback, delay = hasExistingImages ? interval * 100 : 0, bufferToString, gif;
      this.generatingGIF = true;
      utils.each(frames, function (iterator, frame) {
        var framePalette = frame.palette;
        onRenderProgressCallback(0.75 + 0.25 * frame.position * 1 / frames.length);
        gifWriter.addFrame(0, 0, width, height, frame.pixels, {
          palette: framePalette,
          delay: delay
        });
      });
      gifWriter.end();
      onRenderProgressCallback(1);
      this.frames = [];
      this.generatingGIF = false;
      if (utils.isFunction(callback)) {
        bufferToString = this.bufferToString(buffer);
        gif = 'data:image/gif;base64,' + utils.btoa(bufferToString);
        callback(gif);
      }
    },
    'setRepeat': function (r) {
      this.repeat = r;
    },
    'addFrame': function (element, gifshotOptions) {
      gifshotOptions = utils.isObject(gifshotOptions) ? gifshotOptions : {};
      var self = this, ctx = self.ctx, options = self.options, width = options.gifWidth, height = options.gifHeight, gifHeight = gifshotOptions.gifHeight, gifWidth = gifshotOptions.gifWidth, text = gifshotOptions.text, fontWeight = gifshotOptions.fontWeight, fontSize = utils.getFontSize(gifshotOptions), fontFamily = gifshotOptions.fontFamily, fontColor = gifshotOptions.fontColor, textAlign = gifshotOptions.textAlign, textBaseline = gifshotOptions.textBaseline, textXCoordinate = gifshotOptions.textXCoordinate ? gifshotOptions.textXCoordinate : textAlign === 'left' ? 1 : textAlign === 'right' ? width : width / 2, textYCoordinate = gifshotOptions.textYCoordinate ? gifshotOptions.textYCoordinate : textBaseline === 'top' ? 1 : textBaseline === 'center' ? height / 2 : height, font = fontWeight + ' ' + fontSize + ' ' + fontFamily, imageData;
      try {
        ctx.drawImage(element, 0, 0, width, height);
        if (text) {
          ctx.font = font;
          ctx.fillStyle = fontColor;
          ctx.textAlign = textAlign;
          ctx.textBaseline = textBaseline;
          ctx.fillText(text, textXCoordinate, textYCoordinate);
        }
        imageData = ctx.getImageData(0, 0, width, height);
        self.addFrameImageData(imageData);
      } catch (e) {
        return '' + e;
      }
    },
    'addFrameImageData': function (imageData) {
      var frames = this.frames, imageDataArray = imageData.data;
      this.frames.push({
        'data': imageDataArray,
        'width': imageData.width,
        'height': imageData.height,
        'palette': null,
        'dithering': null,
        'done': false,
        'beingProcessed': false,
        'position': frames.length
      });
    },
    'onRenderProgress': function (callback) {
      this.onRenderProgressCallback = callback;
    },
    'isRendering': function () {
      return this.generatingGIF;
    },
    'getBase64GIF': function (completeCallback) {
      var self = this, onRenderComplete = function (gif) {
          self.destroyWorkers();
          utils.requestTimeout(function () {
            completeCallback(gif);
          }, 0);
        };
      self.startRendering(onRenderComplete);
    },
    'destroyWorkers': function () {
      if (this.workerError) {
        return;
      }
      var workers = this.workers;
      utils.each(workers, function (iterator, workerObj) {
        var worker = workerObj.worker, objectUrl = workerObj.objectUrl;
        worker.terminate();
        utils.URL.revokeObjectURL(objectUrl);
      });
    }
  };
  return AnimatedGIF;
}(utils, processFrameWorker, NeuQuant, gifWriter);
getBase64GIF = function getBase64GIF(animatedGifInstance, callback) {
  animatedGifInstance.getBase64GIF(function (image) {
    callback({
      'error': false,
      'errorCode': '',
      'errorMsg': '',
      'image': image
    });
  });
};
existingImages = function (obj) {
  var images = obj.images, imagesLength = obj.imagesLength, callback = obj.callback, options = obj.options, skipObj = {
      'getUserMedia': true,
      'window.URL': true
    }, errorObj = error.validate(skipObj), loadedImages = [], loadedImagesLength = 0, tempImage, ag;
  if (errorObj.error) {
    return callback(errorObj);
  }
  ag = new AnimatedGIF(options);
  utils.each(images, function (index, currentImage) {
    if (utils.isElement(currentImage)) {
      if (options.crossOrigin) {
        currentImage.crossOrigin = options.crossOrigin;
      }
      loadedImages[index] = currentImage;
      loadedImagesLength += 1;
      if (loadedImagesLength === imagesLength) {
        addLoadedImagesToGif();
      }
    } else if (utils.isString(currentImage)) {
      tempImage = document.createElement('img');
      if (options.crossOrigin) {
        tempImage.crossOrigin = options.crossOrigin;
      }
      tempImage.onerror = function (e) {
        if (loadedImages.length > index) {
          loadedImages[index] = undefined;
        }
      }(function (tempImage) {
        tempImage.onload = function () {
          loadedImages[index] = tempImage;
          loadedImagesLength += 1;
          if (loadedImagesLength === imagesLength) {
            addLoadedImagesToGif();
          }
          utils.removeElement(tempImage);
        };
      }(tempImage));
      tempImage.src = currentImage;
      utils.setCSSAttr(tempImage, {
        'position': 'fixed',
        'opacity': '0'
      });
      document.body.appendChild(tempImage);
    }
  });
  function addLoadedImagesToGif() {
    utils.each(loadedImages, function (index, loadedImage) {
      if (loadedImage) {
        ag.addFrame(loadedImage, options);
      }
    });
    getBase64GIF(ag, callback);
  }
};
screenShot = {
  getGIF: function (options, callback) {
    callback = utils.isFunction(callback) ? callback : utils.noop;
    var canvas = document.createElement('canvas'), context, existingImages = options.images, hasExistingImages = !!existingImages.length, videoElement = options.videoElement, gifWidth = +options.gifWidth, gifHeight = +options.gifHeight, videoWidth = options.videoWidth, videoHeight = options.videoHeight, sampleInterval = +options.sampleInterval, numWorkers = +options.numWorkers, crop = options.crop, interval = +options.interval, waitBetweenFrames = hasExistingImages ? 0 : interval * 1000, progressCallback = options.progressCallback, savedRenderingContexts = options.savedRenderingContexts, saveRenderingContexts = options.saveRenderingContexts, renderingContextsToSave = [], numFrames = savedRenderingContexts.length ? savedRenderingContexts.length : options.numFrames, pendingFrames = numFrames, ag = new AnimatedGIF(options), text = options.text, fontWeight = options.fontWeight, fontSize = utils.getFontSize(options), fontFamily = options.fontFamily, fontColor = options.fontColor, textAlign = options.textAlign, textBaseline = options.textBaseline, textXCoordinate = options.textXCoordinate ? options.textXCoordinate : textAlign === 'left' ? 1 : textAlign === 'right' ? gifWidth : gifWidth / 2, textYCoordinate = options.textYCoordinate ? options.textYCoordinate : textBaseline === 'top' ? 1 : textBaseline === 'center' ? gifHeight / 2 : gifHeight, font = fontWeight + ' ' + fontSize + ' ' + fontFamily, sourceX = crop ? Math.floor(crop.scaledWidth / 2) : 0, sourceWidth = crop ? videoWidth - crop.scaledWidth : 0, sourceY = crop ? Math.floor(crop.scaledHeight / 2) : 0, sourceHeight = crop ? videoHeight - crop.scaledHeight : 0, captureFrames = function captureFrame() {
        var framesLeft = pendingFrames - 1;
        if (savedRenderingContexts.length) {
          context.putImageData(savedRenderingContexts[numFrames - pendingFrames], 0, 0);
          finishCapture();
        } else {
          drawVideo();
        }
        function drawVideo() {
          try {
            if (sourceWidth > videoWidth) {
              sourceWidth = videoWidth;
            }
            if (sourceHeight > videoHeight) {
              sourceHeight = videoHeight;
            }
            if (sourceX < 0) {
              sourceX = 0;
            }
            if (sourceY < 0) {
              sourceY = 0;
            }
            context.drawImage(videoElement, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, gifWidth, gifHeight);
            finishCapture();
          } catch (e) {
            if (e.name === 'NS_ERROR_NOT_AVAILABLE') {
              utils.requestTimeout(drawVideo, 100);
            } else {
              throw e;
            }
          }
        }
        function finishCapture() {
          pendingFrames = framesLeft;
          var processedFrames = numFrames - pendingFrames;
          var imageData;
          var data;
          var rgba;
          var isBlackFrame;
          if (saveRenderingContexts) {
            renderingContextsToSave.push(context.getImageData(0, 0, gifWidth, gifHeight));
          }
          if (text) {
            context.font = font;
            context.fillStyle = fontColor;
            context.textAlign = textAlign;
            context.textBaseline = textBaseline;
            context.fillText(text, textXCoordinate, textYCoordinate);
          }
          imageData = context.getImageData(0, 0, gifWidth, gifHeight);
          data = imageData.data;
          rgba = data[0] + data[1] + data[2] + data[3];
          isBlackFrame = rgba === 0;
          if (!isBlackFrame) {
            ag.addFrameImageData(imageData);
          } else if (processedFrames === 1 && numFrames === 1) {
            drawVideo();
          }
          progressCallback(processedFrames / numFrames);
          if (framesLeft > 0) {
            utils.requestTimeout(captureFrame, waitBetweenFrames);
          }
          if (!pendingFrames) {
            ag.getBase64GIF(function (image) {
              callback({
                'error': false,
                'errorCode': '',
                'errorMsg': '',
                'image': image,
                'videoElement': videoElement,
                'savedRenderingContexts': renderingContextsToSave
              });
            });
          }
        }
      };
    numFrames = numFrames != null ? numFrames : 10;
    interval = interval != null ? interval : 0.1;
    canvas.width = gifWidth;
    canvas.height = gifHeight;
    context = canvas.getContext('2d');
    (function capture() {
      if (!savedRenderingContexts.length && videoElement.currentTime === 0) {
        utils.requestTimeout(capture, 100);
        return;
      }
      captureFrames();
    }());
  },
  'getCropDimensions': function (obj) {
    var width = obj.videoWidth, height = obj.videoHeight, gifWidth = obj.gifWidth, gifHeight = obj.gifHeight, result = {
        width: 0,
        height: 0,
        scaledWidth: 0,
        scaledHeight: 0
      };
    if (width > height) {
      result.width = Math.round(width * (gifHeight / height)) - gifWidth;
      result.scaledWidth = Math.round(result.width * (height / gifHeight));
    } else {
      result.height = Math.round(height * (gifWidth / width)) - gifHeight;
      result.scaledHeight = Math.round(result.height * (width / gifWidth));
    }
    return result;
  }
};

createGIF = function (userOptions, callback) {
  callback = utils.isFunction(userOptions) ? userOptions : callback;
  userOptions = utils.isObject(userOptions) ? userOptions : {};
  if (!utils.isFunction(callback)) {
    return;
  }
  var options = utils.mergeOptions(defaultOptions, userOptions) || {}, images = options.images, imagesLength = images ? images.length : 0;
  options = utils.mergeOptions(options, {
    'gifWidth': Math.floor(options.gifWidth),
    'gifHeight': Math.floor(options.gifHeight)
  });
  if (imagesLength) {
    existingImages({
      'images': images,
      'imagesLength': imagesLength,
      'callback': callback,
      'options': options
    });
  } else {
    throw new Error('Requires an array of images!');
  }
};

API = function (utils, error, defaultOptions, isSupported, isExistingImagesGIFSupported, createGIF) {
  var gifshot = {
    'utils': utils,
    'error': error,
    'defaultOptions': defaultOptions,
    'createGIF': createGIF,
    'isSupported': isSupported,
    'isExistingImagesGIFSupported': isExistingImagesGIFSupported
  };
  return gifshot;
}(utils, error, defaultOptions, isSupported, isExistingImagesGIFSupported, createGIF);

(function (API) {
  if (typeof define === 'function' && define.amd) {
    define([], function () {
      return API;
    });
  } else if (typeof exports !== 'undefined') {
    module.exports = API;
  } else {
    if(!window.SuperGif) {
      window.SuperGif = {};
    }
    window.SuperGif.encoder = API;
  }
}(API));
}(typeof window !== "undefined" ? window : {}, typeof document !== "undefined" ? document : { createElement: function() {} }, typeof window !== "undefined" ? window.navigator : {}));

/*
  Simplified version of Buzzfeed's libgif-js library, used for decoding frames with the added benefit of drawing to a visible canvas.
  https://github.com/buzzfeed/libgif-js
*/
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        if(!root.SuperGif) {
          root.SuperGif = {};
        }
        root.SuperGif.decoder = factory();
    }
}(this, function () {
    // Generic functions
    var bitsToNum = function (ba) {
        return ba.reduce(function (s, n) {
            return s * 2 + n;
        }, 0);
    };

    var byteToBitArr = function (bite) {
        var a = [];
        for (var i = 7; i >= 0; i--) {
            a.push( !! (bite & (1 << i)));
        }
        return a;
    };

    // Stream
    /**
     * @constructor
     */
    // Make compiler happy.
    var Stream = function (data) {
        this.data = data;
        this.len = this.data.length;
        this.pos = 0;

        this.readByte = function () {
            if (this.pos >= this.data.length) {
                throw new Error('Attempted to read past end of stream.');
            }
            if (data instanceof Uint8Array)
                return data[this.pos++];
            else
                return data.charCodeAt(this.pos++) & 0xFF;
        };

        this.readBytes = function (n) {
            var bytes = [];
            for (var i = 0; i < n; i++) {
                bytes.push(this.readByte());
            }
            return bytes;
        };

        this.read = function (n) {
            var s = '';
            for (var i = 0; i < n; i++) {
                s += String.fromCharCode(this.readByte());
            }
            return s;
        };

        this.readUnsigned = function () { // Little-endian.
            var a = this.readBytes(2);
            return (a[1] << 8) + a[0];
        };
    };

    var lzwDecode = function (minCodeSize, data) {
        // TODO: Now that the GIF parser is a bit different, maybe this should get an array of bytes instead of a String?
        var pos = 0; // Maybe this streaming thing should be merged with the Stream?
        var readCode = function (size) {
            var code = 0;
            for (var i = 0; i < size; i++) {
                if (data.charCodeAt(pos >> 3) & (1 << (pos & 7))) {
                    code |= 1 << i;
                }
                pos++;
            }
            return code;
        };

        var output = [];

        var clearCode = 1 << minCodeSize;
        var eoiCode = clearCode + 1;

        var codeSize = minCodeSize + 1;

        var dict = [];

        var clear = function () {
            dict = [];
            codeSize = minCodeSize + 1;
            for (var i = 0; i < clearCode; i++) {
                dict[i] = [i];
            }
            dict[clearCode] = [];
            dict[eoiCode] = null;

        };

        var code;
        var last;

        while (true) {
            last = code;
            code = readCode(codeSize);

            if (code === clearCode) {
                clear();
                continue;
            }
            if (code === eoiCode) break;

            if (code < dict.length) {
                if (last !== clearCode) {
                    dict.push(dict[last].concat(dict[code][0]));
                }
            }
            else {
                if (code !== dict.length) throw new Error('Invalid LZW code.');
                dict.push(dict[last].concat(dict[last][0]));
            }
            output.push.apply(output, dict[code]);

            if (dict.length === (1 << codeSize) && codeSize < 12) {
                // If we're at the last code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
                codeSize++;
            }
        }

        // I don't know if this is technically an error, but some GIFs do it.
        //if (Math.ceil(pos / 8) !== data.length) throw new Error('Extraneous LZW bytes.');
        return output;
    };


    // The actual parsing; returns an object with properties.
    var parseGIF = function (st, handler) {
        handler || (handler = {});

        // LZW (GIF-specific)
        var parseCT = function (entries) { // Each entry is 3 bytes, for RGB.
            var ct = [];
            for (var i = 0; i < entries; i++) {
                ct.push(st.readBytes(3));
            }
            return ct;
        };

        var readSubBlocks = function () {
            var size, data;
            data = '';
            do {
                size = st.readByte();
                data += st.read(size);
            } while (size !== 0);
            return data;
        };

        var parseHeader = function () {
            var hdr = {};
            hdr.sig = st.read(3);
            hdr.ver = st.read(3);
            if (hdr.sig !== 'GIF') throw new Error('Not a GIF file.'); // XXX: This should probably be handled more nicely.
            hdr.width = st.readUnsigned();
            hdr.height = st.readUnsigned();

            var bits = byteToBitArr(st.readByte());
            hdr.gctFlag = bits.shift();
            hdr.colorRes = bitsToNum(bits.splice(0, 3));
            hdr.sorted = bits.shift();
            hdr.gctSize = bitsToNum(bits.splice(0, 3));

            hdr.bgColor = st.readByte();
            hdr.pixelAspectRatio = st.readByte(); // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
            if (hdr.gctFlag) {
                hdr.gct = parseCT(1 << (hdr.gctSize + 1));
            }
            handler.hdr && handler.hdr(hdr);
        };

        var parseExt = function (block) {
            var parseGCExt = function (block) {
                var blockSize = st.readByte(); // Always 4
                var bits = byteToBitArr(st.readByte());
                block.reserved = bits.splice(0, 3); // Reserved; should be 000.
                block.disposalMethod = bitsToNum(bits.splice(0, 3));
                block.userInput = bits.shift();
                block.transparencyGiven = bits.shift();

                block.delayTime = st.readUnsigned();

                block.transparencyIndex = st.readByte();

                block.terminator = st.readByte();

                handler.gce && handler.gce(block);
            };

            var parseComExt = function (block) {
                block.comment = readSubBlocks();
                handler.com && handler.com(block);
            };

            var parsePTExt = function (block) {
                // No one *ever* uses this. If you use it, deal with parsing it yourself.
                var blockSize = st.readByte(); // Always 12
                block.ptHeader = st.readBytes(12);
                block.ptData = readSubBlocks();
                handler.pte && handler.pte(block);
            };

            var parseAppExt = function (block) {
                var parseNetscapeExt = function (block) {
                    var blockSize = st.readByte(); // Always 3
                    block.unknown = st.readByte(); // ??? Always 1? What is this?
                    block.iterations = st.readUnsigned();
                    block.terminator = st.readByte();
                    handler.app && handler.app.NETSCAPE && handler.app.NETSCAPE(block);
                };

                var parseUnknownAppExt = function (block) {
                    block.appData = readSubBlocks();
                    // FIXME: This won't work if a handler wants to match on any identifier.
                    handler.app && handler.app[block.identifier] && handler.app[block.identifier](block);
                };

                var blockSize = st.readByte(); // Always 11
                block.identifier = st.read(8);
                block.authCode = st.read(3);
                switch (block.identifier) {
                    case 'NETSCAPE':
                        parseNetscapeExt(block);
                        break;
                    default:
                        parseUnknownAppExt(block);
                        break;
                }
            };

            var parseUnknownExt = function (block) {
                block.data = readSubBlocks();
                handler.unknown && handler.unknown(block);
            };

            block.label = st.readByte();
            switch (block.label) {
                case 0xF9:
                    block.extType = 'gce';
                    parseGCExt(block);
                    break;
                case 0xFE:
                    block.extType = 'com';
                    parseComExt(block);
                    break;
                case 0x01:
                    block.extType = 'pte';
                    parsePTExt(block);
                    break;
                case 0xFF:
                    block.extType = 'app';
                    parseAppExt(block);
                    break;
                default:
                    block.extType = 'unknown';
                    parseUnknownExt(block);
                    break;
            }
        };

        var parseImg = function (img) {
            var deinterlace = function (pixels, width) {
                // Of course this defeats the purpose of interlacing. And it's *probably*
                // the least efficient way it's ever been implemented. But nevertheless...
                var newPixels = new Array(pixels.length);
                var rows = pixels.length / width;
                var cpRow = function (toRow, fromRow) {
                    var fromPixels = pixels.slice(fromRow * width, (fromRow + 1) * width);
                    newPixels.splice.apply(newPixels, [toRow * width, width].concat(fromPixels));
                };

                // See appendix E.
                var offsets = [0, 4, 2, 1];
                var steps = [8, 8, 4, 2];

                var fromRow = 0;
                for (var pass = 0; pass < 4; pass++) {
                    for (var toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
                        cpRow(toRow, fromRow)
                        fromRow++;
                    }
                }

                return newPixels;
            };

            img.leftPos = st.readUnsigned();
            img.topPos = st.readUnsigned();
            img.width = st.readUnsigned();
            img.height = st.readUnsigned();

            var bits = byteToBitArr(st.readByte());
            img.lctFlag = bits.shift();
            img.interlaced = bits.shift();
            img.sorted = bits.shift();
            img.reserved = bits.splice(0, 2);
            img.lctSize = bitsToNum(bits.splice(0, 3));

            if (img.lctFlag) {
                img.lct = parseCT(1 << (img.lctSize + 1));
            }

            img.lzwMinCodeSize = st.readByte();

            var lzwData = readSubBlocks();

            img.pixels = lzwDecode(img.lzwMinCodeSize, lzwData);

            if (img.interlaced) { // Move
                img.pixels = deinterlace(img.pixels, img.width);
            }

            handler.img && handler.img(img);
        };

        var parseBlock = function () {
            var block = {};
            block.sentinel = st.readByte();

            switch (String.fromCharCode(block.sentinel)) { // For ease of matching
                case '!':
                    block.type = 'ext';
                    parseExt(block);
                    break;
                case ',':
                    block.type = 'img';
                    parseImg(block);
                    break;
                case ';':
                    block.type = 'eof';
                    handler.eof && handler.eof(block);
                    break;
                default:
                    throw new Error('Unknown block: 0x' + block.sentinel.toString(16)); // TODO: Pad this with a 0.
            }

            if (block.type !== 'eof') setTimeout(parseBlock, 0);
        };

        var parse = function () {
            parseHeader();
            setTimeout(parseBlock, 0);
        };

        parse();
    };

    var SuperGif = function ( opts ) {
        var options = {
            //viewport position
            vp_l: 0,
            vp_t: 0,
            vp_w: null,
            vp_h: null,
            //canvas sizes
            c_w: null,
            c_h: null
        };
        for (var i in opts ) { options[i] = opts[i] }
        if (options.vp_w && options.vp_h) options.is_vp = true;

        var stream;
        var hdr;

        var loadError = null;
        var loading = false;

        var transparency = null;
        var delay = null;
        var disposalMethod = null;
        var disposalRestoreFromIdx = null;
        var lastDisposalMethod = null;
        var frame = null;
        var lastImg = null;

        var playing = true;
        var forward = true;

        var ctx_scaled = false;

        var frames = [];
        var frameOffsets = []; // elements have .x and .y properties

        var gif = options.gif;
        if (typeof options.auto_play == 'undefined')
            options.auto_play = (!gif.getAttribute('rel:auto_play') || gif.getAttribute('rel:auto_play') == '1');

        var onEndListener = (options.hasOwnProperty('on_end') ? options.on_end : null);
        var loopDelay = (options.hasOwnProperty('loop_delay') ? options.loop_delay : 0);
        var overrideLoopMode = (options.hasOwnProperty('loop_mode') ? options.loop_mode : 'auto');
        var drawWhileLoading = (options.hasOwnProperty('draw_while_loading') ? options.draw_while_loading : true);

        var clear = function () {
            transparency = null;
            delay = null;
            lastDisposalMethod = disposalMethod;
            disposalMethod = null;
            frame = null;
        };

        // XXX: There's probably a better way to handle catching exceptions when
        // callbacks are involved.
        var doParse = function () {
            try {
                parseGIF(stream, handler);
            }
            catch (err) {}
        };

        var setSizes = function(w, h) {
            if(!options.drawImageWith) {
                canvas.width = w * get_canvas_scale();
                canvas.height = h * get_canvas_scale();
            }
            tmpCanvas.width = w;
            tmpCanvas.height = h;
            tmpCanvas.style.width = w + 'px';
            tmpCanvas.style.height = h + 'px';
            tmpCanvas.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
        };

        var setFrameOffset = function(frame, offset) {
            if (!frameOffsets[frame]) {
                frameOffsets[frame] = offset;
                return;
            }
            if (typeof offset.x !== 'undefined') {
                frameOffsets[frame].x = offset.x;
            }
            if (typeof offset.y !== 'undefined') {
                frameOffsets[frame].y = offset.y;
            }
        };

        var doHdr = function (_hdr) {
            hdr = _hdr;
            setSizes(hdr.width, hdr.height)
        };

        var doGCE = function (gce) {
            pushFrame();
            clear();
            transparency = gce.transparencyGiven ? gce.transparencyIndex : null;
            delay = gce.delayTime;
            disposalMethod = gce.disposalMethod;
            // We don't have much to do with the rest of GCE.
        };

        var pushFrame = function () {
            if (!frame) return;
            frames.push({
                            data: frame.getImageData(0, 0, hdr.width, hdr.height),
                            delay: delay
                        });
            frameOffsets.push({ x: 0, y: 0 });
        };

        var doImg = function (img) {
            if (!frame) frame = tmpCanvas.getContext('2d');

            var currIdx = frames.length;

            //ct = color table, gct = global color table
            var ct = img.lctFlag ? img.lct : hdr.gct; // TODO: What if neither exists?

            /*
            Disposal method indicates the way in which the graphic is to
            be treated after being displayed.

            Values :    0 - No disposal specified. The decoder is
                            not required to take any action.
                        1 - Do not dispose. The graphic is to be left
                            in place.
                        2 - Restore to background color. The area used by the
                            graphic must be restored to the background color.
                        3 - Restore to previous. The decoder is required to
                            restore the area overwritten by the graphic with
                            what was there prior to rendering the graphic.

                            Importantly, "previous" means the frame state
                            after the last disposal of method 0, 1, or 2.
            */
            if (currIdx > 0) {
                if (lastDisposalMethod === 3) {
                    // Restore to previous
                    // If we disposed every frame including first frame up to this point, then we have
                    // no composited frame to restore to. In this case, restore to background instead.
                    if (disposalRestoreFromIdx !== null) {
                    	frame.putImageData(frames[disposalRestoreFromIdx].data, 0, 0);
                    } else {
                        frame.clearRect(lastImg.leftPos, lastImg.topPos, lastImg.width, lastImg.height);
                    }
                } else {
                    disposalRestoreFromIdx = currIdx - 1;
                }

                if (lastDisposalMethod === 2) {
                    // Restore to background color
                    // Browser implementations historically restore to transparent; we do the same.
                    // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
                    frame.clearRect(lastImg.leftPos, lastImg.topPos, lastImg.width, lastImg.height);
                }
            }
            // else, Undefined/Do not dispose.
            // frame contains final pixel data from the last frame; do nothing

            //Get existing pixels for img region after applying disposal method
            var imgData = frame.getImageData(img.leftPos, img.topPos, img.width, img.height);

            //apply color table colors
            img.pixels.forEach(function (pixel, i) {
                // imgData.data === [R,G,B,A,R,G,B,A,...]
                if (pixel !== transparency) {
                    imgData.data[i * 4 + 0] = ct[pixel][0];
                    imgData.data[i * 4 + 1] = ct[pixel][1];
                    imgData.data[i * 4 + 2] = ct[pixel][2];
                    imgData.data[i * 4 + 3] = 255; // Opaque.
                }
            });

            frame.putImageData(imgData, img.leftPos, img.topPos);

            if (!ctx_scaled) {
                ctx.scale(get_canvas_scale(),get_canvas_scale());
                ctx_scaled = true;
            }

            // We could use the on-page canvas directly, except that we draw a progress
            // bar for each image chunk (not just the final image).
            lastImg = img;
        };

        var player = (function () {
            var i = -1;
            var iterationCount = 0;

            var showingInfo = false;
            var pinned = false;

            /**
             * Gets the index of the frame "up next".
             * @returns {number}
             */
            var getNextFrameNo = function () {
                var delta = (forward ? 1 : -1);
                return (i + delta + frames.length) % frames.length;
            };

            var stepFrame = function (amount) { // XXX: Name is confusing.
                i = i + amount;

                putFrame();
            };

            var step = (function () {
                var stepping = false;

                var completeLoop = function () {
                    if (onEndListener !== null)
                        onEndListener(gif);
                    iterationCount++;

                    if (overrideLoopMode !== false || iterationCount < 0) {
                        doStep();
                    } else {
                        stepping = false;
                        playing = false;
                    }
                };

                var doStep = function () {
                    stepping = playing;
                    if (!stepping) return;

                    stepFrame(1);
                    var delay = frames[i].delay * 10;
                    if (!delay) delay = 100; // FIXME: Should this even default at all? What should it be?

                    var nextFrameNo = getNextFrameNo();
                    if (nextFrameNo === 0) {
                        delay += loopDelay;
                        setTimeout(completeLoop, delay);
                    } else {
                        setTimeout(doStep, delay);
                    }
                };

                return function () {
                    if (!stepping) setTimeout(doStep, 0);
                };
            }());

            var putFrame = function () {
                var offset;
                i = parseInt(i, 10);

                if (i > frames.length - 1){
                    i = 0;
                }

                if (i < 0){
                    i = 0;
                }

                offset = frameOffsets[i];

                tmpCanvas.getContext("2d").putImageData(frames[i].data, offset.x, offset.y);
                if(!options.drawImageWith) {
                    ctx.globalCompositeOperation = "copy";
                    ctx.drawImage(tmpCanvas, 0, 0);
                } else {
                    var placement = options.drawImageWith;
                    ctx.drawImage(tmpCanvas, placement.sx, placement.sy, placement.swidth, placement.sheight, placement.x, placement.y, placement.width, placement.height);
                }
            };

            var play = function () {
                playing = true;
                step();
            };

            var pause = function () {
                playing = false;
            };


            return {
                init: function () {
                    if (loadError) return;

                    if ( ! (options.c_w && options.c_h) ) {
                        ctx.scale(get_canvas_scale(),get_canvas_scale());
                    }

                    if (options.auto_play) {
                        step();
                    }
                    else {
                        i = 0;
                        putFrame();
                    }
                },
                step: step,
                play: play,
                pause: pause,
                playing: playing,
                move_relative: stepFrame,
                current_frame: function() { return i; },
                length: function() { return frames.length },
                move_to: function ( frame_idx ) {
                    i = frame_idx;
                    putFrame();
                }
            }
        }());

        var doDecodeProgress = function (draw) {};

        var doNothing = function () {};
        /**
         * @param{boolean=} draw Whether to draw progress bar or not; this is not idempotent because of translucency.
         *                       Note that this means that the text will be unsynchronized with the progress bar on non-frames;
         *                       but those are typically so small (GCE etc.) that it doesn't really matter. TODO: Do this properly.
         */
        var withProgress = function (fn, draw) {
            return function (block) {
                fn(block);
                doDecodeProgress(draw);
            };
        };


        var handler = {
            hdr: withProgress(doHdr),
            gce: withProgress(doGCE),
            com: withProgress(doNothing),
            // I guess that's all for now.
            app: {
                // TODO: Is there much point in actually supporting iterations?
                NETSCAPE: withProgress(doNothing)
            },
            img: withProgress(doImg, true),
            eof: function (block) {
                pushFrame();
                doDecodeProgress(false);
                if ( ! (options.c_w && options.c_h) && !options.canvas ) {
                    canvas.width = hdr.width * get_canvas_scale();
                    canvas.height = hdr.height * get_canvas_scale();
                }
                player.init();
                loading = false;
                if (load_callback) {
                    load_callback(gif);
                }

            }
        };

        var init = function () {
            var parent = gif.parentNode;
            if(options.canvas) {
                canvas = options.canvas;
            } else {
                canvas = document.createElement('canvas');
            }
            ctx = canvas.getContext('2d');
            tmpCanvas = document.createElement('canvas');

            if(!options.drawImageWith) {
                var div = document.createElement('div');
                div.className = 'jsgif';
                div.width = canvas.width = gif.width;
                div.height = canvas.height = gif.height;
                div.appendChild(canvas);
            }

            if(parent && !options.drawImageWith) {
                parent.insertBefore(div, gif);
                parent.removeChild(gif);
            }

            if (options.c_w && options.c_h) setSizes(options.c_w, options.c_h);
            initialized=true;
        };

        var get_canvas_scale = function() {
            var scale;
            if (options.max_width && hdr && hdr.width > options.max_width) {
                scale = options.max_width / hdr.width;
            }
            else {
                scale = 1;
            }
            return scale;
        }

        var canvas, ctx, tmpCanvas;
        var initialized = false;
        var load_callback = false;

        var load_setup = function(callback) {
            if (loading) return false;
            if (callback) load_callback = callback;
            else load_callback = false;

            loading = true;
            frames = [];
            clear();
            disposalRestoreFromIdx = null;
            lastDisposalMethod = null;
            frame = null;
            lastImg = null;

            return true;
        }

        return {
            // play controls
            play: player.play,
            pause: player.pause,
            move_relative: player.move_relative,
            move_to: player.move_to,

            // getters for instance vars
            get_playing      : function() { return player.playing },
            get_canvas       : function() { return canvas },
            get_canvas_scale : function() { return get_canvas_scale() },
            get_loading      : function() { return loading },
            get_auto_play    : function() { return options.auto_play },
            get_length       : function() { return player.length() },
            get_current_frame: function() { return player.current_frame() },
            load_url: function(src,callback){
                if (!load_setup(callback)) return;

                var h = new XMLHttpRequest();
                // new browsers (XMLHttpRequest2-compliant)
                h.open('GET', src, true);

                if ('overrideMimeType' in h) {
                    h.overrideMimeType('text/plain; charset=x-user-defined');
                }

                // old browsers (XMLHttpRequest-compliant)
                else if ('responseType' in h) {
                    h.responseType = 'arraybuffer';
                }

                // IE9 (Microsoft.XMLHTTP-compliant)
                else {
                    h.setRequestHeader('Accept-Charset', 'x-user-defined');
                }

                h.onloadstart = function() {
                    // Wait until connection is opened to replace the gif element with a canvas to avoid a blank img
                    if (!initialized) init();
                };
                h.onload = function(e) {
                    if (this.status != 200) {
                        throw Error('Gif failed to load with a '+ this.status);
                    }
                    // emulating response field for IE9
                    if (!('response' in this)) {
                        this.response = new VBArray(this.responseText).toArray().map(String.fromCharCode).join('');
                    }
                    var data = this.response;
                    if (data.toString().indexOf("ArrayBuffer") > 0) {
                        data = new Uint8Array(data);
                    }

                    stream = new Stream(data);
                    setTimeout(doParse, 0);
                };
                h.onerror = function() {
                    throw Error('Gif failed to load');
                };
                h.send();
            },
            load: function (callback) {
                this.load_url(gif.getAttribute('rel:animated_src') || gif.src,callback);
            },
            load_raw: function(arr, callback) {
                if (!load_setup(callback)) return;
                if (!initialized) init();
                stream = new Stream(arr);
                setTimeout(doParse, 0);
            },
            set_frame_offset: setFrameOffset
        };
    };

    return SuperGif;
}));
