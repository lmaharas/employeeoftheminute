/**
 * @namespace
 */
(function(root) {
    root.HeadshotCompositor = root.HeadshotCompositor || {};
    root.HeadshotCompositor.VERSION = "0.1.0";
}(this));

/**
 * Namespace function
 * @param namespaceString A string in the form of 'HeadshotCompositor.package.subpackage'
 * @returns {Object}
 */
HeadshotCompositor.namespace = function( namespaceString ){
    var parts = namespaceString.split( '.' ),
        parent = window,
        currentPart = '';

    for( var i = 0, length = parts.length; i < length; i++ ){
        currentPart = parts[i];
        parent[currentPart] = parent[currentPart] || {};
        parent = parent[currentPart];
    }

    return parent;
};

(function(){
    "use strict";
    HeadshotCompositor.namespace("HeadshotCompositor");

    /**
     * Constructor function creates instance of HeadshotCompositor App
     * @constructor
     */
    HeadshotCompositor.App = function(config){
//        console.log('HeadshotCompositor.App');

        this.RESET_TIMER = config.resetAppAfterThisManyMilliseconds;
        this.IMG_WIDTH = config.imageW;
        this.IMG_HEIGHT = config.imageH;
        this.Z_DEPTH = config.zDepthTriggerDistance;

        this.bgImageUrl = config.bgImageUrl;

        this.videoInput = document.getElementById('inputVideo');
        this.canvasInput = document.getElementById('inputCanvas');

        this.canvasOne = document.getElementById('c1');
        this.canvasTwo = document.getElementById('c2');

        this.headImage = new Image();
        this.maskImage = new Image();
        this.rainbowImage = new Image();
        this.rainbowImage.src = config.bgImageUrl;

        this.setupEventListeners();
        this.setupHeadTracker();

    };

    HeadshotCompositor.App.prototype = {

        RESET_TIMER: null,
        IMG_WIDTH: null,
        IMG_HEIGHT: null,
        Z_DEPTH: null,

        bgImageUrl: null,

        videoInput: null,
        canvasInput: null,

        canvasOne: null,
        canvasTwo: null,

        headImage: null,
        maskImage: null,
        rainbowImage: null,

        bgImageSet: false,
        headImageSet: false,

        hTracker: null,

        setupEventListeners: function(){
            console.log('setupEventListeners');
            window.addEventListener('cameraReadyEvent', this.captureBackgroundImage.bind(this));
            window.addEventListener('headtrackingEvent', this.trackHeads.bind(this));
        },

        setupHeadTracker: function(){
//            console.log('setupHeadTracker');
            this.htracker = new headtrackr.Tracker();
            this.htracker.init(this.videoInput, this.canvasInput);
            //this.htracker.start();
        },

        captureBackgroundImage: function(){
//            console.log('captureBackgroundImage');
            if( !this.bgImageSet ){
                this.canvasInput.getContext('2d').drawImage(this.videoInput, 0, 0, this.canvasInput.width, this.canvasInput.height);
                var bgDataString = this.canvasInput.toDataURL("image/jpg");
                this.writeImageToCanvas(this.canvasOne, bgDataString, null);
                this.bgImageSet = true;
//                console.log('bgPlateSet='+this.bgImageSet);
            }
            // start the head tracking
            this.htracker.start();
        },

        trackHeads: function(event){
//            console.log('trackHeads');
            if( !this.bgImageSet ){
                this.captureBackgroundImage();
            }
            if( !this.headImageSet && event.z < this.Z_DEPTH ){
                var headDataString = this.canvasInput.toDataURL("image/jpg");
                this.writeImageToCanvas(this.canvasTwo, headDataString, null);
                var that = this;
                this.headImage.onload = function(){
                    // stop the head tracking
                    that.htracker.stop();
                    // do tha diff
                    that.diffPixelsLAB();
                };
                this.headImage.src = headDataString;
                this.headImageSet = true;
            }
        },

        diffPixelsLAB: function(){
            //console.log('diffPixelsLAB');
            // blur first
            stackBlurCanvasRGB( 'c1', 0, 0, this.canvasInput.width, this.canvasInput.height, 3 );
            stackBlurCanvasRGB( 'c2', 0, 0, this.canvasInput.width, this.canvasInput.height, 3 );
            // now compare
            var c1 = document.getElementById('c1');
            var c2 = document.getElementById('c2');
            var c3 = document.getElementById('c3');
            var ctx1 = c1.getContext('2d');
            var ctx2 = c2.getContext('2d');
            var ctx3 = c3.getContext('2d');
            var imageData1 = ctx1.getImageData(0, 0, this.canvasInput.width, this.canvasInput.height).data;
            var imageData2 = ctx2.getImageData(0, 0, this.canvasInput.width, this.canvasInput.height).data;
            /*
            console.log('imageData1 : ',imageData1);
            console.log(imageData1.length);
            console.log('imageData2 : ',imageData2);
            console.log(imageData2.length);
            */
            var r = 0, g = 1, b = 2, a = 3;
            for (var p = 0, l = imageData1.length; p < l; p += 4) {
                var colorObj1 = {};
                var colorObj2 = {};
                colorObj1.R = imageData1[p+r];
                colorObj1.G = imageData1[p+g];
                colorObj1.B = imageData1[p+b];
                colorObj2.R = imageData2[p+r];
                colorObj2.G = imageData2[p+g];
                colorObj2.B = imageData2[p+b];
                var c1 = rgb_to_lab(colorObj1);
                var c2 = rgb_to_lab(colorObj2);

                //console.log(ciede2000(c1,c2));

                if ( ciede2000(c1,c2) <= 8 ) {
                    //imageData2[p+a] = 0;
                    imageData2[p+r] = 255;
                    imageData2[p+g] = 255;
                    imageData2[p+b] = 255;
                }
            }
            var imgData = ctx3.createImageData(this.canvasInput.width, this.canvasInput.height);
            var d = imgData.data;
            for (var i=0,len=d.length;i<len;++i) d[i] = imageData2[i];
            //console.log('imageData3 : ',imgData);
            ctx3.putImageData(imgData, 0, 0);
            //console.log('diff complete');
            this.createBlurredCanvas(imgData);
        },

        createBlurredCanvas: function(imgData){
            //console.log('createBlurredCanvas');
            var ctx = this.getCanvasContext2dById('cBlurred');
            ctx.putImageData(imgData, 0, 0);
            stackBlurCanvasRGB( 'cBlurred', 0, 0, this.canvasInput.width, this.canvasInput.height, 10 );
            var blurredImageData = ctx.getImageData(0, 0, this.canvasInput.width, this.canvasInput.height);
            this.createGrayscaleCanvas(blurredImageData, 125);
        },

        createGrayscaleCanvas: function(pixels, threshold){
            //console.log('createGrayscaleCanvas');
            var ctx = this.getCanvasContext2dById('cGrayscale');
            var d = pixels.data;
            for (var i=0; i<d.length; i+=4) {
                var r = d[i];
                var g = d[i+1];
                var b = d[i+2];
                var v = (0.2126*r + 0.7152*g + 0.0722*b >= threshold) ? 255 : 0;
                d[i] = d[i+1] = d[i+2] = v
            }
            ctx.putImageData(pixels, 0, 0);
            this.white2transparent('cGrayscale');
            stackBlurCanvasRGBA( 'cGrayscale', 0, 0, this.canvasInput.width, this.canvasInput.height, 20 );
            this.createCompImage();
        },

        createCompImage: function(){
            //console.log('createCompImage');
            var grayscaleCanvas = document.getElementById('cGrayscale');
            var that = this;
            this.maskImage.onload = function() {
                var canvas = document.getElementById('cMasked');
                var ctx = canvas.getContext('2d');
                ctx.drawImage(that.maskImage, 0, 0);
                ctx.globalCompositeOperation = 'source-in';
                ctx.drawImage(that.headImage, 0, 0);
                ctx.globalCompositeOperation = 'destination-atop';
                ctx.drawImage(that.rainbowImage, 0, 0, that.canvasInput.width, that.canvasInput.height);
//                // update gif
//                $('.cMasked').attr('src', '');
//                var gifSource = 'http://www.picgifs.com/glitter-gifs/s/stars/picgifs-stars-6888943.gif';
//                $('.sparkles').attr('src', gifSource+"?"+new Date().getTime());
                setTimeout(function(){
                    that.resetApp();
                }, 20000);
            };
            this.maskImage.src = grayscaleCanvas.toDataURL("image/jpg");
        },

        resetApp: function(){
//            console.log('resetApp');
            this.bgImageSet = false;
            this.headImageSet = false;
            this.captureBackgroundImage();
        },

        /*----------------------------------------------
        *
        * HELPER FUNCTIONS
        *
        *----------------------------------------------*/
        writeImageToCanvas: function(canvas, dataString, callback){
            var image = new Image();
            image.src = dataString;
            image.onload = function() {
                canvas.getContext('2d').drawImage(image, 0, 0);
                if ( callback !== null ) {
                    callback();
                }

            };
        },

        white2transparent: function(canvas){
            var c = document.getElementById(canvas);
            var ctx = c.getContext('2d');
            var imageData = ctx.getImageData(0,0, c.width, c.height);
            var pixel = imageData.data;

            var r=0, g=1, b=2,a=3;
            for (var p = 0; p<pixel.length; p+=4)
            {
                if (
                    pixel[p+r] == 255 &&
                    pixel[p+g] == 255 &&
                    pixel[p+b] == 255) // if white then change alpha to 0
                {pixel[p+a] = 0;}
            }
            ctx.putImageData(imageData,0,0);
            //return c.toDataURL('image/png');
        },

        getCanvasContext2dById: function(canvasId){
            var canvas = document.getElementById(canvasId);
            var ctx = canvas.getContext('2d');
            return ctx;
        }
    };
})();
