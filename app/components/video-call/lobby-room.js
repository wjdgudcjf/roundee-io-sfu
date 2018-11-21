import { computed, set } from '@ember/object';
import { inject as service } from '@ember/service';
import config from '../../config/environment';
import Component from "@ember/component";

export default Component.extend({
    store: service('store'),
    tagName: "div",
    classNames: ["cPop", "set"],

    videodevicelist: null,
    micdevicelist: null,
    videoquality: null,

    mediamute: null,

    displayname: '',

    selectvideodevice: null,
    selectmicdevice: null,

    isSafari: computed(function() {
        if(adapter.browserDetails.browser==='safari'){
            return true;
        }
        return false;
    }),

    //user function
    getDeviceList(devices){
        let selectvideodevice = null;
        let selectmicdevice = null;
        if(devices.length > 0){
            devices.forEach(function(device){
                if(device.kind==="audioinput"){
                    this.micdevicelist.pushObject(device);
                }
                else if(device.kind==="videoinput"){
                    this.videodevicelist.pushObject(device);
                }
            }.bind(this));

            if(this.videodevicelist.length>0){
                this.set('selectvideodevice', this.videodevicelist[0].label);
                selectvideodevice =  this.videodevicelist[0].deviceId;
            }
            else{
                $("#cameraselect").addClass('disable');
                this.set('selectvideodevice', 'No Camera detected.');
                this.send('mediaonoff', 'cam', true);
            }

            if(this.micdevicelist.length>0){
                this.set('selectmicdevice', this.micdevicelist[0].label);
                selectmicdevice =  this.micdevicelist[0].deviceId;
            }
            else{
                this.set('selectmicdevice', 'No Mic detected.');
                this.send('mediaonoff', 'mic', true);
            }

            sessionStorage.setItem('selectdevice', GLOBAL.transObjToStr({video: selectvideodevice, audio: selectmicdevice}));

            ucEngine.Video.getViewer({type: 'self', viewerid: GLOBAL.getMyID(), devicetype: config.APP.devicetype, onSuccess: this.onSuccessGetViewer.bind(this), onFail: this.onFailGetViewer.bind(this)});
        }
    },

    onSuccessGetViewer(event){
        let video = document.querySelector("#my_Video");
        if(video!==undefined&&video!==null){
            if(!video.paused){
                video.pause();
                video.src = '';
                video.load();
            }
            video.srcObject = event.streams[0];
            video.muted = true;

            let WIDTH=220;
            let HEIGHT=50;
            let rafID  = null;

            let canvasContext = document.getElementById( "meter" ).getContext("2d");
            // monkeypatch Web Audio
            window.AudioContext = window.AudioContext || window.webkitAudioContext;

            // grab an audio context
            let audioContext = new AudioContext();
            let createAudioMeter = function(audioContext,clipLevel,averaging,clipLag){
                let processor = audioContext.createScriptProcessor(512);
                processor.onaudioprocess = function(event){
                    let buf = event.inputBuffer.getChannelData(0);
                    let bufLength = buf.length;
                    let sum = 0;
                    let x;

                    // Do a root-mean-square on the samples: sum up the squares...
                    for (let i=0; i<bufLength; i++) {
                        x = buf[i];
                        if (Math.abs(x)>=this.clipLevel) {
                            this.clipping = true;
                            this.lastClip = window.performance.now();
                        }
                        sum += x * x;
                    }

                    // ... then take the square root of the sum.
                    let rms =  Math.sqrt(sum / bufLength);

                    // Now smooth this out with the averaging factor applied
                    // to the previous sample - take the max here because we
                    // want "fast attack, slow release."
                    this.volume = Math.max(rms, this.volume*this.averaging);
                };

                processor.clipping = false;
                processor.lastClip = 0;
                processor.volume = 0;
                processor.clipLevel = clipLevel || 0.98;
                processor.averaging = averaging || 0.95;
                processor.clipLag = clipLag || 750;

                // this will have no effect, since we don't copy the input to the output,
                // but works around a current Chrome bug.
                processor.connect(audioContext.destination);

                processor.checkClipping = function(){
                    if (!this.clipping) {
                        return false;
                    }
                    if ((this.lastClip + this.clipLag) < window.performance.now()){
                        this.clipping = false;
                    }
                    return this.clipping;
                };

                processor.shutdown = function(){
                    this.disconnect();
                    this.onaudioprocess = null;
                };

                return processor;
            };

            let mediaStreamSource = audioContext.createMediaStreamSource(event.streams[0]);

            // Create a new volume meter and connect it.
            let meter = createAudioMeter(audioContext);
            mediaStreamSource.connect(meter);

            // kick off the visual updating
            let drawLoop = function drawLoop( time ) {
                // clear the background
                canvasContext.clearRect(0,0,WIDTH,HEIGHT);

                // check if we're currently clipping
                canvasContext.fillStyle = "rgba(22,4,83,0.5)";
                // if (meter.checkClipping()){
                //     canvasContext.fillStyle = "red";
                // }
                // else
                // {
                //     canvasContext.fillStyle = "rgba(22,4,83,0.5)";
                // }
                // draw a bar based on the current volume
                canvasContext.fillRect(0, 0, meter.volume*WIDTH*2, HEIGHT);
                // set up the next visual callback
                rafID = window.requestAnimationFrame( drawLoop );
            };
            drawLoop();
        }
    },

    onFailGetViewer(error){
        GLOBAL.error("Get Self Viewer Fail = " + error.message);
    },

    getDeviceFail(error){
        GLOBAL.error(error.message);
    },

    init() {
        this._super(...arguments);
        this.videodevicelist = [];
        this.micdevicelist = [];
        this.mediamute = {video: false, audio: false};
    },

    didInsertElement() {
        this._super(...arguments);
        ucEngine.Video.checkDevice({getDevice: this.getDeviceList.bind(this), getDeviceFail: this.getDeviceFail.bind(this)});
    },

    click(event){
        if(event.target.id!=='selectvideo'){
            if(!$("#videolist").hasClass('select-hide')){
                $("#videolist").addClass('select-hide')
            }
        }
        if(event.target.id!=='selectmic'){
            if(!$("#miclist").hasClass('select-hide')){
                $("#miclist").addClass('select-hide')
            }
        }
        event.preventDefault();
    },

    actions: {
        dropdown(type){
            if(type==="video"){
                if(this.videodevicelist.length===0){
                    return false;
                }
                if(!$("#selectvideo").hasClass("select-arrow-active")){
                    $("#selectvideo").addClass("select-arrow-active");
                }
                else{
                    $("#selectvideo").removeClass("select-arrow-active");
                }

                if($("#videolist").hasClass("select-hide")){
                    $("#videolist").removeClass('select-hide');
                }
                else{
                    $("#videolist").addClass('select-hide');
                }
            }
            else{
                if(this.micdevicelist.length===0){
                    return false;
                }
                if(!$("#selectmic").hasClass("select-arrow-active")){
                    $("#selectmic").addClass("select-arrow-active");
                }
                else{
                    $("#selectmic").removeClass("select-arrow-active");
                }

                if($("#miclist").hasClass("select-hide")){
                    $("#miclist").removeClass('select-hide');
                }
                else{
                    $("#miclist").addClass('select-hide');
                }
            }
        },

        changeDisplayName(){
            $("#labeldisplayname").hide();
            $("#inputdisplayname").show().focus().on('blur', function(){
                if($("#inputdisplayname").val().trim().length>0){
                    this.set('displayname', $("#inputdisplayname").val());
                }
                $("#inputdisplayname").hide();
                $("#labeldisplayname").show();
            }.bind(this));
        },

        changedevice(type, deviceid){
            let changedevice = false;
            let selectdevice = GLOBAL.transStrToObj(sessionStorage.getItem('selectdevice'));
            if(type==='video'){
                if(deviceid!==selectdevice.video){
                    changedevice = true;
                }
                selectdevice.video = deviceid;
            }
            else if(type==='mic'){
                if(deviceid!==selectdevice.audio){
                    changedevice = true;
                }
                selectdevice.audio = deviceid;
            }

            if(changedevice){
                // Main을 Session을 다시 진행 해야 함.
                sessionStorage.setItem('selectdevice', GLOBAL.transObjToStr(selectdevice));
                this.get('changedevice')();
            }
        },

        mediaonoff(type){
            if(type==="cam"){
                if($(".cameraBg").hasClass("on") && this.videodevicelist.length===0){
                    return false;
                }
                $(".cameraBg").toggleClass("on");
                let camradiovtndom = $("#pCam");
                camradiovtndom.toggleClass("on");
                if(camradiovtndom.hasClass("on")){
                    camradiovtndom.children("button").text("Off").removeClass("current");
        			camradiovtndom.prev("strong").text("On");
                    // unmute
                    ucEngine.Video.mediamute('video', false);
                    this.mediamute.video = false;
                    $("#videolist").removeAttr('disabled');
                    $('.popVideo .cameraBg').hide();
                }
                else{
                    camradiovtndom.children("button").text("Off").addClass("current");
        			camradiovtndom.prev("strong").text("Off");
                    // mute
                    ucEngine.Video.mediamute('video', true);
                    this.mediamute.video = true;
                    $("#videolist").attr('disabled', 'disabled');
                    $('.popVideo .cameraBg').show();
                }
            }
            else{
                if(this.micdevicelist.length===0){
                    return false;
                }
                $(".soundBg").toggleClass("on");
                let camradiovtndom = $("#pAudio");
                camradiovtndom.toggleClass("on");
                if(camradiovtndom.hasClass("on")){
                    camradiovtndom.children("button").text("Off").removeClass("current");
        			camradiovtndom.prev("strong").text("On");
                    // unmute
                    ucEngine.Video.mediamute('audio', false);
                    this.mediamute.audio = false;
                    $("#miclist").removeAttr('disabled');
                }
                else{
                    camradiovtndom.children("button").text("Off").addClass("current");
        			camradiovtndom.prev("strong").text("Off");
                    // mute
                    ucEngine.Video.mediamute('audio', true);
                    this.mediamute.audio = true;
                    $("#miclist").attr('disabled', 'disabled');
                }
            }
        },

        startmeeting(){
            sessionStorage.setItem('roundee_io:checkdevice', 'check');
            ucEngine.Video.removeViewer({viewerid: GLOBAL.getMyID(), userid: 'self'});
            this.get('startmeeting')(this.get('mediamute'), this.get("displayname"));
        }
    }
});
