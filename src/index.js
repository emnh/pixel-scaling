const PIXI = require('pixi.js');
const $ = require('jquery');
//const PIXI.utils = require('@pixi/utils');
window.PIXI = PIXI;
import * as utils from '@pixi/utils';

const fragmentString = `

precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float time;
uniform vec2 offset;
uniform vec4 inputSize;
uniform vec4 inputPixel;
uniform vec4 inputClamp;

#define iChannel0 uSampler

vec4 texelFetch(sampler2D sampler, ivec2 iuv, int mipmap) {
	//vec4 inputClamp = vec4(vec2(0.0), vec2(1.0));
	vec2 uv = (vec2(iuv) + vec2(0.5)) / inputSize.xy;
	return texture2D(sampler, clamp(offset + uv, vec2(0.0), vec2(1.0)));
}

/*Copyright 2020 Ethan Alexander Shulman
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.*/

//upscaling multiplier amount
//#define UPSCALE 4.

//image mipmap level, for base upscaling
#define ML 0

//equality threshold of 2 colors before forming lines
#define THRESHOLD .1

//line thickness
float LINE_THICKNESS;

//anti aliasing scaling, smaller value make lines more blurry
#define AA_SCALE (UPSCALE*1.)


//draw diagonal line connecting 2 pixels if within threshold
bool diag(inout vec4 sum, vec2 uv, vec2 p1, vec2 p2) {
    vec4 v1 = texelFetch(iChannel0,ivec2(uv+vec2(p1.x,p1.y)),ML),
        v2 = texelFetch(iChannel0,ivec2(uv+vec2(p2.x,p2.y)),ML);
    if (length(v1-v2) < THRESHOLD) {
    	vec2 dir = p2-p1,
            lp = uv-(floor(uv+p1)+.5);
    	dir = normalize(vec2(dir.y,-dir.x));
        float l = clamp((LINE_THICKNESS-dot(lp,dir))*AA_SCALE,0.,1.);
        sum = mix(sum,v1,l);
    	return true;
    }
    return false;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 ip = fragCoord / UPSCALE;

		//start with nearest pixel as 'background'
		vec4 s = texelFetch(iChannel0,ivec2(ip),ML);

		//draw anti aliased diagonal lines of surrounding pixels as 'foreground'
		LINE_THICKNESS = .4;
		if (diag(s,ip,vec2(-1,0),vec2(0,1))) {
				LINE_THICKNESS = 0.3;
				diag(s,ip,vec2(-1,0),vec2(1,1));
				diag(s,ip,vec2(-1,-1),vec2(0,1));
		}
		LINE_THICKNESS = 0.4;
		if (diag(s,ip,vec2(0,1),vec2(1,0))) {
				LINE_THICKNESS = 0.3;
				diag(s,ip,vec2(0,1),vec2(1,-1));
				diag(s,ip,vec2(-1,1),vec2(1,0));
		}
		LINE_THICKNESS = 0.4;
		if (diag(s,ip,vec2(1,0),vec2(0,-1))) {
				LINE_THICKNESS = 0.3;
				diag(s,ip,vec2(1,0),vec2(-1,-1));
				diag(s,ip,vec2(1,1),vec2(0,-1));
		}
		LINE_THICKNESS = 0.4;
		if (diag(s,ip,vec2(0,-1),vec2(-1,0))) {
			 LINE_THICKNESS = 0.3;
			diag(s,ip,vec2(0,-1),vec2(-1,1));
				diag(s,ip,vec2(1,-1),vec2(-1,0));
		}

		fragColor = s;
}

void main() {
	//mainImage(gl_FragColor, vTextureCoord * inputSize.xy);
	mainImage(gl_FragColor, vTextureCoord * inputSize.xy);
	//gl_FragColor = texture2D(uSampler, vTextureCoord * 0.25);
}


`;

const main = async function() {
  //const width = window.innerWidth;
  //const height = window.innerHeight;

	const texWidth = 2048;
	const texHeight = 3040;
	//const texWidth = 128;
	//const texHeight = 128;
	const scale = 4;
  const width = texWidth;
  const height = texHeight;
	const spriteWidth = 32;
	const spriteHeight = 32;
  const scaledSpriteWidth = scale * spriteWidth;
  const scaledSpriteHeight = scale * spriteHeight;
  const rwidth = scale * texWidth;
  const rheight = scale * texHeight;
  //const maxX = Math.floor(4096 / scaledSpriteWidth);
  //const maxY = Math.floor(4096 / scaledSpriteHeight);
	const tsize = 16384;
	const maxPaintSize = tsize - tsize % scale;
  const paintWidth = Math.min(maxPaintSize, rwidth);
  const paintHeight = Math.min(maxPaintSize, rheight);
  const xPaintSectors = Math.ceil(rwidth / paintWidth);
  const yPaintSectors = Math.ceil(rheight / paintHeight);

  const renderer = new PIXI.Renderer({
      width: paintWidth,
			height: paintHeight,
			backgroundColor: 0xffffff,
			resolution: window.devicePixelRatio || 1,
			preserveDrawingBuffer: true
  });
  //document.body.appendChild(app.view);

  //const container = new PIXI.Container();

  //app.stage.addChild(container);

  // Create a new texture
	PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
	//PIXI.settings.FILTER_RESOLUTION = scale;
  const texture = PIXI.Texture.from('ProjectUtumno_full.png');

	const filter = new PIXI.Filter(null, fragmentString.replaceAll('UPSCALE', scale.toFixed(2)), {
		time: 0.0,
		offset: { x: 0, y: 0 }
	});

  //const pixelart = new PIXI.Sprite(texture);
  //const pixelartForPad = new PIXI.Sprite(texture);
  //container.addChild(pixelart);

	//const renderer = app.renderer;
	const numPaints = 1; //xPaintSectors * yPaintSectors;
  const indexf = (xp, yp) => xp * yPaintSectors + yp;
	const renderTexturePads = [];
	const renderTextures = [];
	for (let i = 0; i < numPaints; i++) {
		renderTexturePads.push(PIXI.RenderTexture.create({ width: paintWidth, height: paintHeight, resolution: 1 }));
		renderTextures.push(PIXI.RenderTexture.create({ width: paintWidth, height: paintHeight, resolution: 1 }));
	}
  const renderTexturePad = renderTexturePads[0];
  const renderTexture = renderTextures[0];

	const cloneCanvas = function(oldCanvas) {

    //create a new canvas
    var newCanvas = document.createElement('canvas');
    var context = newCanvas.getContext('2d');

    //set dimensions
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;

    //apply the old canvas to the new one
    context.drawImage(oldCanvas, 0, 0);

    //return the new canvas
    return newCanvas;
	};

  const prepareDraw = function(xp, yp, renderTexture, renderTexturePad) {

      // Expand/pad texture part to scale
			const x = xp * paintWidth / scale;
			const y = yp * paintHeight / scale;
			const width = ((xp + 1) * paintWidth > rwidth ? rwidth % paintWidth : paintWidth) / scale;
			const height = ((yp + 1) * paintHeight > rheight ? rheight % paintHeight : paintHeight) / scale;
			/*
      const pixelartForPad =
				new PIXI.Sprite(
					new PIXI.Texture(texture,
						new PIXI.Rectangle(
							xp * paintWidth / scale,
							yp * paintHeight / scale,
							((xp + 1) * paintWidth > rwidth ? rwidth % paintWidth : paintWidth) / scale,
							((yp + 1) * paintHeight > rheight ? rheight % paintHeight : paintHeight) / scale)));
			*/
			console.log(
							xp * paintWidth / scale,
							yp * paintHeight / scale,
							((xp + 1) * paintWidth > rwidth ? rwidth % paintWidth : paintWidth) / scale,
							((yp + 1) * paintHeight > rheight ? rheight % paintHeight : paintHeight) / scale);
//      renderer.resize(paintWidth, paintHeight);
//      renderer.render(pixelartForPad, renderTexturePad);

			// Copy sprites into bigger canvas
      const smallCanvas = document.createElement('canvas');
      const ctx = smallCanvas.getContext('2d');
      smallCanvas.width = paintWidth;
      smallCanvas.height = paintHeight;
			const image = $("#sourceImage")[0];
			//console.log(window.loaded);
			ctx.clearRect(0, 0, smallCanvas.width, smallCanvas.height);
      ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

      // Now actually scale the padded texture
			//const pixelart = new PIXI.Sprite(renderTexturePad);
			const pixelart = new PIXI.Sprite(PIXI.Texture.from(smallCanvas));
			pixelart.filters = [filter];
      //pixelart.texture = renderTexturePad;
      //renderer.resize(paintWidth, paintHeight);
			//console.log("pixelart", pixelart.width, pixelart.height, renderTexture.width, renderTexture.height);
      renderer.render(pixelart, renderTexture);
      //const canvas = renderer.extract.canvas(pixelart);
      const canvas = renderer.extract.canvas(renderTexture);
			//document.body.appendChild(canvas);
			return canvas;
      //return cloneCanvas(canvas);
  }
	const inner = function(resolve, canvas, x, y) {
      const smallCanvas = document.createElement('canvas');
      const ctx = smallCanvas.getContext('2d');
      smallCanvas.width = scaledSpriteWidth;
      smallCanvas.height = scaledSpriteHeight;
      ctx.drawImage(canvas, x, y, scaledSpriteWidth, scaledSpriteHeight, 0, 0, scaledSpriteWidth, scaledSpriteHeight);
      document.body.appendChild(smallCanvas);
      resolve($(smallCanvas));
      /*
      smallCanvas.toBlob(function(b){
        const img = document.createElement('img');
        document.body.append(img);
        img.src = URL.createObjectURL(b);
        img.id = x.toString() + ',' + y.toString();
        resolve($(img));
        smallCanvas.remove();
      }, 'image/png');
      */
	};

	const draw = function*(canvases) {
		for (let yr = 0; yr < rheight; yr += scaledSpriteWidth) {
			for (let xr = 0; xr < rwidth; xr += scaledSpriteHeight) {
        const xp = Math.floor(xr / paintWidth);
        const yp = Math.floor(yr / paintHeight);
        const x = xr % paintWidth;
        const y = yr % paintHeight;
        const paintIndex = indexf(xp, yp);
				yield new Promise(resolve => inner(resolve, canvases[paintIndex], x, y));
			}
		}
    return;
	};

  // Listen for animate update
	let finished = false;
	const raf = requestAnimationFrame;
	let drawer = null;
  const update = (async (delta) => {
      // rotate the container!
      // use delta to create frame-independent transform
      //container.rotation -= 0.01 * delta;
			if (!finished && texture.width > 0 && texture.valid) {
        finished = true;
        const canvases = [];
        for (let xp = 0; xp < xPaintSectors; xp++) {
          for (let yp = 0; yp < yPaintSectors; yp++) {
						//const paintIndex = indexf(xp, yp);
						const paintIndex = 0;
            canvases.push(prepareDraw(xp, yp, renderTextures[paintIndex], renderTexturePads[paintIndex]));
            //console.log(indexf(xp, yp), canvases.length);
          }
        }
        drawer = draw(canvases);
        //indexf(xp, yp);
			}
			if (drawer != null) {
        let startTime = performance.now();
        while (performance.now() - startTime <= 100.0) {
          const next = drawer.next();
          if (next.done) {
            drawer = null;
            break;
          }
          await next.value;
        }
        //console.log(performance.now() - startTime);
			}
			raf(update);
  });
	update();
	window.retry = function() {
		finished = false;
		update();
	};
};

$(main);
