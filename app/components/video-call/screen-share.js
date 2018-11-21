import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
    tagName: 'div',
    classNames: ['share'],

    sendrequestid: null,

    isowner: computed('type', function(){
        if(this.get('type')==='owner'){
            return true;
        }
        return false;
    }),

    stopsharing(event){
        this.get('startscreenshare')();
    },

    recvExtensionMessage(event){
        if(event.origin!==window.location.origin){
            return;
        }
        if(event.data.type==='roundeeForSlackGotScreen' && this.sendrequestid){
            this.sendrequestid = null;
            if(event.data.sourceId === undefined || event.data.sourceId === ""){
                // user cancel
                this.send('stopscreenshare');
            }
            else{
                //this.getScreenMedia(event.data.sourceId)
                ucEngine.Video.startScreenShare({type:'screenshare', mode: 'owner', mediasourceId:event.data.sourceId, onSuccess: this.screenShareSuccess.bind(this)});
            }
        }
        else if(event.data.type==='roundeeForSlackGetScreenPending'){
            // 최초 Popup이 뜨는경우.
        }
    },

    screenShareSuccess(param){
        if(param.mode==='owner'){
            ucEngine.Video.screensharesession.getSenders()[0].track.onended = this.stopsharing.bind(this);
        }
        else{
            let video = document.querySelector("#screenshareviewer");
            video.srcObject = param.streams[0];
            video.muted = true;
        }
    },

    didInsertElement() {
        this._super(...arguments);
        if(!$(".sCon").hasClass("Sharescreen")){
            $(".sCon").addClass("Sharescreen");
        }

        if(this.get('type')==='owner'){
            this.sendrequestid = this.id;
            if(adapter.browserDetails.browser==='firefox'){
                let firefoxVer = parseInt(window.navigator.userAgent.match(/Firefox\/(.*)/)[1], 10);
                if(firefoxVer < 52){
                    window.postMessage({ type: 'roundeeForSlackGetScreen', id: this.sendrequestid }, '*');
                    window.addEventListener('message', this.recvExtensionMessage.bind(this));
                }
                else{
                    ucEngine.Video.startScreenShare({type:'screenshare', mode: 'owner', onSuccess: this.screenShareSuccess.bind(this)});
                }
            }
            else{
                // this.getScreenMedia();
                window.postMessage({ type: 'roundeeForSlackGetScreen', id: this.sendrequestid }, '*');
                window.addEventListener('message', this.recvExtensionMessage.bind(this));
            }
        }
        else{
            // this.screenshareViewer();
            ucEngine.Video.startScreenShare({type:'screenshare', mode: 'viewer', onSuccess: this.screenShareSuccess.bind(this)});
        }
    },

    willDestroyElement() {
        this._super(...arguments);
        ucEngine.Video.stopScreenShare();
        if($(".sCon").hasClass("Sharescreen")){
            $(".sCon").removeClass("Sharescreen");
        }
    },

    actions: {
        stopscreenshare(){
            this.get('startscreenshare')();
        },

        requestFullScreen(){
            this.get('requestFullScreen')('screenshare');
        },

        closeFullScreen(){
            this.get('closeFullScreen')('screenshare');
        }
    }
});
