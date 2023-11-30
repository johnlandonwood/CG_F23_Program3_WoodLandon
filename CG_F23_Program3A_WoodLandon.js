"use strict";
var canvas;
var gl;

// Program and texture variables
var program;
var normalProgram, inversionProgram, digitalHalftoningProgram;
var squigglyProgram, fisheyeProgram, duplicationProgram, barrelProgram, pincushionProgram;
var texture1;

// Attribute and uniform locations and slider values
var positionLoc, texCoordLoc; 
var textureloc;                 
var thresholdLoc, thresholdValue;
var angleXLoc, angleXValue;
var angleYLoc, angleYValue;
var fisheyeRadiusLoc, fisheyeRadiusValue;
var duplicationScaleFactorLoc, duplicationScaleFactorValue;
var barrelDistortionLoc, barrelDistortionValue;

// Variables to retrieve HTML elements
var video = document.querySelector('video'); 
var shaderSelector = document.getElementById('shaderSelector');
var thresholdSlider = document.getElementById('thresholdSlider');
var angleXSlider = document.getElementById('angleXSlider');
var angleYSlider = document.getElementById('angleYSlider');
var fisheyeSlider = document.getElementById('fisheyeSlider');
var duplicationSlider = document.getElementById('duplicationSlider');
var barrelDistortionSlider = document.getElementById('barrelDistortionSlider');

// Vertices to create a 2D square composed of two triangles
var vertices = new Float32Array ([
    -1.0, -1.0,
    -1.0, 1.0,
    1.0, 1.0,
    1.0, 1.0,
    1.0, -1.0,
    -1.0, -1.0
] );

// Vertices for texture coordinates for the square
// Flipped to make sure the video feed renders right-side up rather than upside down
var texCoord = new Float32Array([
    0, 1.0,
    0, 0,
    1.0, 0,
    1.0, 0,
    1.0, 1.0,
    0, 1.0
]);


// Functions to setup webcam access
async function setup() {
    try {
        await accessWebcam(video);
        console.log("Webcam setup done.")
    } catch (ex) {
        video = null;
        console.error(ex.message);
    }
}

function accessWebcam(video) {
    return new Promise((resolve, reject) => {
        const mediaConstraints = { 
            audio: false, 
            video: { width: 700, height: 700, brightness: {ideal: 2} } 
        };
        navigator.mediaDevices.getUserMedia(mediaConstraints).then(mediaStream => {
            video.srcObject = mediaStream;
            video.setAttribute('playsinline', true);
            video.onloadedmetadata = (e) => {
                video.play();
                resolve(video);
            }
        }).catch(err => {
            reject(err);
        });
    });
}

window.onload = function init() {
    canvas = document.getElementById( "gl-canvas" );
    gl = canvas.getContext('webgl2');
    if (!gl) { alert( "WebGL 2.0 isn't available" ); }
    gl.viewport(0, 0, 700, 700);
    gl.clearColor(0.5, 0.5, 0.5, 1.0);

    // Setup webcam access
    setup();

    // Define different programs for different image processing effects
    normalProgram = initShaders(gl, "vertex-shader", "normal-fragment-shader");
    inversionProgram = initShaders(gl, "vertex-shader", "inversion-fragment-shader");
    digitalHalftoningProgram = initShaders(gl, "vertex-shader", "digital-halftoning-fragment-shader");
    squigglyProgram = initShaders(gl, "vertex-shader", "squiggly-fragment-shader");
    fisheyeProgram = initShaders(gl, "vertex-shader", "fisheye-fragment-shader")
    duplicationProgram = initShaders(gl, "vertex-shader", "duplication-fragment-shader")
    barrelProgram = initShaders(gl, "vertex-shader", "barrel-distortion-fragment-shader")

    // Emtpy texture to hold video frame as texture
    texture1 = gl.createTexture();
    gl.activeTexture( gl.TEXTURE0);
    gl.bindTexture( gl.TEXTURE_2D, texture1 );
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 700, 700, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Start off using the normal program
    program = normalProgram;
    gl.useProgram(program);

    // Download vertices and bind attributes
    var vbuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    positionLoc = gl.getAttribLocation( program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    // Download texture coordinates
    var tcbuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tcbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoord, gl.STATIC_DRAW);
    texCoordLoc = gl.getAttribLocation( program, "aTexCoord");
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray(texCoordLoc);

    // Get uniform variable from fragment shader for texture to set texture unit
    textureloc = gl.getUniformLocation(program, "texturevid");
    gl.uniform1i( textureloc, 0);  // Set to texture unit 0

    // Call render with normalProgram at first
    render();

    // Event listener to set which program is the current program
    document.getElementById('shaderSelector').addEventListener('change', function (event) {
        const selectedIndex = parseInt(event.target.value); // Get the selected index as an integer
        console.log("Selected shader index: " + selectedIndex)
        switch (selectedIndex) {
            case 0:
                program = normalProgram;
                break;
            case 1:
                program = inversionProgram;
                break;
            case 2:
                program = digitalHalftoningProgram;
                break;
            case 3:
                program = squigglyProgram;
                break;
            case 4:
                program = fisheyeProgram;
                break;
            case 5:
                program = duplicationProgram;
                break;
            case 6:
                program = barrelProgram;
                break;
            default:
                program = normalProgram;
                break;
        }

        // Use the selected program and set the video frame texture
        gl.useProgram(program);
        textureloc = gl.getUniformLocation(program, "texturevid");
        gl.uniform1i(textureloc, 0);
        
        // If an image processing effect was selected, apply the user's slider input to the corresponding fragment shader's uniform
        if (selectedIndex === 2) {
            thresholdValue = parseFloat(thresholdSlider.value);
            thresholdLoc = gl.getUniformLocation(program, "threshold");
            gl.uniform1f(thresholdLoc, thresholdValue);
        }
        else if (selectedIndex === 3) {
            angleXValue = parseFloat(angleXSlider.value);
            angleYValue = parseFloat(angleYSlider.value);
            angleXLoc = gl.getUniformLocation(program, "angleX");
            angleYLoc = gl.getUniformLocation(program, "angleY");
            gl.uniform1f(angleXLoc, angleXValue);
            gl.uniform1f(angleYLoc, angleYValue);
        }
        else if (selectedIndex === 4) {
            fisheyeRadiusValue = parseFloat(fisheyeSlider.value);
            fisheyeRadiusLoc = gl.getUniformLocation(program, "radius");
            gl.uniform1f(fisheyeRadiusLoc, fisheyeRadiusValue);
        }
        else if (selectedIndex === 5) {
            duplicationScaleFactorValue = parseFloat(duplicationSlider.value);
            duplicationScaleFactorLoc = gl.getUniformLocation(program, "scaleFactor");
            gl.uniform1f(duplicationScaleFactorLoc, duplicationScaleFactorValue);
        }
        else if (selectedIndex === 6) {
            barrelDistortionValue = parseFloat(barrelDistortionSlider.value);
            barrelDistortionLoc = gl.getUniformLocation(program, "distortionFactor");
            gl.uniform1f(barrelDistortionLoc, barrelDistortionValue);
        }
    });

    // Event listeners for input on fragment shader parameters
    thresholdSlider.addEventListener('input', function (event) {
        if (program === digitalHalftoningProgram) {
            thresholdValue = parseFloat(event.target.value);
            thresholdLoc = gl.getUniformLocation(program, "threshold");
            gl.uniform1f(thresholdLoc, thresholdValue);
        }
    });
    angleXSlider.addEventListener('input', function (event) {
        if (program === squigglyProgram) {
            angleXValue = parseFloat(event.target.value);
            angleXLoc = gl.getUniformLocation(program, "angleX");
            gl.uniform1f(angleXLoc, angleXValue);
        }
    });
    angleYSlider.addEventListener('input', function (event) {
        if (program === squigglyProgram) {
            angleYValue = parseFloat(event.target.value);
            angleYLoc = gl.getUniformLocation(program, "angleY");
            gl.uniform1f(angleYLoc, angleYValue);
        }
    });
    fisheyeSlider.addEventListener('input', function (event) {
        if (program === fisheyeProgram) {
            fisheyeRadiusValue = parseFloat(event.target.value);
            fisheyeRadiusLoc = gl.getUniformLocation(program, "radius");
            gl.uniform1f(fisheyeRadiusLoc, fisheyeRadiusValue);
        }
    });
    duplicationSlider.addEventListener('input', function (event) {
        if (program === duplicationProgram) {
            duplicationScaleFactorValue = parseFloat(event.target.value);
            duplicationScaleFactorLoc = gl.getUniformLocation(program, "scaleFactor");
            gl.uniform1f(duplicationScaleFactorLoc, duplicationScaleFactorValue);
        }
    });
    barrelDistortionSlider.addEventListener('input', function (event) {
        if (program === barrelProgram) {
            barrelDistortionValue = parseFloat(event.target.value);
            barrelDistortionLoc = gl.getUniformLocation(program, "distortionFactor");
            gl.uniform1f(barrelDistortionLoc, barrelDistortionValue);
        }
    });


    render();
}

// Capture frame and download as new texture
function render() {

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Sets texture1 with frame from webcam
    if (video) {
        
        gl.activeTexture(gl.TEXTURE0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);  
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6)

    requestAnimationFrame(render);
}
