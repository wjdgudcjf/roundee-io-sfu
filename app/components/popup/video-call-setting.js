import { getOwner } from '@ember/application';
import { computed } from '@ember/object';
import { inject as service } from "@ember/service";
import config from '../../config/environment';
import Component from '@ember/component';

export default Component.extend({
    store: service('store'),
    tagName: 'div',
    classNames: ['layerPop'],
    notifications: service('roundee-notify'),

    videodevicelist: null,
    micdevicelist: null,


    selectvideodevice: null,
    selectmicdevice: null,
    selectvideodeviceid: null,
    selectmicdeviceid: null,
    videoquality: null,
    mediamute: null,
    displayname: null,

    videoloaded: false,

    isSafari: computed(function() {
        // body
        if(adapter.browserDetails.browser==='safari'){
            return true;
        }
        return false;
    }),

    myinfomstate: computed('myinfo.mstate', function() {
        // body
        if(this.get('videoloaded')){

        }
    }),

    //user function
    changeMediaStatus(){
        let streams = document.querySelector("#my_Video").srcObject.getTracks();
        if(!this.get('mediamute.video')&&!this.get('mediamute.audio')){
            streams.forEach(function(stream){
                stream.enabled = true;
            });
        }
        else if(this.get('mediamute.video')&&!this.get('mediamute.audio')){
            streams.forEach(function(stream){
                if(stream.kind==='audio'){
                    stream.enabled = true;
                }
                else{
                    stream.enabled = false;
                }
            });
        }
        else if(this.get('mediamute.video')&&this.get('mediamute.audio')){
            streams.forEach(function(stream){
                if(stream.kind==='video'){
                    stream.enabled = true;
                }
                else{
                    stream.enabled = false;
                }
            });
        }
        else{
            streams.forEach(function(stream){
                stream.enabled = false;
            });
        }
    },

    getDeviceList(devices){
        if(devices.length > 0){
            let selectdevice = GLOBAL.transStrToObj(sessionStorage.getItem('selectdevice'));
            devices.forEach(function(device){
                if(device.kind==="audioinput"){
                    if(device.deviceId === selectdevice.audio){
                        this.set('selectmicdevice', device.label);
                        this.set('selectmicdeviceidl', device.deviceId);
                    }
                    this.micdevicelist.pushObject(device);
                }
                else if(device.kind==="videoinput"){
                    if(device.deviceId === selectdevice.video){
                        this.set('selectvideodevice', device.label);
                        this.set('selectvideodeviceid', device.deviceId);
                    }
                    this.videodevicelist.pushObject(device);
                }
            }.bind(this));

            if(this.videodevicelist.length===0){
                $("#cameraselect").addClass('disable');
                $("#videoquality").addClass('disable');
                $('input[name="video"]').prop('disabled', true);
                this.set('selectvideodevice', 'No Camera Detected.');
            }
            // else{
            //     if($("#cameraselect").hasClass('disable')){
            //         $("#cameraselect").removeClass('disable');
            //     }
            //     $('input[name="video"]').prop('disabled', true);
            // }
        }
        ucEngine.Video.getLocalMedia({devicetype: config.APP.devicetype, devicestatus: this.get('myinfo.devicestatus'), videodeviceid: this.selectvideodeviceidl, audiodeviceid:this.selectmicdeviceid}, this.getLocalStream.bind(this), this.getLocalStreamFail.bind(this));
    },

    getDeviceFail(error){
        GLOBAL.error(error.message);
    },

    getLocalStream(stream){
        let video = document.querySelector("#my_Video");
        if(video!==undefined&&video!==null){
            if(!video.paused){
                video.pause();
                video.src = '';
                video.load();
            }
            video.srcObject = stream;
            video.muted = true;
        }

        if(this.get('myinfo.devicestatus')==='all'){
            if(this.get('myinfo.mstate')==='audioonly' || this.get('myinfo.mstate')==='none'){
                stream.getVideoTracks()[0].enabled = false;
            }

            if(this.get('myinfo.mstate')==='videoonly' || this.get('myinfo.mstate')==='none'){
                stream.getAudioTracks()[0].enabled = false;
            }
        }
        else if(this.get('myinfo.devicestatus')==='audioonly'){
            if(this.get('myinfo.mstate')==='none'){
                stream.getAudioTracks()[0].enabled = true;
            }
        }
        else if(this.get('myinfo.devicestatus')==='videoonly'){
            if(this.get('myinfo.mstate')==='none'){
                stream.getVideoTracks()[0].enabled = true;
            }
        }

        this.set('videoloaded', true);
    },

    getLocalStreamFail(error){
        GLOBAL.error("Get Local Stream Fail = " + error.message);
    },

    init() {
        this._super(...arguments);
        this.videodevicelist = [];
        this.micdevicelist = [];
        this.mediamute = {video: false, audio: false};
    },

    didInsertElement() {
        this._super(...arguments);
        let width = $(".layerPop .popup_in").width();
        $(".layerPop .popup_in")[0].style.left = "calc(50% -  " + parseFloat(width/2)+ "px)";
        $(".layerPop .popup_in")[0].style.top = "calc(50% - 311.25px)";

        let quality = this.get('myinfo.quality');
        if(quality==='high'){
            $("#high").prop('checked', true);
        }
        else{
            $("#low").prop('checked', true);
        }
        this.set('videoquality', quality);

        $("#videoqualityinfo").hover(function(event){
            $('.vMemo').show();
        }, function(event){
            $('.vMemo').hide();
        });
        ucEngine.Video.checkDevice({getDevice: this.getDeviceList.bind(this), getDeviceFail: this.getDeviceFail.bind(this)});

        if(this.get('myinfo.mstate')==='audioonly' || this.get('myinfo.mstate')==='none'){
            if(!$("#settingvideo").hasClass("off")){
                $("#settingvideo").addClass("off");
            }
            let camradiovtndom = $("#pCam");

            camradiovtndom .removeClass("on");
            camradiovtndom.children("button").text("Off").addClass("current");
            camradiovtndom.prev("strong").text("Off");
            // mute
            this.mediamute.video = true;
            $('.popVideo .cameraBg').show();
        }

        if(this.get('myinfo.mstate')==='videoonly' || this.get('myinfo.mstate')==='none'){
            if(!$("#settingsound").hasClass("on")){
                $("#settingsound").addClass("on");
            }

            let micdiovtndom = $("#pAudio");

            micdiovtndom .removeClass("on");
            micdiovtndom.children("button").text("Off").addClass("current");
            micdiovtndom.prev("strong").text("Off");
            this.mediamute.audio = true;
        }
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
        // event.preventDefault();
    },

    actions: {
        closePopup(){
            let route = getOwner(this).lookup("route:video-call.index");
            route.send("closeModal");
        },

        changeDisplayName(){
            $("#labeldisplayname").hide();
            $("#inputdisplayname").show().focus().on('blur', function(){
                if($("#inputdisplayname").val().trim().length > 0){
                    this.set('displayname', $("#inputdisplayname").val());
                }
                $("#inputdisplayname").hide();
                $("#labeldisplayname").show();
            }.bind(this));
        },

        saveSetting(){
            // user 정보를 Update 하고, session을 다시 맺어야 함.
            let mstate = (this.mediamute.video===false&&this.mediamute.audio===false)?'all':(this.mediamute.video===false&&this.mediamute.audio===true)?'videoonly':(this.mediamute.video===true&&this.mediamute.audio===false)?'audioonly':'none';
            let body = {
                displayname: this.get("displayname")?this.get('displayname'):this.get('myinfo.displayname'),
                mstate: mstate,
                quality: $("#high")[0].checked?'high':'low'
            }

            this.get('store').push({data: {id: GLOBAL.getMyID(), type: 'member', attributes: body}});
            ucEngine.Conf.updateConferenceUser(GLOBAL_MODULE.getConfID(), body, { onComplete: function(){
                this.send("closePopup");
                this.get('notifications').settingsavedinfo('🔧 Settings have been saved.', {autoClear: true});
                // check change device
                let selecteddevice = GLOBAL.transStrToObj(sessionStorage.getItem('selectdevice'));
                if(selecteddevice.video!==this.get('selectvideodeviceid') || selecteddevice.audio!==this.get('selectmicdeviceid')){
                    selecteddevice.video = this.get('selectvideodeviceid')!==null?this.get('selectvideodeviceid'):selecteddevice.video;
                    selecteddevice.audio = this.get('selectmicdeviceid')!==null?this.get('selectmicdeviceid'):selecteddevice.audio;
                    sessionStorage.setItem('selectdevice', GLOBAL.transObjToStr(selecteddevice));
                    this.get('handle').send('changedevice');
                }
            }.bind(this), onError: function(e){
                switch(e.code){
                    case 404:{
                        window.location.replace(config.APP.domain + "/room_no_exist");
                    }
                    break;
                    case 410:{
                        window.location.replace(config.APP.domain + "/410page.html");
                    }
                    break;
                    default:{
                        window.location.replace(config.APP.domain + "/410page.html");
                    }
                }
            }});
        },


        changedevice(type, deviceid){
            let changedevice = false;
            if(type==='video'){
                if(deviceid!==this.selectvideodeviceid){
                    changedevice = true;
                }
                this.selectvideodeviceid = deviceid;
            }
            else if(type==='mic'){
                if(deviceid!==this.selectmicdeviceid){
                    changedevice = true;
                }
                this.selectmicdeviceid = deviceid;
            }

            if(changedevice){
                // Main을 Session을 다시 진행 해야 함.
                ucEngine.Video.getLocalMedia({devicetype: config.APP.devicetype, devicestatus: this.get('myinfo.devicestatus'), videodeviceid: this.selectvideodeviceid, audiodeviceid:this.selectmicdeviceid}, this.getLocalStream.bind(this), this.getLocalStreamFail.bind(this));
            }
        },

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

        mediaonoff(type){
            if(type==="cam"){
                if(this.get('videodevicelist').length > 0){
                    $("#settingvideo").toggleClass("on");
                    let camradiovtndom = $("#pCam");
                    camradiovtndom.toggleClass("on");
                    if(camradiovtndom.hasClass("on")){
                        camradiovtndom.children("button").text("Off").removeClass("current");
                        camradiovtndom.prev("strong").text("On");
                        // unmute
                        if(this.get("myinfo.devicestatus")==='audioonly'||this.get("myinfo.devicestatus")==='none'){
                            GLOBAL.error('devicestatus = ' + this.get('myinfo.devicestatus'));
                        }
                        this.mediamute.video = false;
                        $('.popVideo .cameraBg').hide();
                    }
                    else{
                        camradiovtndom.children("button").text("Off").addClass("current");
                        camradiovtndom.prev("strong").text("Off");
                        // mute
                        this.mediamute.video = true;
                        $('.popVideo .cameraBg').show();
                    }
                }
            }
            else{
                if(this.get('micdevicelist').length > 0){
                    $("#settingsound").toggleClass("on");
                    let camradiovtndom = $("#pAudio");
                    camradiovtndom.toggleClass("on");
                    if(camradiovtndom.hasClass("on")){
                        camradiovtndom.children("button").text("Off").removeClass("current");
                        camradiovtndom.prev("strong").text("On");
                        // unmute
                        this.mediamute.audio = false;
                        $("#miclist").removeAttr('disabled');
                    }
                    else{
                        camradiovtndom.children("button").text("Off").addClass("current");
                        camradiovtndom.prev("strong").text("Off");
                        // mute
                        this.mediamute.audio = true;
                        $("#miclist").attr('disabled', 'disabled');
                    }
                }
            }
            this.changeMediaStatus();
        }
    }
});
