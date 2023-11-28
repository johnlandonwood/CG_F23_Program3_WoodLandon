"use strict";

var canvas;
var gl;
var program;

var texture1;

var positionLoc, texCoordLoc;   // attribute locations
var textureloc;                 // uniform location

var video = document.querySelector('video');    // get video tag form HTML


// Create two triangles with texture coordinates to make the image appear in a "quad"
// vertices for flat square (x,y pairs)
var square_vertices = new Float32Array ([
    -1.0, -1.0,
    -1.0, 1.0,
    1.0, 1.0,
    1.0, 1.0,
    1.0, -1.0,
    -1.0, -1.0
] );

// vertices for texture coordinates of the square
// Flipped to make sure the video feed renders right-side up rather than upside down
var texCoord = new Float32Array([
    0, 1.0,
    0, 0,
    1.0, 0,
    1.0, 0,
    1.0, 1.0,
    0, 1.0
]);


/*
var texCoord = new Float32Array ([
    0, 0,
    0, 1.5,
    1.5, 1.5,
    1.5, 1.5,
    1.5, 0,
    0, 0
]);
*/
async function setup() {
    try {
        await accessWebcam(video);
    } catch (ex) {
        video = null;
        console.log(ex)
        console.error(ex.message);
    }
}

function accessWebcam(video) {
    return new Promise((resolve, reject) => {
        const mediaConstraints = { audio: false, video: { width: 700, height: 700, brightness: {ideal: 2} } };
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

//--------------------------------------------

window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );

    gl = canvas.getContext('webgl2');
    if (!gl) { alert( "WebGL 2.0 isn't available" ); }

    setup();    // access webcam 
    
    // Emtpy texture to hold video frame as texture
    texture1 = gl.createTexture();
    gl.activeTexture( gl.TEXTURE0);
    gl.bindTexture( gl.TEXTURE_2D, texture1 );
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 700, 700, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    //initilize the shaders
    program = initShaders(gl, "vertex-shader", "inversion-fragment-shader");
    gl.useProgram( program);

    // Download vertices
    var vbuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vbuffer);
    gl.bufferData(gl.ARRAY_BUFFER,   square_vertices, gl.STATIC_DRAW);
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

    gl.viewport(0, 0, 700, 700);
    gl.clearColor(0.5, 0.5, 0.5, 1.0);

    render();
    
}


// Capture frame and download as new texture
function render() {

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // sets texture1 with frame from webcam
    if (video) {
        
        gl.activeTexture(gl.TEXTURE0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);  
    }

    gl.drawArrays( gl.TRIANGLES, 0, 6 )

    requestAnimationFrame(render);
}
