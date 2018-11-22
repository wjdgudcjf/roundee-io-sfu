import { inject as service } from '@ember/service';
import { computed } from '@ember/object';
import config from '../../config/environment';
import Controller from '@ember/controller';

export default Controller.extend({
    store: service('store'),
    session: service('roundee-auth'),

    checkdevice: false,
    videodevicelist: null,
    audiodevicelist: null,

    isAuthenticated: computed('session.{isAuthenticated,authprocessingstatue}', function(){
        if(this.get('session.authprocessingstatue')==='complete'){
            if(!this.get('session.isAuthenticated')){
                GLOBAL.error("transition to sign-in");
                this.transitionToRoute('sign-in.index');
                return false;
            }
            else{
                ucEngine.Video.checkDevice({getDevice: this.getDeviceList.bind(this), getDeviceFail: this.getDeviceFail.bind(this)});
                navigator.mediaDevices.ondevicechange = this.mediadevicechange.bind(this);
                return true;
            }
        }
        return false;
    }),

    membercount: computed('model.members.{[],@each}', function(){
        let members = this.get('store').peekAll('member').toArray();
        let joinmembercount = 0;
        for(let i=0, n=members.length; i<n; i++){
            if(members[i].get('state')==='join'){
                if(members[i].get('id')!==GLOBAL.getMyID()){
                  joinmembercount++;
                }
            }
        }
        if(joinmembercount >= 6){
            ucEngine.logout(function(){
                sessionStorage.clear();
                window.location.replace(config.APP.domain + '/room_full.html');
            }.bind(this));
        }
    }),

    conferencestate: computed('model.roominfo', function(){
        let conf_info = this.get('store').peekRecord('conferenceroom', GLOBAL.getConfID());
        let state = conf_info.get('state');
        GLOBAL.debug('state=' + state);
        GLOBAL.debug('slack mode:' + conf_info.get('slack_access_token'));

        if(state==='end' || state==='ended'){
            ucEngine.logout(function(){
                sessionStorage.clear();
                if(conf_info.get('slack_access_token')) {
                    window.location.replace(config.APP.domain + '/room_no_exist_slack');
                } else {
                  window.location.replace(config.APP.domain + '/room_no_exist');
                }
            }.bind(this));
        }
    }),

    //user function
    getDeviceList(devices){
        if(devices){
            if(devices.length===0){
                this.set('checkdevice', false);
            }
            else{
                devices.forEach(function(device){
                    if(device.kind==="audioinput"){
                        this.audiodevicelist.pushObject(device);
                    }
                    else if(device.kind==="videoinput"){
                        this.videodevicelist.pushObject(device);
                    }
                }.bind(this));

                let mstate = this.get('model.myinfo.mstate');
                let selectdevice = sessionStorage.getItem('selectdevice');
                if(selectdevice!==undefined&&selectdevice!==null&&selectdevice!==""){
                    selectdevice = GLOBAL.transStrToObj(selectdevice);
                }
                if(this.videodevicelist.length===0&&this.audiodevicelist.length===0){
                    // can't start video conference
                    this.get('store').push({data:{id: GLOBAL.getMyID(), type: 'member', attributes:{devicestatus: 'none', mstate: 'none'}}});
                    ucEngine.Conf.updateConferenceUser(GLOBAL_MODULE.getConfID(), {devicestatus: 'none', mstate: 'none'});
                    this.set('checkdevice', false);
                }
                else{
                    if(this.videodevicelist.length>0&&this.audiodevicelist.length===0){
                        // can't start video conference
                        mstate = mstate==='audioonly'?'none':'videoonly';
                        this.get('store').push({data:{id: GLOBAL.getMyID(), type: 'member', attributes:{devicestatus: 'videoonly', mstate: mstate}}});
                        ucEngine.Conf.updateConferenceUser(GLOBAL_MODULE.getConfID(), {devicestatus: 'videoonly', mstate: mstate});
                        if(!selectdevice||!selectdevice.video){
                            sessionStorage.setItem('selectdevice', GLOBAL.transObjToStr({video: this.videodevicelist[0].deviceId}));
                        }
                        this.set('checkdevice', false);
                    }
                    else if(this.videodevicelist.length===0&&this.audiodevicelist.length>0){
                        mstate = mstate==='videoonly'?'none':'audioonly';

                        this.get('store').push({data:{id: GLOBAL.getMyID(), type: 'member', attributes:{devicestatus: 'audioonly', mstate: mstate}}});
                        ucEngine.Conf.updateConferenceUser(GLOBAL_MODULE.getConfID(), {devicestatus: 'audioonly', mstate: mstate});
                        if(!selectdevice||!selectdevice.audio){
                            sessionStorage.setItem('selectdevice', GLOBAL.transObjToStr({audio: this.audiodevicelist[0].deviceId}));
                        }
                        this.set('checkdevice', true);
                    }
                    else{
                        // this.get('store').push({data:{id: GLOBAL.getMyID(), type: 'member', attributes:{devicestatus: 'all', mstate: 'all'}}});
                        this.get('store').push({data:{id: GLOBAL.getMyID(), type: 'member', attributes:{devicestatus: 'all'}}});
                        ucEngine.Conf.updateConferenceUser(GLOBAL_MODULE.getConfID(), {devicestatus: 'all'});
                        if(!selectdevice){
                            sessionStorage.setItem('selectdevice', GLOBAL.transObjToStr({video: this.videodevicelist[0].deviceId, audio: this.audiodevicelist[0].deviceId}));
                        }
                        else{
                            let selectvideodevice = null;
                            let selectaudiodevice = null;
                            if(!selectdevice.video){
                                selectvideodevice = this.videodevicelist[0].deviceId;
                            }

                            if(!selectdevice.audio){
                                selectaudiodevice = this.audiodevicelist[0].deviceId;
                            }
                            sessionStorage.setItem('selectdevice', GLOBAL.transObjToStr({video: !selectvideodevice?selectdevice.video:selectvideodevice, audio: !selectaudiodevice?selectdevice.audio:selectaudiodevice}));
                        }
                        this.set('checkdevice', true);
                    }
                }
            }
        }
        else{
            // can't start video conference
            this.set('model.myinfo.devicestatus', 'none');
            this.set('checkdevice', false);
        }
    },

    getDeviceFail(error){
        // GLOBAL.error(error.message);
        // alert(error.message);
        // can't start video conference
        this.set('checkdevice', false);
    },

    mediadevicechange(event){
        ucEngine.Video.checkDevice({getDevice: this.getDeviceList.bind(this), getDeviceFail: this.getDeviceFail.bind(this)});
    },

    init() {
        this._super(...arguments);
        this.videodevicelist = [];
        this.audiodevicelist = [];
    },
});
