# Overview

Originally from the the excellent jsgif project (https://github.com/shachaf/jsgif).

And also forked from the robust gifshot project started by Yahoo (https://github.com/yahoo/gifshot) for gif encoding.

This project was created to remove some of the extra features of the two projects and instead make a lightweight library that does both encoding and decoding of gifs.

# Changes

The changes to these two libraries are below:

## libgif-js
- Removal of progress bar
- Removal of some utility functions that are generally not required.
- Addition of new params for options.
- Change the external facing API to have an decode function (libgif-js) and encode set of functions (gifshot)

### New params for SuperGif.decode
- canvas: pass in a canvas element to draw the resulting frames onto (optional)
- drawImageWith (object): set of params to draw the image onto the canvas using the same options for native canvas.drawImage(http://www.w3schools.com/tags/canvas_drawimage.asp)

## gifshot
- Removal of capturing a gif from a video
- Removal of capturing a gif from a webrtc stream
- Removal of utility functions to support video and webrtc stream gif capture
