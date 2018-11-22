import { computed } from '@ember/object';
import config from '../config/environment';
import { inject as service } from '@ember/service';
import { Promise, resolve } from 'rsvp';
import { run, bind } from '@ember/runloop';
import { debug } from '@ember/debug';
import { isEmpty } from '@ember/utils';
import Service from '@ember/service';

export default Service.extend({
    store: service('store'),
    accessToken: null,
    authprocessingstatue: 'start',

    isAuthenticated: computed.bool('accessToken'),

    init() {
        this._super(...arguments);
        window.addEventListener('storage', bind(this, this._handleStorageEvent));
    },

    _handleStorageEvent(e){
        if(e.key==='roundee_io:auth'){
            let sessioninfo = sessionStorage.getItem('e.key');
            if(sessioninfo===undefined||sessioninfo===null||sessioninfo===''){
                this.invalidate();
            }
            else{
                sessioninfo = GLOBAL.transStrToObj(sessioninfo);
                if(sessioninfo.access_token!=='ok'){
                    this.invalidate();
                }
            }
        }
    },

    willDestroyElement() {
        this._super(...arguments);
        window.removeEventListener('storage', bind(this, this._handleStorageEvent));
    },

    // user functions
    loginToServer : function(authinfo, resolve, reject, type) {
        // request server for login
        let onConnectionFail = function(){
            GLOBAL.error('UC Server Connect Fail!');
            this.set('accessToken', null);
            run(function() {
                this.set('authprocessingstatue', 'complete');
                reject('loginFail');
            }.bind(this));
        };

        let onLogin = function(){
            GLOBAL.info('onLogin');
        };

        let onLoginFail = function(param){
            // delete all properties about login and stop engine
            // ucEngine.stop('web login fail', true);
            sessionStorage.clear();
            GLOBAL.error('onLoginFail = ' + (param!==undefined&&param!==null&&param!=="")?GLOBAL.transObjToStr(param):" unknown error");
            this.set('accessToken', null);
            run(function() {
                this.set('authprocessingstatue', 'complete');
                reject('loginFail');
            }.bind(this));
        };

        let onLoginProgress = function(progress){
            GLOBAL.info('onLoginProgress');
            let progressStatus = progress;
            if(progressStatus!==undefined && progressStatus.text === LOCALE.message.loginProgressComplete){
                if(type==="auth"){
                    this.get('store').unloadAll('conferenceroom');
                }
                else{
                    let roomID = authinfo.roomid;
                    if(roomID!==undefined&&roomID!==null&&roomID!==""){
                        // if conference room exist, shoud be request roominfo
                        this.get('store').push({data:{id: roomID, type: 'conferenceroom', attributes:{keyID:roomID}}});
                    }
                }
            }
        };

        let onLogInSuccess = function(){
            GLOBAL.info('onLoginSuccess');
            this.get('store').push({data:{id: GLOBAL.getMyID(), type: 'member', attributes:{userid: GLOBAL.getMyID(), displayname: GLOBAL.getMyName(), quality: 'high', mstate: 'all'}}});
        };

        let onStartComplete = function(){
            GLOBAL.info('nStartComplete');
            let roomID = authinfo.roomid;
            GLOBAL.setEncData('server.downloadUrl', config.APP.domain);

            if(type==='auth'){
                if(authinfo.iscreate===false){
                    // participant conference join
                    let completeChatRoomInfo = function(e){
                        GLOBAL.setConfID(roomID);
                        run(function(){
                            this.set('authprocessingstatue', 'complete');
                            this.set('accessToken', {access_token: 'ok', userid: GLOBAL.getEncData("myProfile.id"), displayname: GLOBAL.getMyName(), login_response: GLOBAL.getEncData("register.response"), roomid: roomID});
                            resolve({
                                access_token: 'ok',
                                userid: GLOBAL.getEncData("myProfile.id"),
                                displayname: GLOBAL.getMyName(),
                                login_response: GLOBAL.getEncData("register.response"),
                                roomid: roomID
                            });
                        }.bind(this));
                    }

                    ucEngine.Chats.getChatRoomInfo(1, roomID, {requestType: 'sys', onComplete: completeChatRoomInfo.bind(this)});
                }
                else{
                    // owner room
                    let tz = "";
        			let nowdate = new Date();
        			let tzname = jstz.determine().name();
        			let tzoffsetvalue = nowdate.getTimezoneOffset();
        			let tzoffsetstring = (tzoffsetvalue >= 0?"-":"+") + parseInt(Math.abs(tzoffsetvalue)/60).zf(2) + ":" + parseInt(Math.abs(tzoffsetvalue)%60).zf(2);

                    let startdate = null;
        			let enddate = null;
        			startdate = new Date(Date.parse(nowdate));
        			enddate = new Date(Date.parse(nowdate) + (1000*60*50));
                    //roomID = GLOBAL.genConferenceID();
                    roomID = GLOBAL.getEncData('device.uuid');

                    // owner conference create
                    let body = {
                              name: GLOBAL.getMyName() + '\'s meeting',
                              desc: 'add a description',
                              type: 0,                                    // 0: instance, 1: create, 2: etc
                              password: "",
                              start_time: startdate.toISOString(),
                              end_time:  enddate.toISOString(),
                              time_offset: tzoffsetstring,
                              time_zone: tzname,
                              state: 'scheduled',
                              device: 'PC_' + config.APP.browsertype,
                              owner: authinfo.userid,
                              members: [authinfo.userid],
                              emails: [authinfo.userid],
                              cmembers: [{userid: GLOBAL.getMyID(), displayname: GLOBAL.getMyName(), quality: 'high', mstate: 'all'}]
                    };

                    this.get('store').push({data:{id: roomID, type: 'conferenceroom', attributes: {
                        name: GLOBAL.getMyName() + '\'s meeting',
                        desc: 'add a description',
                        type: 0,                                    // 0: instance, 1: create, 2: etc
                        password: "",
                        start_time: startdate.toISOString(),
                        end_time:  enddate.toISOString(),
                        time_offset: tzoffsetstring,
                        time_zone: tzname,
                        state: 'scheduled',
                        device: 'PC_' + config.APP.browsertype,
                        owner: authinfo.userid,
                        members: [authinfo.userid],
                        emails: [authinfo.userid],
                    }}});

                    let conferenceCreateComplete = function(e){
                        GLOBAL.setConfID(roomID);
                        run(function(){
                            this.set('authprocessingstatue', 'complete');
                            this.set('accessToken', {access_token: 'ok', userid: GLOBAL.getEncData("myProfile.id"), displayname: GLOBAL.getMyName(), login_response: GLOBAL.getEncData("register.response"), roomid: roomID});
                            resolve({
                                access_token: 'ok',
                                userid: GLOBAL.getEncData("myProfile.id"),
                                displayname: GLOBAL.getMyName(),
                                login_response: GLOBAL.getEncData("register.response"),
                                roomid: roomID
                            });
                        }.bind(this));
                    }

                    ucEngine.Conf.newConferenceReserve(roomID, body, {onComplete:conferenceCreateComplete.bind(this)});
                }
            }
            else if(type==='restore'){
                let completeChatRoomInfo = function(e){
                    GLOBAL.setConfID(authinfo.roomid);
                    run(function(){
                        this.set('authprocessingstatue', 'complete');
                        this.set('accessToken', {access_token: 'ok', userid: GLOBAL.getEncData("myProfile.id"), displayname: GLOBAL.getMyName(), login_response: GLOBAL.getEncData("register.response"), roomid: roomID});
                        resolve({
                            access_token: 'ok',
                            userid: GLOBAL.getEncData("myProfile.id"),
                            displayname: GLOBAL.getMyName(),
                            login_response: GLOBAL.getEncData("register.response"),
                            roomid: roomID
                        });
                    }.bind(this));
                };
                ucEngine.Chats.getChatRoomInfo(1, authinfo.roomid, {requestType: 'sys', onComplete: completeChatRoomInfo.bind(this)});
                // ucEngine.Chats.getChatRoomInfo(1, authinfo.roomid, {onComplete: completeChatRoomInfo.bind(this)});
            }
        };

        let onError = function(e){
            GLOBAL.error("Web Socket Error Code = " + e.code + " name = " + e.message);
            switch(e.code){
                case 4001:{
                    GLOBAL.NotiHandle.send( 'showmessagenoti', 'duplicate', GLOBAL.getMyID() );
                    // this.invalidate();
                }
            }
        };

        let CallBackConnectionFail = onConnectionFail.bind(this);
        let CallBackLogin = onLogin.bind(this);
        let CallBackLoginFail = onLoginFail.bind(this);
        let CallBackLoginProgress = onLoginProgress.bind(this);
        let CallBackLogInSuccess = onLogInSuccess.bind(this);
        let CallBackStartComplete = onStartComplete.bind(this);
        let CallBackError = onError.bind(this);

        ucEngine.start('web_start',{ onConnectionFail:CallBackConnectionFail, onLogin:CallBackLogin, onLoginFail:CallBackLoginFail,
        onLoginProgress:CallBackLoginProgress, onLogInSuccess:CallBackLogInSuccess, onStartComplete:CallBackStartComplete, onError: CallBackError}, this.get('store'));
    },

    authenticate(authinfo){
        GLOBAL.info("Authorization is authenticate");
        this.set('authprocessingstatue', 'pending');
        GLOBAL.info("authenticate Input Data ID = [" + authinfo.userid + "]");
        GLOBAL.setEncData("server_url", "wss://" + config.APP.engine_server_url + ":7060");
        GLOBAL.setEncData("server.name", config.APP.engine_server_url);

        //GLOBAL.setEncData('device.uuid', GLOBAL.createUUID());
        if(authinfo.roomid){
            GLOBAL.setEncData('device.uuid', authinfo.roomid);
        }
        else{
            GLOBAL.setEncData('device.uuid', GLOBAL.genConferenceID());
        }
        GLOBAL.setEncData("register.response", '');
        GLOBAL.setMyID('');

        if(authinfo.name!==undefined&&authinfo.name!==null){
            GLOBAL.setMyName(authinfo.name);
        }
        else{
            GLOBAL.setMyName(authinfo.userid.split('@')[0]);
        }

        return new Promise(function(resolve, reject) {
            // 암호화를 위한 작업 진행.
            let webloginid = authinfo.userid;
            let password = "";
            let salt = password + ':' + 'BeeUC';

			let HA1 = CryptoJS.PBKDF2(password, salt, { keySize: 160/32, iterations: salt.length });
			let HA2 = CryptoJS.MD5('login:BeeUC');

            GLOBAL.setEncData("HA1", '' + HA1);
            GLOBAL.setEncData("HA2", '' + HA2);

            GLOBAL.setMyID(webloginid);
            this.loginToServer(authinfo, resolve, reject, "auth");
        }.bind(this));
    },

    restore(authinfo){
        // session restore(ex. browser refresh ...)
        GLOBAL.info("Authorization is restore");
        this.set('authprocessingstatue', 'pending');
        this.get('store').push({data:{id: authinfo.roomid, type: 'conferenceroom', attributes:{keyID:authinfo.roomid}}});
        this.get('store').push({data:{id: authinfo.userid, type: 'member', attributes:{userid: authinfo.userid, quality: 'high', mstate: 'all'}}});
        return new Promise(function(resolve, reject) {
            // Ember 인증이 살아있는 경우는 인증을 계속 유지 시켜 주어야 함.
            if (!isEmpty(authinfo.access_token)) {
                this.loginToServer(authinfo, resolve, reject, "restore");
            }
            else{
                reject();
            }
        }.bind(this));
    },

    invalidate(){
        sessionStorage.clear();
        this.set('accessToken', null);
    }
});
