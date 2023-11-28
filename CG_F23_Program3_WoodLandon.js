"use strict";

var canvas;
var gl;

// Program and texture variables
var program;
var normalProgram, inversionProgram, digitalHalftoningProgram;
var texture1;

// Attribute and uniform locations
var positionLoc, texCoordLoc; 
var textureloc;                 

// Get video element from HTML
var video = document.querySelector('video'); 
var shaderSelector = document.getElementById('shaderSelector')

// Vertices to create a 2D square composed to two triangles
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
            default:
                program = normalProgram;
                break;
        }

        gl.useProgram(program);
        textureloc = gl.getUniformLocation(program, "texturevid");
        gl.uniform1i(textureloc, 0);

        render();
    });
    
}

// Capture frame and download as new texture
function render() {

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // sets texture1 with frame from webcam
    if (video) {
        
        gl.activeTexture(gl.TEXTURE0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);  
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6)

    requestAnimationFrame(render);
}
