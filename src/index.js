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
uniform vec2 imgResolution;
uniform vec4 inputSize;
uniform vec4 inputPixel;
uniform vec4 inputClamp;

#define iChannel0 uSampler

vec4 texelFetch(sampler2D sampler, ivec2 iuv, int mipmap) {
	//vec4 inputClamp = vec4(vec2(0.0), vec2(1.0));
	//vec2 uv = clamp(vec2(iuv) / imgResolution, inputClamp.xy, inputClamp.zw);
	vec2 uv = (vec2(iuv) + vec2(0.5)) / inputSize.xy;
	return texture2D(sampler, offset + uv);
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
	//mainImage(gl_FragColor, vec2(gl_FragCoord.x, imgResolution.y - gl_FragCoord.y));
	//mainImage(gl_FragColor, vTextureCoord * imgResolution);
	//mainImage(gl_FragColor, vTextureCoord * inputSize.xy);
	//mainImage(gl_FragColor, vTextureCoord * imgResolution);
	mainImage(gl_FragColor, vTextureCoord * inputSize.xy);
	//gl_FragColor = texture2D(uSampler, vTextureCoord * 0.25);
}


`;

const main = async function() {
  //const width = window.innerWidth;
  //const height = window.innerHeight;
	const texWidth = 2048;
	const texHeight = 3040;
	const scale = 4;
  const width = texWidth;
  const height = texHeight;
	const spriteWidth = 32;
	const spriteHeight = 32;

	const rect = new PIXI.Rectangle(0, 0, scale * spriteWidth, scale * spriteHeight);

  const app = new PIXI.Application({
      width: rect.width,
			height: rect.height,
			backgroundColor: 0xffffff,
			resolution: window.devicePixelRatio || 1,
			preserveDrawingBuffer: true
  });
  //document.body.appendChild(app.view);

  const container = new PIXI.Container();

  //app.stage.addChild(container);

  // Create a new texture
	PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
	PIXI.settings.FILTER_RESOLUTION = scale;
  const texture = PIXI.Texture.from('ProjectUtumno_full.png');

	const filter = new PIXI.Filter(null, fragmentString.replaceAll('UPSCALE', scale.toFixed(2)), {
		time: 0.0,
		offset: { x: 0, y: 0 },
		imgResolution: { x: texWidth, y: texHeight }
	});

  const pixelart = new PIXI.Sprite(texture);
  const pixelartForPad = new PIXI.Sprite(texture);
  container.addChild(pixelart);
	//container.width = scale * width;
	//container.height = scale * height;
	//pixelart.width = scale * width;
	//pixelart.height = scale * height;

	const renderer = app.renderer;
	const numThreads = 1;
	const renderTexturePads = [];
	const renderTextures = [];
	for (let i = 0; i < numThreads; i++) {
		renderTexturePads.push(PIXI.RenderTexture.create({ width: rect.width, height: rect.height, resolution: 1 }));
		renderTextures.push(PIXI.RenderTexture.create({ width: rect.width, height: rect.height, resolution: 1 }));
	}
	//pixelart.filters = [filter];
	pixelart.filters = [filter];
	//filter.autoFit = false;

	const inner = async function(resolve, x, y, renderTexture, renderTexturePad) {
		const textureResized = new PIXI.Texture(texture, new PIXI.Rectangle(x, y, spriteWidth, spriteHeight));
		pixelartForPad.texture = textureResized;
		renderer.render(pixelartForPad, renderTexturePad);

		textureResized.realWidth = rect.width;
		textureResized.realHeight = rect.height;
		pixelart.texture = renderTexturePad;
		const sprite = pixelart;
		renderer.resize(rect.width, rect.height);
		renderer.render(sprite, renderTexture);
		renderer.extract.canvas(sprite).toBlob(function(b){
			var img = document.createElement('img');
			document.body.append(img);
			img.src = URL.createObjectURL(b);
			img.id = x.toString() + ',' + y.toString();
			resolve($(img));
		}, 'image/png');
	};

	const draw = async function*() {
		let thread = 0;
		for (let y = 0; y < texHeight; y += spriteWidth) {
			for (let x = 0; x < texWidth; x += spriteHeight) {
				yield new Promise(resolve => inner(resolve, x, y, renderTextures[thread], renderTexturePads[thread]));
				thread = (thread + 1) % numThreads;
			}
		}
	};

	/*
	$("body").append("<canvas id='spritecanvas' width=" + width + " height=" + height + "></canvas>");
	const spritecanvas = $("#spritecanvas")[0];
	const vctx = spritecanvas.getContext('2d');
	const sourceCanas = renderer.context.canvas;
	console.log(sourceCanvas);
	vctx.drawImage(sourceCanvas, 0, 0); 
	const capturedImage = spritecanvas.toDataURL();
	$("body").append("<img id='sprite'></img>");
	$("#sprite").src = capturedImage;
	*/

	const drawer = draw();

  // Listen for animate update
	let finished = false;
  app.ticker.add(async (delta) => {
      // rotate the container!
      // use delta to create frame-independent transform
      //container.rotation -= 0.01 * delta;
			if (texture.width > 0) {
				const list = [];
				for (let i = 0; i < numThreads; i++) {
					if (!finished) {
						const next = drawer.next();
						finished = next.done;
						list.push(next.value);
					};
				}
				const imgs = await Promise.all(list);
				$('body').animate({
						scrollTop: imgs[imgs.length - 1].offset().top
				}, 1000);
			}
  });
	};

$(main);
