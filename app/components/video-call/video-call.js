import { computed } from '@ember/object';
import { getOwner } from '@ember/application';
import { bind, later, debounce } from '@ember/runloop';
import { inject as service } from "@ember/service";
import config from '../../config/environment';
import Component from '@ember/component';

export default Component.extend({
    store: service('store'),
    session: service('roundee-auth'),
    notifications: service('roundee-notify'),

    isscreenshare: false,
    connectconference: false,

    flagshowrsidemenu: false,
    rsideshowtype: 'chat',

    fullscreenviewer: null,
    isfullscreen: false,
    checksuccess: true,

    windowsize: null,

    confstate: computed('confinfo.state', function(){
        let confstate = this.get('confinfo.state');
        if(confstate==='end'){
            window.location.replace(config.APP.domain + '/room_no_exist');
        }
    }),

    screensharestate: computed('confinfo.screen_share','myinfo.state', function(){
        let myinfo = this.get('myinfo');
        if(myinfo && myinfo.get('state')==='join'){
            let screenshareowner = this.get('confinfo.screen_share');
            if(screenshareowner===undefined||screenshareowner===null||screenshareowner===""){
                if(this.get('isscreenshare')){
                    this.get('notifications').msginfo(screenshareowner + ' stopped a presentation.', {autoClear: true});
                }
                this.set('screenshareowner', null);
                this.set('isscreenshare', false);
                if($("#menuscreenshare").hasClass('disable su')){
                    $("#menuscreenshare").removeClass('disable su');
                    $("#btnscreenshare").prop('disabled', false);
                }
                $("#btnscreenshare").children('span')[0].innerText = "Share screen";
            }
            else{
                let owner = this.get('store').peekRecord('member', screenshareowner);
                if(screenshareowner!==GLOBAL.getMyID()){
                    this.set('screensharetype', 'viewer');
                    $("#menuscreenshare").addClass('disable su');
                    $("#btnscreenshare").prop('disabled', true);
                }
                else{
                    this.set('screenshareowner', 'owner');
                    $("#btnscreenshare").children('span')[0].innerText = "Stop Sharing";
                }
                this.set('isscreenshare', true);

                let screenshare_id = this.get('store').peekRecord('member', this.get('confinfo.screen_share'));
                this.get('notifications').msginfo(screenshare_id.get('displayname') + ' started a presentation.', {autoClear: true});
            }

            if(this.get('myinfo.devicestatus')==='audioonly' || this.get('myinfo.devicestatus')==='none'){
                // notification
                this.get('notifications').msginfo("❌ No camera has been detected.", {autoClear: true});
            }
        }
    }),

    viewermembers: computed('members', 'members.@each.state', function(){
        let retvalue = [];
        this.get('members').forEach(function(member){
            if(member.get('state')==='join'){
                retvalue.pushObject(member);
            }
        }.bind(this));
        return retvalue;
    }),

    host: computed('myinfo', 'confinfo.owner', function(){
        let myinfo = this.get('myinfo');
        let confinfo = this.get('confinfo');
        if(confinfo!==undefined && confinfo!==null){
            if(confinfo.owner===myinfo.userid){
                return true;
            }
        }
        return false;
    }),

    recon: computed('confinfo.recording', function(){
        let recording = this.get('confinfo.recording');
        if(recording!==undefined&&recording!==null&&recording!==""){
            return true;
        }
        return false;
    }),

    showlobby: computed(function(){
        let checkdevice = sessionStorage.getItem('roundee_io:checkdevice');
        if(checkdevice!==undefined&&checkdevice!==null&&checkdevice!==""){
            return false;
        }
        return true;
    }),

    // user function
    startConference(recvdata){
        var data = recvdata.body;
        var myID = GLOBAL.getMyID();

        // conference-chat
        var roomID = GLOBAL_MODULE.getConfID();

        if(data[0][1].im.length>0){
            let peerIM = data[0][1].im;
            ucEngine.Conf.setPeerIm(peerIM);

            // make main session
            let selectdevice = sessionStorage.getItem('selectdevice');
            if(selectdevice!==undefined&&selectdevice!==null&&selectdevice!==""){
                selectdevice = GLOBAL.transStrToObj(selectdevice);
            }
            ucEngine.Video.startConference({type: 'main', devicetype: config.APP.devicetype, devicestatus: this.get('myinfo.devicestatus'), videodeviceid: selectdevice.video, audiodeviceid: selectdevice.audio, facingMode: "user", onSuccess: this.onSuccessStartConference.bind(this), onFail: this.onFailStartConference.bind(this)});
        }
        else{
            //alert('the conference-server is not online peer : ' + ucEngine.Conf.conferenceid);
            window.location.replace(config.APP.domain + '/410page');
        }
    },

    onSuccessStartConference(event){
        GLOBAL.info("Start Conference Success");
        this.set('connectconference', true);
        let audio = document.querySelector("#audioplayer");
        audio.srcObject = event.streams[0];

        let myinfo = this.get('myinfo');
        GLOBAL.error("My info state = " + myinfo.get('state'));

        if(myinfo){
            if(!this.get('showlobby')&&(myinfo.get('state')==='join' || myinfo.get('state')==='exit')){
                let body = {
                    type: 0,
                    displayname: myinfo.get('displayname'),
                    quality:  myinfo.get('quality'),
                    mstate:  myinfo.get("mstate"),
                    devicestatus: this.get('myinfo.devicestatus'),
                    devicetype: config.APP.devicetype
                };

                // Join Conference
                ucEngine.Conf.joinConferenceRoom(GLOBAL_MODULE.getConfID(), body, { onComplete: function(){
                    // this.set('showlobby', false);
                    ucEngine.Chats.getChatRoomInfo(1, GLOBAL_MODULE.getConfID(), {onComplete: function(){
                        ucEngine.Chats.getChatMsgData(1, GLOBAL_MODULE.getConfID());
                    }.bind(this)});
                }.bind(this)});
            }
            else{
                $('video[id=\"' + GLOBAL.getMyID() + '\"]').srcObject = ucEngine.Video.mainstream;
                ucEngine.Chats.getChatRoomInfo(1, GLOBAL_MODULE.getConfID(), {onComplete: function(){
                    ucEngine.Chats.getChatMsgData(1, GLOBAL_MODULE.getConfID());
                }.bind(this)});
            }
        }
    },

    onFailStartConference(error){
        // can't start video conference
        GLOBAL.error("Start Conference Fail  name =  " + error.name + " message = " + error.message);
        if (error.name=="NotFoundError" || error.name == "DevicesNotFoundError" ){

        }
        else if (error.name=="NotReadableError" || error.name == "TrackStartError" ){
            this.set('checksuccess', false);
            // if(error.message.indexOf('video')!==-1){
            //     this.get('store').push({data:{id: GLOBAL.getMyID(), type: 'member', attributes:{devicestatus: 'audioonly', mstate: 'audioonly'}}});
            //     ucEngine.Conf.updateConferenceUser(GLOBAL_MOUDLE.getConfID(), {devicestatus: 'audioonly', mstate: 'audioonly'}, {onComplete: function(){
            //         ucEngine.Video.startConference({type: 'main', devicetype: config.APP.devicetype, devicestatus: 'audioonly', videodeviceid: null, audiodeviceid: selectdevice.audio, facingMode: "user", onSuccess: this.onSuccessStartConference.bind(this), onFail: this.onFailStartConference.bind(this)});
            //     }});
            //     // ucEngine.Video.startConference({type: 'main', devicetype: config.APP.devicetype, devicestatus: 'audioonly', videodeviceid: null, audiodeviceid: selectdevice.audio, facingMode: "user", onSuccess: this.onSuccessStartConference.bind(this), onFail: this.onFailStartConference.bind(this)});
            // }
            // else{
            //     this.set('checksuccess', false);
            // }
        }
        else if (error.name=="OverconstrainedError" || error.name == "ConstraintNotSatisfiedError" ){

        }
        else if (error.name=="NotAllowedError" || error.name == "PermissionDeniedError" ){
            this.set('checksuccess', false);
        }
        else if (error.name=="TypeError" || error.name == "TypeError" ){

        }
        else {

        }
    },

    changeMediaStatus(type, mute, viewer){
        let body = null;
        let userinfo = this.get('store').peekRecord('member', !viewer?GLOBAL.getMyID():viewer).toJSON();
        if(!viewer){
            ucEngine.Video.mediamute(type, mute);
            body = {mstate: (userinfo.mstate===undefined||userinfo.mstate===null?'all':userinfo.mstate), operation: GLOBAL.getMyID()};
        }
        else{
            body = {userid: viewer, mstate: (userinfo.mstate===undefined||userinfo.mstate===null?'all':userinfo.mstate), operation: GLOBAL.getMyID()};
        }

        if(type==='video'){
            if(mute){
                // video mute
                if(body.mstate==='all'){
                    body.mstate = 'audioonly';
                }
                else if(body.mstate==='videoonly'){
                    body.mstate = 'none';
                }
            }
            else{
                if(body.mstate==='none'){
                    body.mstate = 'videoonly';
                }
                else if(body.mstate==='audioonly'){
                    body.mstate = 'all';
                }
            }
        }
        else if(type==='audio'){
            if(mute){
                if(body.mstate==='all'){
                    body.mstate = 'videoonly';
                }
                else if(body.mstate==='audioonly'){
                    body.mstate = 'none';
                }
            }
            else{
                if(body.mstate==='none'){
                    body.mstate = 'audioonly';
                }
                else if(body.mstate==='videoonly'){
                    body.mstate = 'all';
                }
            }
        }
        this.get('store').push({data: {id: !viewer?GLOBAL.getMyID():viewer, type:'member', attributes: {mstate: body.mstate, operation: GLOBAL.getMyID()}} });
        ucEngine.Conf.updateConferenceUser(GLOBAL_MODULE.getConfID(), body);
    },

    checkScreenShareExtension(){
        return document.querySelector('#roundeeio-extension-installed') !== null;
    },

    fullscreenevent(event){
        let state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;
        let fullscreenviewer = this.get('fullscreenviewer');
        if(state){
            // fullscreen mode
            $('#container').addClass('fScreen');
            $('.screen').addClass('Fullscreen');
            this.set('isfullscreen', true);
            $("#conNav").addClass("aN");
            $('#conNav').hover(function(){
                $('#conNav').removeClass('aN');
                $('#conNav').addClass('on');
            } , function(){
                $('#conNav').removeClass('on');
                $('#conNav').addClass('aN');
            });
        }
        else{
            $('.uNavClose').hide();
            if(this.get('fullscreenviewer')!=='screenshare'){
                if($('div[id=\"' + fullscreenviewer + '\"]').hasClass('fScreen') ){
                    $('div[id=\"' + fullscreenviewer + '\"]').removeClass('fScreen');
                }
            }
            else{
                if($('#screenShare').hasClass('fScreen') ){
                    $('#screenShare').removeClass('fScreen');
                }
            }
            $('.screen').removeClass('Fullscreen');
            $('#container').removeClass('fScreen');
            this.set('fullscreenviewer', null);
            this.set('isfullscreen', false);
            $("#conNav").removeClass("aN");
            $('#conNav').unbind('mouseenter mouseleave');
        }
    },

    init() {
        this._super(...arguments);
        this.windowsize = {};
    },

    didInsertElement() {
        this._super(...arguments);
        GLOBAL.NotiHandle = this;
        // get conference server peer im value
        let resultGetPeerIm = this.startConference.bind(this);
        ucEngine.Conf.getPeerIm( this, {onComplete: resultGetPeerIm});

        $(window).on('keyup', function(event){
            // alt+N
            if(this.get('host')&&this.get('recon')){
                event = event || window.event;
                if ((event.which == 78 || event.keyCode == 78) && event.altKey) {
                    let rectime = document.getElementById('recBtn');
                    let rec_timer = rectime.children[1];
                    let note_id = GLOBAL.genNotesID();
                    let nowdate = new Date();
                    let senddate = new Date(Date.parse(nowdate));

                    let note_body = {
                        msgID: note_id,
                        senderName: GLOBAL.getMyName(),
                        roomID: GLOBAL_MODULE.getConfID(),
                        sender: GLOBAL.getMyID(),
                        msgDateTime: senddate.toISOString(),
                        msgData:  '',
                        recordtimer: rec_timer.innerHTML,
                        noteType: null,
                        msgType: CONST.CHAT_TYPE_NOTE,
                        type: CONST.CHAT_TYPE_NOTE
                    }

                    this.get('store').push({data: {id: note_id, type: 'notes', attributes: {noteID: note_id,  noteMsg: '', noteTimer: rec_timer.innerHTML, noteType: null} }});
                    ucEngine.Chats.sendMsgData(GLOBAL_MODULE.getConfID(), 1, note_body);
                    this.get('notifications').noteaddinfo("<span>" + rec_timer.innerHTML + ' </span> A timestamped note has been added.', {title:"Note added!", autoClear: true});
                }
            }
            else {
                event = event || window.event;
                if ((event.which == 78 || event.keyCode == 78) && event.altKey) {
                    this.get('notifications').notenorecaddinfo('<strong>To take Blank Notes start the recording first.</strong>', {autoClear: true});
                }
            }
        }.bind(this));

        $(window).on('mozfullscreenchange', bind(this, this.fullscreenevent));
        $(window).on('webkitfullscreenchange', bind(this, this.fullscreenevent));
        $(window).on('fullscreenchange', bind(this, this.fullscreenevent));
        $(window).on('MSFullscreenChange', bind(this, this.fullscreenevent));

        $(window).on('resize', function(event){
            this.set('windowsize', {width: $(window).width(), height: $(window).height()});
        }.bind(this));
    },

    willDestroyElement(){
        GLOBAL.NotiHandle = null;
        this._super(...arguments);
    },

    actions: {
        openInvite(){
            let route = getOwner(this).lookup("route:video-call.index");
            let memberinfo = this.get('store').peekAll('member');
            route.send("openModal", "popup.modal-popup",  memberinfo , 'invitepeople', this);
        },

        recOnOff(){
            if(this.get('confinfo.owner')!==GLOBAL.getMyID()){
                return;
            }
            else{
                let recOn = !this.get('recon');
                this.set( 'recon', recOn);
                if(recOn){
                    this.set( 'showrecstart', true);
                    ucEngine.Conf.conferenceRecording(GLOBAL_MODULE.getConfID(), {recording: 1});
                }
                else{
                    this.set( 'showrecstop', true);
                    ucEngine.Conf.conferenceRecording(GLOBAL_MODULE.getConfID(), {recording: 0});
                }
            }
        },

        videoOnOff(){
            let myMstate = this.get('myinfo.mstate');
            if(myMstate==='all' || myMstate==='videoonly'){
                this.changeMediaStatus('video', true);      // mute
            }
            else if(myMstate==='none'||myMstate==='audioonly'){
                this.changeMediaStatus('video', false);  // unmute
            }
        },

        micOnOff(viewerinfo, state){
            let myMstate = this.get('myinfo.mstate');
            if(state===undefined){
                if(myMstate==='all' || myMstate==='audioonly'){
                    this.changeMediaStatus('audio', true);      // mute
                }
                else if(myMstate==='none'||myMstate==='videoonly'){
                    this.changeMediaStatus('audio', false);  // unmute
                }
            }
            else{
                this.changeMediaStatus('audio', state, viewerinfo);
            }
        },

        leaveRoom(){
            let route = getOwner(this).lookup("route:video-call.index");
            route.send("openModal", "popup.modal-popup", this.get('confinfo') , 'leave');
        },

        setting(){
            let route = getOwner(this).lookup("route:video-call.index");
            let myinfo = this.get('store').peekRecord('member', GLOBAL.getMyID());
            route.send("openModal", "popup.modal-popup",  myinfo, 'setting', this);
        },

        startscreenshare(){
            let isscreenshare = this.get('isscreenshare');
            if(!isscreenshare){
                // screen share mode
                //extension check
                if(navigator.userAgent.indexOf("Opera")!==-1 || navigator.userAgent.indexOf("OPR")!==-1){
                    // Opera
                    if(!this.checkScreenShareExtension()){
                        let operaExtentionID = "dfbboggmmhleainnjhhgkaacakajffhf";
                        let operainstall = function(){
                            // window.location.reload(true);
                            GLOBAL.info("opera extension install success");
                            // Screen share notification
                            this.get('notifications').refreshinfo('Refresh the page once the Screen-Share plug-in is installed in your browser.', {title:"Refresh the page", autoClear: true});
                        };

                        var operafail = function(error){
                            GLOBAL.error("opera extension install fail");
                        };

                        opr.addons.installExtension(operaExtentionID, operainstall.bind(this), operafail);
                    }
                    else{
                        this.set('screensharetype', 'owner');
                        this.set('isscreenshare', true);
                    }
                }
                else{
                    if(adapter.browserDetails.browser!=='firefox'){
                        if(!this.checkScreenShareExtension()){
                            //chrome browser
                            let extensionid = 'nhgakmconlchcjjjcligmohaijmgcbkd';

                            if(config.APP.domain==='https://askee.io'){
                                extensionid = 'mdjebeajhjimaphcflphoamnhcabbmko';
                            }
                            let onsuccess = function(){
                                this.hasExtension = true;
                                // window.location.reload(true);
                                // Screen share notification
                                this.get('notifications').refreshinfo('Refresh the page once the Screen-Share plug-in is installed in your browser.', {title:"Refresh the page", autoClear: true});
                            };

                            let onfail = function(e){
                                GLOBAL.error("extension_install_fail [" + e +"]");
                            };

                            chrome.webstore.install("https://chrome.google.com/webstore/detail/"+ extensionid, onsuccess.bind(this), onfail);
                        }
                        else{
                            this.set('screensharetype', 'owner');
                            this.set('isscreenshare', true);
                        }
                    }
                    else{
                        let firefoxVer = parseInt(window.navigator.userAgent.match(/Firefox\/(.*)/)[1], 10);
                        if(firefoxVer < 52){
                            if(!this.checkScreenShareExtension()){
                                let xpi = {
                                    'Roundee Screen Share': {
                                        URL: 'https://addons.mozilla.org/firefox/downloads/latest/roundee-screen-share/platform:5/addon-747037-latest.xpi?src=dp-btn-primary',
                                        toString: function() {
                                            return this.URL;
                                        }
                                    }
                                };

                                InstallTrigger.install(xpi, function(url, status){
                                    if(status === 0){
                                        window.location.reload(true);
                                    }
                                });
                            }
                            else{
                                this.set('screensharetype', 'owner');
                                this.set('isscreenshare', true);
                            }
                        }
                        else{
                            this.set('screensharetype', 'owner');
                            this.set('isscreenshare', true);
                        }
                    }
                }
            }
            else{
                // screen share mode close
                this.set('isscreenshare', false);
            }
        },

        startmeeting(mediamute, displayname){
            // close lobby popup window and join conference
            let myinfo = this.get('myinfo');

            let mstate = 'all';
            mstate = (mediamute.video===false&&mediamute.audio===false)?'all':(mediamute.video===false&&mediamute.audio===true)?'videoonly':(mediamute.video===true&&mediamute.audio===false)?'audioonly':'none';
            if(myinfo){
                let body = {
                    type: 0,
                    displayname: displayname===undefined||displayname===""?myinfo.get('displayname'):displayname,
                    quality:  myinfo.get('quality'),
                    mstate:  mstate,
                    devicestatus: this.get('myinfo.devicestatus'),
                    devicetype: config.APP.devicetype
                };

                // Join Conference
                ucEngine.Conf.joinConferenceRoom(GLOBAL_MODULE.getConfID(), body, { onComplete: function(){
                    this.set('showlobby', false);
                    GLOBAL.NotiHandle = this;
                    ucEngine.Chats.getChatRoomInfo(1, GLOBAL_MODULE.getConfID(), {onComplete: function(){
                        ucEngine.Chats.getChatMsgData(1, GLOBAL_MODULE.getConfID());
                    }.bind(this)});
                }.bind(this)});
            }
        },

        changedevice(){
            // reconnect main session
            let selectdevice = GLOBAL.transStrToObj(sessionStorage.getItem('selectdevice'));
            ucEngine.Video.startConference({type: 'main', mode: 'changedevice',  devicetype: config.APP.devicetype, devicestatus: this.get('myinfo.devicestatus'), videodeviceid: selectdevice.video, audiodeviceid: selectdevice.audio, facingMode: "user", changeDevice: function(){
                if($('video[id=\"' + GLOBAL.getMyID()+ '\"]')[0]){
                    $('video[id=\"' + GLOBAL.getMyID()+ '\"]')[0].srcObject = ucEngine.Video.mainstream;
                }
            }.bind(this)});
        },

        showrsidemenu(type){
            let rsideshow = this.get('flagshowrsidemenu');

            if(!rsideshow){
                // show
                if(!$(".screen").hasClass("rC")){
                    $(".screen").addClass("rC");
                }
                else {
                    if(this.get('rsideshowtype')===type){
                        $(".screen").removeClass("rC");
                    }
                }
                if(type==='chat'){
                    ucEngine.Chats.sendReadData(GLOBAL_MODULE.getConfID(), GLOBAL.lastmsginfo.keyID, GLOBAL.lastmsginfo.msgID, 1);
                }
                this.set('rsideshowtype', type);
                this.set('flagshowrsidemenu', true);
            }
            else{
                if((type!==undefined)&&this.get("rsideshowtype")!==type){
                    // change
                    this.set('rsideshowtype',  type);
                }
                else{
                    // close
                    if($(".screen").hasClass("rC")){
                        $(".screen").removeClass("rC");
                    }
                    this.set('flagshowrsidemenu', false);
                }
            }
        },

        requestFullScreen(viewerid){
            if(viewerid!=="screenshare"){
                if(this.get("fullscreenviewer")!==viewerid){
                    let prefullscreen = this.get("fullscreenviewer");
                    if(prefullscreen){
                        if($('div[id=\"' + prefullscreen + '\"]').hasClass('fScreen') ){
                            $('div[id=\"' + prefullscreen + '\"]').removeClass('fScreen');
                        }
                        $('.uNavClose').hide();
                    }
                    if(!$('div[id=\"' + viewerid + '\"]').hasClass('fScreen') ){
                        $('div[id=\"' + viewerid + '\"]').addClass('fScreen');
                    }
                    $('div[id=\"' + viewerid + '\"]').find('.uNavClose').show();
                }
                this.set('fullscreenviewer', viewerid);
            }
            else{
                if(!$('#screenShare').hasClass('fScreen') ){
                    $('#screenShare').addClass('fScreen');
                }
                $('#screenShare').find('.uNavClose').show();
            }
            this.set('fullscreenviewer', viewerid);

            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            }
            else if (document.documentElement.mozRequestFullScreen) { /* Firefox */
                document.documentElement.mozRequestFullScreen();
            }
            else if (document.documentElement.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
                document.documentElement.webkitRequestFullscreen();
            }
            else if (document.documentElement.msRequestFullscreen) { /* IE/Edge */
                document.documentElement.msRequestFullscreen();
            }
        },

        closeFullScreen(viewerid){
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
            else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        },

        showmessagenoti(notitype, msgID, msgdata){
            if(notitype==='network_state'){
                if(msgID==='bad'){
                    this.get('notifications').msginfo('<img src="../img/video/icon_connection.svg" alt=""> Poor connection', {autoClear: true});
                }
                else if(msgID==='novideo'){
                    if(this.get('myinfo.devicestatus')==='all'){
                        let mediastate = this.get("myinfo.mstate")==="all"?"audioonly":this.get('myinfo.mstate');
                        this.get('store').push({data:{id: GLOBAL.getMyID(), type: 'member', attributes:{devicestatus: 'audioonly', mstate: mediastate}}});
                        ucEngine.Conf.updateConferenceUser(GLOBAL_MODULE.getConfID(), {devicestatus: 'audioonly', mstate: mediastate}, {onComplete: function(){
                            let selectdevice = sessionStorage.getItem('selectdevice');
                            if(selectdevice!==undefined&&selectdevice!==null&&selectdevice!==""){
                                selectdevice = GLOBAL.transStrToObj(selectdevice);
                            }
                            ucEngine.Video.startConference({type: 'main', devicetype: config.APP.devicetype, devicestatus: 'audioonly', videodeviceid: null, audiodeviceid: selectdevice.audio, facingMode: "user", onSuccess: this.onSuccessStartConference.bind(this), onFail: this.onFailStartConference.bind(this)});
                        }.bind(this)});
                    }
                }
            }
            else if(notitype==='leave'){
                let leavemember = this.get('store').peekRecord('member', msgID);
                let effect = new Audio('../sound/user-exit.mp3');
                effect.play();
                this.get('notifications').msginfo('👋 '+ leavemember.get('displayname') + " left the meeting", {autoClear: true});
            }
            else if(notitype==='join'){
                let joinmember = this.get('store').peekRecord('member', msgID);
                let effect = new Audio('../sound/user-entry.mp3');
                effect.play();
                if(joinmember){
                    this.get('notifications').msginfo('🤙 ' + joinmember.get('displayname') + " joined the meeting", {autoClear: true});
                }
                else{
                    this.get('notifications').msginfo('🤙 ' + msgID + " joined the meeting", {autoClear: true});
                }
            }
            else if(notitype==='recording'){
                if(this.get('confinfo.owner')!==GLOBAL.getMyID()){
                    let effect = new Audio('../sound/Sound8-recording.mp3');
                    effect.play();
                    if(msgID){
                        let hostmember = this.get('store').peekRecord('member', this.get('confinfo.owner'));
                        this.get('notifications').recotheruserinfo('<strong>' + hostmember.get('displayname') +'</strong> is recording this conversation.', {title:"Recording activated", autoClear: false});
                        $('.sCon').append('<div class="Gnoti"><span>Recording...</span></div>');
                    }
                    else{
                        let hostmember = this.get('store').peekRecord('member', this.get('confinfo.owner'));
                        this.get('notifications').msginfo('<img src="../img/video/little_stop_icon.svg" alt=""> ' + hostmember.get('displayname') +  ' stopped the recording.', {autoClear: true});
                        $(".rUser").hide();
                        $('.Gnoti').remove();
                    }
                }
                else {
                    if(msgID){
                        this.get('notifications').recinfo('Hit <strong> ‘alt+N’ </strong> to leave a blank note and edit later.', {title:"Recording started", autoClear: true});
                    }
                    else{
                        let notimsg = 'Recording saved. A streaming link will be send to '+ GLOBAL.getMyID() + ' once meeting ends.';
                        if(this.get('confinfo.slack_access_bot_token')) {
                            notimsg = 'Recording saved. A streaming link will be send to '+ GLOBAL.getMyID() + ' and Slack' + ' once meeting ends.';
                        }
                        this.get('notifications').recsaveinfo(notimsg, {title:"Recording saved.", autoClear: true, clearDuration: 10000});
                    }
                }
            }
            else if(notitype==='newchat'){
                if(this.get('flagshowrsidemenu')===false){
                    let notimessage = '<span class="el"> <strong>' + msgdata.split(':')[0] + '</strong>' + msgdata.substring(msgdata.indexOf(':')) + '</span>';
                    this.get('notifications').chatinfo(notimessage, {title:"New message", autoClear: true});
                }
                else{
                    ucEngine.Chats.sendReadData(this.get('confinfo.keyID'), GLOBAL.lastmsginfo.keyID, GLOBAL.lastmsginfo.msgID, 1);
                }
            }
            else if(notitype==='mediachange'){
                if(msgID==='audio'){
                    let hostmember = this.get('store').peekRecord('member', this.get('confinfo.owner'));
                    this.get('notifications').msginfo(hostmember.get('displayname') + ' has muted you.', {autoClear: true});
                }
                // else if(msgID==='video'){
                //     this.get('notifications').msginfo(this.get('confinfo.owner') + ' has turned off your camera.', {autoClear: true});
                //     //this.get('notifications').info('Host mute my video', {autoClear: true});
                // }
            }
            else if(notitype==='duplicate'){
                let id = msgID;
                this.get('notifications').msginfo('Log in Another device', {autoClear: false, onClick: function(){
                    this.get('notifications').clearAll();
                    // this.get('store').unloadAll();
                    this.get('session').invalidate();
                }.bind(this)});
            }
        }
    }
});
