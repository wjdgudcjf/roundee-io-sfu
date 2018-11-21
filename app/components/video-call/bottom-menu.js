import { inject as service } from '@ember/service';
import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
    notifications: service('roundee-notify'),
    store: service('store'),
    tagName: 'div',

    videoon: true,
    audioon: true,

    rectimer: null,
    rectime: '00:00',
    totalrecordingtime: 0,

    show5minnoti: false,

    // labelRecordingMsg: null,
    // //labelPresent: 'You can not start screen share while the other participant is sharing.',
    // labelPresent: 'Currently in use.',
    // labelSafariPresent: 'Not supported in Safari.',

    issafari: computed(function(){
        if(adapter.browserDetails.browser==='safari'){
            return true;
        }
        return false;
    }),

    unreadcount: computed('confinfo.unreadcnt', 'chatdata.[]', function(){
        let unreadcnt = 0;

        let logmsg_info = this.get('store').peekAll('logmsg').toArray();
        if(logmsg_info.length>0) {
            for(let i=0; i< logmsg_info.length; i++){
                if(logmsg_info[i].get('keyID') > GLOBAL.lastreadkey){
                    unreadcnt++;
                }
            }
        }
        else{
            unreadcnt = 0;
        }

        if(unreadcnt<=0){
            return null;
        }
        return unreadcnt;
    }),

    mediastatus: computed('myinfo.{mstate,devicestatus}', function(){
        if(this.get('myinfo.devicestatus')==='all'){
            if($("#menuvideo").hasClass('disable')){
                $("#menuvideo").removeClass('disable');
            }
            $("#btnvideo").prop('disabled', false);

            if($("#menuaudio").hasClass('disable')){
                $("#menuaudio").removeClass('disable');
            }
            $("#btnaudio").prop('disabled', false);
        }
        else if(this.get('myinfo.devicestatus')==='none'){
            if(!$("#menuvideo").hasClass('disable')){
                $("#menuvideo").addClass('disable');
            }
            $("#btnvideo").prop('disabled', true);

            if(!$("#menuaudio").hasClass('disable')){
                $("#menuaudio").addClass('disable');
            }
            $("#btnaudio").prop('disabled', true);
        }
        else if(this.get('myinfo.devicestatus')==='audioonly'){
            if(!$("#menuvideo").hasClass('disable')){
                $("#menuvideo").addClass('disable');
            }
            $("#btnvideo").prop('disabled', true);

            if($("#menuaudio").hasClass('disable')){
                $("#menuaudio").removeClass('disable');
            }
            $("#btnaudio").prop('disabled', false);
        }
        else if(this.get('myinfo.devicestatus')==='videoonly'){
            if($("#menuvideo").hasClass('disable')){
                $("#menuvideo").removeClass('disable');
            }
            $("#btnvideo").prop('disabled', false);

            if(!$("#menuaudio").hasClass('disable')){
                $("#menuaudio").addClass('disable');
            }
            $("#btnaudio").prop('disabled', true);
        }


        switch (this.get('myinfo.mstate')) {
            case 'all':{
                this.set('videoon', true);
                this.set('audioon', true);
            }
            break;
            case 'videoonly':{
                this.set('videoon', true);
                this.set('audioon', false);
            }
            break;
            case 'audioonly':{
                this.set('videoon', false);
                this.set('audioon', true);
            }
            break;
            default:{
                this.set('videoon', false);
                this.set('audioon', false);
            }
        }
    }),

    checkrecstate: computed('recordings', 'recordings.{[],@each.end_time}', function(){
        let recordinginfo = this.get('store').peekAll('recording').toArray();
        if(this.get('recon')){
            if(recordinginfo.length > 0) {
                let recordingtime = 0;
                let recordingstarttime = 0;
                for(let i=0, n=recordinginfo.length; i<n; i++){
                    if(recordinginfo[i].get('end_time')){
                        let starttime = new Date(recordinginfo[i].get('start_time')).getTime();
                        let endtime = new Date(recordinginfo[i].get('end_time')).getTime();
                        recordingtime += (endtime-starttime);
                    }
                    else{
                        let starttime = new Date(recordinginfo[i].get('start_time')).getTime();
                        let endtime = new Date().getTime() - GLOBAL.correctionTime;
                        recordingtime += (endtime-starttime);
                    }
                }

                this.set('totalrecordingtime', recordingtime);
                let processingTime = recordingtime/1000;
                let hour = parseInt(processingTime/3600);
                let min = parseInt((processingTime - hour*3600)/60);
                let sec = parseInt(processingTime - hour*3600 - min*60);

                this.startRecTimer();
            }
        }
        else{
            if(recordinginfo.length > 0) {
                let recordingtime = 0;
                let recordingstarttime = 0;
                for(let i=0, n=recordinginfo.length; i<n; i++){
                    if(recordinginfo[i].get('end_time')){
                        let starttime = new Date(recordinginfo[i].get('start_time')).getTime();
                        let endtime = new Date(recordinginfo[i].get('end_time')).getTime();
                        recordingtime += (endtime-starttime);
                    }
                }

                let processingTime = recordingtime/1000;
                let hour = parseInt(processingTime/3600);
                let min = parseInt((processingTime - hour*3600)/60);
                let sec = parseInt(processingTime - hour*3600 - min*60);

                let rectimer = this.get('rectimer');
                if(rectimer){
                    clearInterval(rectimer);
                }
                this.set('totalrecordingtime', recordingtime);
                this.set('rectime', min.zf(2) + ":" + sec.zf(2));
            }
        }
    }),


    didInsertElement() {
        this._super(...arguments);

        if(this.get('host')===false){
            if(!$('#bottommenu').hasClass('user')){
                $('#bottommenu').addClass('user');
            }
        }
        else{
            if($('#bottommenu').hasClass('user')){
                $('#bottommenu').removeClass('user');
            }
        }

        switch (this.get('myinfo.mstate')) {
            case 'all':{
                this.set('videoon', true);
                this.set('audioon', true);
            }
            break;
            case 'videoonly':{
                this.set('videoon', true);
                this.set('audioon', false);
            }
            break;
            case 'audioonly':{
                this.set('videoon', false);
                this.set('audioon', true);
            }
            break;
            default:{
                this.set('videoon', false);
                this.set('audioon', false);
            }
        }

        if(adapter.browserDetails.browser==='safari'){
            $("#menuscreenshare").addClass('disable sf');
            $("#btnscreenshare").prop('disabled', true);
        }

        if(this.get('myinfo.devicestatus')==='audioonly' || this.get('myinfo.devicestatus')==='none'){
            $("#menuvideo").addClass('disable');
            $("#btnvideo").prop('disabled', true);
        }

        if(this.get('myinfo.devicestatus')==='videoonly' || this.get('myinfo.devicestatus')==='none'){
            $("#menuaudio").addClass('disable');
            $("#btnaudio").prop('disabled', true);
        }
    },

    startRecTimer(){
        let recordingtime = this.get('totalrecordingtime');
        let timer = setInterval(function(){
            recordingtime += 1000;
            let processingTime = recordingtime/1000;
            let hour = parseInt(processingTime/3600);
            let min = parseInt((processingTime - hour*3600)/60);
            let sec = parseInt(processingTime - hour*3600 - min*60);
            if(hour > 0){
                // stop recording.
                // Reached the maximum 60 min notification
                this.get('notifications').recstopinfo('You have reached the maximum of 60 min free recording time per meeting.', {title:"Recording stopped", autoClear: false});
                this.get('recOnOff')();
            }
            else{
                if(min >= 55){
                    // refresh notification
                    if(!this.get('show5minnoti')){
                        this.get('notifications').msginfo('⌛️ 5 min recording time left.', {autoClear: true});
                        this.set('show5minnoti', true);
                    }
                }
            }
            this.set('rectime', min.zf(2) + ":" + sec.zf(2));
        }.bind(this), 1000);
        this.set('rectimer', timer);
    },

    isAvaiableRecording(){
        let recordinginfo = this.get('store').peekAll('recording').toArray();
        let recordingtime = 0;
        let recordingstarttime = 0;
        for(let i=0, n=recordinginfo.length; i<n; i++){
            if(recordinginfo[i].get('end_time')){
                let starttime = new Date(recordinginfo[i].get('start_time')).getTime();
                let endtime = new Date(recordinginfo[i].get('end_time')).getTime();
                recordingtime += (endtime-starttime);
            }
        }

        let processingTime = recordingtime/1000;
        let hour = parseInt(processingTime/3600);
        let min = parseInt((processingTime - hour*3600)/60);
        let sec = parseInt(processingTime - hour*3600 - min*60);

        if(hour<1){
            return true;
        }
        return false;
    },

    actions: {
        openInvite(){
            this.get('openInvite')();
        },

        videoOnOff(){
            let videoon = this.get('videoon');
            this.set('videoon', !videoon);
            this.get('videoOnOff')();
        },

        micOnOff(){
            let audioon = this.get('audioon');
            this.set('audioon', !audioon);
            this.get('micOnOff')();
        },

        recOnOff(){
            if(this.isAvaiableRecording()){
                let confinfo = this.get('confinfo');
                if(!confinfo.get('result_admin_mode')){
                    let result_admin_mode = 'ad'+ GLOBAL.genConferenceMode();
                    let result_note_view_mode = 'nv'+ GLOBAL.genConferenceMode();
                    let result_note_noview_mode = 'nn'+ GLOBAL.genConferenceMode();
                    GLOBAL.info('set the result_admin_mode');
                    ucEngine.Conf.updateConferenceReserve(GLOBAL_MODULE.getConfID(), {result_admin_mode: result_admin_mode, result_note_view_mode: result_note_view_mode, result_note_noview_mode: result_note_noview_mode}, null);
                }

                this.get('recOnOff')();
            }
        },

        startscreenshare(){
            if(!this.get('issafari')) {
                if(!this.get('confinfo.screen_share')||(this.get('confinfo.screen_share')===GLOBAL.getMyID())){
                    this.get('startscreenshare')();
                }
            }
        },

        setting(){
            this.get('setting')();
        },

        leaveRoom(){
            this.get('leaveRoom')();
        },

        chatAreaOpen(type){
            this.get('showrsidemenu')(type);
        }
    }
});
