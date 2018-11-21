import { getOwner } from '@ember/application';
import { computed } from '@ember/object';
import config from '../../config/environment';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
    store: service('store'),
    tagName: 'div',
    classNames: ['layerPop'],

    checkrecstate: computed('confinfo', function(){
        let recordinginfo = this.get('store').peekAll('recording').toArray();
        if(recordinginfo.length > 0) {
            let confinfo = this.get('confinfo');
            let owner = confinfo.get('owner');
            if(owner===GLOBAL.getMyID()){
                return true;
            } else {
                return false;
            }
        }
        return false;
    }),

    didInsertElement() {
        this._super(...arguments);
        let width = $(".layerPop .popup_in").width();
        $(".layerPop .popup_in")[0].style.left = "calc(50% -  " + parseFloat(width/2)+ "px)";
        let height = $(".layerPop .popup_in").height();
        $(".layerPop .popup_in")[0].style.top = "calc(50% - " + parseFloat(height/2) +"px)";
    },

    actions: {
        closePopup(){
            let route = getOwner(this).lookup("route:video-call.index");
            route.send("closeModal");
        },

        leaveRoom(){
            let confinfo = this.get('confinfo');
            let owner = confinfo.get('owner');
            let body = { type: 0 };

            this.send('closePopup');

            if(owner===GLOBAL.getMyID()){
                if(this.get('confinfo.recording')){
                    ucEngine.Conf.conferenceRecording(GLOBAL_MODULE.getConfID(), {recording: 0});
                }

                let recordings = this.get('store').peekAll('recording');
                if((recordings!==undefined)&&(recordings.toArray().length > 0)){
                    let confinfo = this.get('store').peekRecord('conferenceroom', GLOBAL_MODULE.getConfID());
                    let update_body = {};
                    if(confinfo.get('slack_access_bot_token')) {
                        update_body.send_to_bot_channel = 'Y';
                    }
                    update_body.send_recording = GLOBAL.getMyID();
                    ucEngine.Conf.updateConferenceReserve(GLOBAL_MODULE.getConfID(), update_body);
                    ucEngine.Conf.exitConferenceRoom(GLOBAL_MODULE.getConfID(), {type: 0});
                    ucEngine.logout();
                    sessionStorage.clear();
                    window.location.replace(config.APP.domain + '/thank_you.html');
                }
                else{
                    let confinfo = this.get('store').peekRecord('conferenceroom', GLOBAL_MODULE.getConfID());
                    ucEngine.Conf.exitConferenceRoom(GLOBAL_MODULE.getConfID(), {type: 0});
                    ucEngine.logout();
                    sessionStorage.clear();
                    window.location.replace(config.APP.domain + '/thank_you.html');
                }
            }
            else{
                  let confinfo = this.get('store').peekRecord('conferenceroom', GLOBAL_MODULE.getConfID());
                  ucEngine.Conf.exitConferenceRoom(GLOBAL_MODULE.getConfID(), {type: 0});
                  ucEngine.logout();
                  sessionStorage.clear();
                  window.location.replace(config.APP.domain + '/thank_you.html');
            }
        }
    }
});
