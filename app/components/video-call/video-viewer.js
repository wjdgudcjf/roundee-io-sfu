import { bind } from '@ember/runloop';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
    session: service('roundee-auth'),
    tagName: 'div',
    classNames: ['lb'],

    loadedvideo: false,
    audioon: true,

    remotevideowidth: 640,
    remotevideoheight: 480,

    isSafari: computed(function(){
        if(adapter.browserDetails.browser==='safari'){
            return true;
        }
        return false;
    }),

    resizewindow: computed('viewermembers.[]', 'windowsize.@each', 'showrsidemenu', function(){
        this.repositionvideobox();
    }),

    ismine: computed(function(){
        if(this.get('viewerinfo.userid')){
            if(this.get('viewerinfo.userid')===GLOBAL.getMyID()){
                return true;
            }
        }
        return false;
    }),

    host: computed('confinfo.owner', 'viewerinfo.userid', function(){
        if(this.get('confinfo.owner') && this.get('viewerinfo.userid')){
            if(this.get('confinfo.owner') === this.get('viewerinfo.userid')){
                return true;
            }
        }
        return false;
    }),

    mstate: computed('viewerinfo.mstate', function(){
        let state = this.get('viewerinfo.mstate');
        switch(state){
            case 'all':{
                $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .cameraBg').hide();
                if($('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').hasClass('on')){
                    $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').removeClass('on')
                }
                this.set('audioon', true);
            }
            break;
            case 'videoonly':{
                $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .cameraBg').hide();
                if(!$('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').hasClass('on')){
                    $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').addClass('on')
                }
                this.set('audioon', false);
            }
            break;
            case 'audioonly':{
                $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .cameraBg').show();
                if($('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').hasClass('on')){
                    $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').removeClass('on')
                }
                this.set('audioon', true);
            }
            break;
            default: {
                $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .cameraBg').show();
                if(!$('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').hasClass('on')){
                    $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').addClass('on')
                }
                this.set('audioon', false);
            }
        }
    }),

    // user function
    onSuccessGetViewer(event){
        let video = $('video[id=\"' + this.get('viewerinfo.userid') + '\" ]')[0];
        if(video!==undefined&&video!==null){
            if(!video.paused){
                video.pause();
                video.src = '';
                video.load();
            }
            video.muted = true;
            video.srcObject = event.streams[0];
        }
    },

    onFailGetViewer(error){
        GLOBAL.error('Get Viewer Fail ['+this.get('viewerinfo.userid')+'] = ' + error.message);
    },

    loadedvideostream(event){
        let width = event.target.videoWidth;
        let height = event.target.videoHeight;

        if(event.target.videoWidth > 0 && event.target.videoHeight > 0){
            this.set('remotevideowidth', width);
            this.set('remotevideoheight', height);
            this.set('loadedvideo', true);
            this.repositionvideobox();
        }
    },

    videodomtimeupdate(event){
        let width = this.get('remotevideowidth');
        let height = this.get('remotevideoheight');
        if(event.target.videoWidth > 0 && event.target.videoHeight > 0){
            if(width!==event.target.videoWidth || height !==event.target.videoHeight){
                this.set('remotevideowidth', event.target.videoWidth);
                this.set('remotevideoheight', event.target.videoHeight);
                this.repositionvideobox();
            }
        }
    },

    repositionvideobox(){
        let totalviewercount = this.get('viewermembers').length;

        let width = this.get('remotevideowidth');
        let height = this.get('remotevideoheight');
        let realratio = parseFloat(width/height);
        let basicratio = parseFloat(640/480);

        let containerwidth = parseFloat($(window).width() - 70);
        let containerheight = parseFloat($(window).height() - 80 - 50);
        let containerratio = parseFloat(containerwidth/containerheight);

        if(this.get('showrsidemenu')){
            containerwidth = parseFloat(containerwidth - 320);
        }
        // container의 height 중 50px 정도 width 70px는 여백으로 사용을 해야 함.

        let videoviewerwidth = -1;
        let videoviewerheight = -1;

        if(totalviewercount===2){
            containerwidth = parseFloat(containerwidth/2);
        }
        else if(totalviewercount===3 || totalviewercount===4){
            let tempviewercontainerwidth = parseFloat(containerwidth/totalviewercount);
            let tempviewercontainerheight = parseFloat(tempviewercontainerwidth /  basicratio);

            if(parseFloat(tempviewercontainerheight*2) > containerheight){
                // only using 1 line for display video box
                containerwidth = parseFloat(containerwidth/totalviewercount);
            }
            else{
                // using 2 line for display video box
                containerwidth = parseFloat(containerwidth/2 - 10);
                containerheight = parseFloat(containerheight/2 - 10);
            }
        }
        else if(totalviewercount===5 || totalviewercount===6 ){
            let tempviewercontainerwidth = parseFloat(containerwidth/totalviewercount);
            let tempviewercontainerheight = parseFloat(tempviewercontainerwidth /  basicratio);

            if(parseFloat(tempviewercontainerheight*2) > containerheight){
                containerwidth = parseFloat(containerwidth/totalviewercount);
            }
            else{
                containerwidth = parseFloat(containerwidth/3 - 15);
                containerheight = parseFloat(containerheight/2 - 10);
            }
        }

        if(containerratio > realratio){
            // height 기준.
            videoviewerheight = containerheight;
            videoviewerwidth = parseFloat(videoviewerheight * realratio);
            if(videoviewerwidth > containerwidth){
                videoviewerwidth = containerwidth;
                videoviewerheight = parseFloat(videoviewerwidth/realratio);
            }
        }
        else{
            // width 기준
            videoviewerwidth = containerwidth;
            videoviewerheight = parseFloat(videoviewerwidth/realratio);
            if(videoviewerheight > containerheight){
                videoviewerheight = containerheight;
                videoviewerwidth = parseFloat(videoviewerheight * realratio);
            }
        }

        $('div[id=\"' + this.get('viewerinfo.userid')+ '\"]').width(videoviewerwidth);
        $('div[id=\"' + this.get('viewerinfo.userid')+ '\"]').height(videoviewerheight);
    },


    didInsertElement() {
        this._super(...arguments);
        if(this.get('viewerinfo.userid')===GLOBAL.getMyID()){
            // local media display
            if(this.get('viewerinfo.devicestatus')==='all'||this.get('viewerinfo.devicestatus')==='videoonly'){
                $('video[id=\"' + this.get('viewerinfo.userid') + '\" ]').addClass('rotation');
                $('video[id=\"' + this.get('viewerinfo.userid') + '\" ]')[0].srcObject = ucEngine.Video.mainstream;
                $('video[id=\"' + this.get('viewerinfo.userid') + '\" ]')[0].muted = true;
            }
            else{
                this.loadedvideo = true;
            }
        }
        else{
            // get viewer media
            ucEngine.Video.getViewer({type: 'viewer', viewerid: this.get('viewerinfo.userid'), devicetype: this.get('viewerinfo.devicetype'), onSuccess: this.onSuccessGetViewer.bind(this), onFail: this.onFailGetViewer.bind(this)});
        }

        this.repositionvideobox();

        let state = this.get('viewerinfo.mstate');
        switch(state){
            case 'all':{
                $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .cameraBg').hide();
                if($('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').hasClass('on')){
                    $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').removeClass('on')
                }
                this.set('audioon', true);
            }
            break;
            case 'videoonly':{
                $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .cameraBg').hide();
                if(!$('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').hasClass('on')){
                    $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').addClass('on')
                }
                this.set('audioon', false);
            }
            break;
            case 'audioonly':{
                $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .cameraBg').show();
                if($('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').hasClass('on')){
                    $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').removeClass('on')
                }
                this.set('audioon', true);
            }
            break;
            default: {
                $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .cameraBg').show();
                if(!$('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').hasClass('on')){
                    $('div[id=\"'+ this.get('viewerinfo.userid') + '\"] .soundBg').addClass('on')
                }
                this.set('audioon', false);
            }
        }
        let videodom = $('video[id=\"' + this.get('viewerinfo.userid') + '\" ]')[0];
        videodom.ontimeupdate =  this.videodomtimeupdate.bind(this);
        videodom.onloadeddata = this.loadedvideostream.bind(this);
    },

    didDestroyElement() {
        if(this.get('session').isAuthenticated){
            if(this.get('viewerinfo.userid')!==GLOBAL.getMyID()){
                ucEngine.Video.removeViewer({viewerid: this.get('viewerinfo.userid')});
            }
        }
        this._super(...arguments);
    },

    doubleClick(event){
        if(this.get('isfullscreen')){
            this.get('requestFullScreen')(this.get('viewerinfo.userid'));
            event.preventDefault();
        }
    },

    actions: {
        changeDisplayName(){
            if(this.get('viewerinfo.userid')){
                if(this.get('viewerinfo.userid')===GLOBAL.getMyID()){
                    $("#myNameLabel").hide();
                    $("#myNameInput").show().focus().on('blur', function(){
                        this.set('viewerinfo.displayname', $("#myNameInput").val());
                        ucEngine.Conf.updateConferenceUser(GLOBAL_MODULE.getConfID(), { displayname: $("#myNameInput").val() }, null);
                        $("#myNameInput").hide();
                        $("#myNameLabel").show();
                    }.bind(this));

                    $("#myNameInput").on('keyup', function(event){
                        if(event.keyCode === 13) {
                            this.set('viewerinfo.displayname', $("#myNameInput").val());
                            ucEngine.Conf.updateConferenceUser(GLOBAL_MODULE.getConfID(), { displayname: $("#myNameInput").val() }, null);
                            $("#myNameInput").hide();
                            $("#myNameLabel").show();
                        }
                    }.bind(this));
                }
            }
        },

        micOnOff(val){
            if(val==='on'){
                this.set('audioon', true);
            }
            else{
                this.set('audioon', false);
            }
            this.get('micOnOff')(this.get('viewerinfo.userid'), val==="on"?false:true);
        },

        requestFullScreen(){
            this.get('requestFullScreen')(this.get('viewerinfo.userid'));
        },

        closeFullScreen(){
            this.get('closeFullScreen')(this.get('viewerinfo.userid'));
        }
    }
});
