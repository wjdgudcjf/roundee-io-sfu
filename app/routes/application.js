import Route from '@ember/routing/route';
import config from '../config/environment';
import { inject as service } from "@ember/service";

export default Route.extend({
    session: service('roundee-auth'),

    beforeModel(transition) {
        let userAgent = navigator.userAgent;
        if(userAgent.match(/Mobile|Windows Phone|Lumia|Android|webOS|iPhone|iPod|Blackberry|PlayBook|BB10|Opera Mini|\bCrMo\/|Opera Mobi/i) ){
            // mobile
            // transition to mobile webapplication
            if(userAgent.match(/iPhone|iPod/i)){
                config.APP.devicetype = 'iphone';
            }
            else{
                config.APP.devicetype = 'android';
            }

            let mobileurl = config.APP.domain + '/mobile';
            let targetname = transition.targetName;
            //meeting.index
            if(targetname==='sign-in.index'){
                mobileurl += '/sign-in';
            }
            else if(targetname==='video-call.index'){
                mobileurl += '/video-call';
                mobileurl += ('/' + transition.params['video-call.index'].roomid);
            }

            if(!$.isEmptyObject(transition.queryParams)){
                let keys = Object.keys(transition.queryParams);
                for(let i=0, n=keys.length; i<n; i++){
                    if(i===0){
                        mobileurl += ("?" + keys[i] + "=" + transition.queryParams[keys[i]]);
                    }
                    else{
                        mobileurl += ("&" + keys[i] + "=" + transition.queryParams[keys[i]]);
                    }
                }
            }
            transition.abort();

            if(transition.queryParams.integrationname==='slack') {
                if(config.APP.devicetype === 'iphone') {
                    let url =  mobileurl;
                    window.location.replace(config.APP.domain + "/browser-not-supported-slack?urlkey=" + url);
                    return;
                }
            }
            window.location.replace(mobileurl);
        }
        else{
            // browser check
            let bSupportBrowser = true;

            if(userAgent.indexOf("Opera") !== -1 || userAgent.indexOf("OPR") !== -1){
                config.APP.browsertype = "opera";
            }
            else if (userAgent.indexOf("Firefox") !== -1){
                config.APP.browsertype = "firefox";
            }
            else if (userAgent.indexOf("Chrome") !== -1){
                config.APP.browsertype = "chrome";
                if(userAgent.indexOf("Edge") !== -1){
                    bSupportBrowser = false;
                    config.APP.browsertype = "edge";
                }
            }
            else if(userAgent.indexOf("Safari") !== -1){
                let safariversion = parseFloat(userAgent.substr(userAgent.indexOf("Version")).split(' ')[0].split('/')[1]);
                if(safariversion < 11.0){
                    bSupportBrowser = false;
                }
                else{
                    config.APP.browsertype = "safari";
                }
            }

            if(bSupportBrowser){
                let sessioninfo = sessionStorage.getItem('roundee_io:auth');
                if(sessioninfo!==undefined&&sessioninfo!==null&&sessioninfo!==""){
                    sessioninfo = GLOBAL.transStrToObj(sessioninfo);

                    if(transition.params['video-call.index']!==undefined){
                        if(transition.params['video-call.index'].roomid===sessioninfo.roomid){
                            this.set('session.accessToken', sessioninfo);
                            this.session.restore(sessioninfo);
                        }
                        else{
                            //this.set('session.accessToken', null);
                            this.session.invalidate();
                        }
                    }
                    else{
                        this.set('session.accessToken', sessioninfo);
                        this.session.restore(sessioninfo);
                    }
                }

                if(!this.session.isAuthenticated){
                    if(transition.params['video-call.index']!==undefined){
                        let roomid = null;
                        let userid = null;

                        try{
                            roomid = transition.params['video-call.index'].roomid;
                        }
                        catch(e){
                            GLOBAL.error(e.message);
                            roomid = null;
                            transition.abort();
                            this.transitionTo('sign-in.index');
                        }

                        if(roomid!==undefined&&roomid!==null&&roomid!==""){
                            userid = transition.queryParams.id;
                            if(userid!==undefined&&userid!==null&&userid!==""){
                                transition.abort();
                                this.get('session').authenticate({ roomid: roomid, userid: userid, name: transition.queryParams.name, email: transition.queryParams.email, integrationname: transition.queryParams.integrationname, iscreate: false }).then(function(response){
                                    sessionStorage.setItem('roundee_io:auth', GLOBAL.transObjToStr(response));
                                    this.transitionTo('video-call.index', roomid);
                                }.bind(this));
                            }
                            else{
                                sessionStorage.setItem('roundee_io:confinfo', GLOBAL.transObjToStr({ roomid: roomid, userid: userid, name: transition.queryParams.name, email: transition.queryParams.email, integrationname: transition.queryParams.integrationname }));
                                this.transitionTo('sign-in.index');
                            }
                        }
                    }
                    else{
                        let userid = transition.queryParams.id;
                        if(userid){
                            transition.abort();
                            this.get('session').authenticate({ userid: userid, email: userid, iscreate: true }).then(function(response){
                                sessionStorage.setItem('roundee_io:auth', GLOBAL.transObjToStr(response));
                                this.transitionTo('video-call.index', response.roomid);
                            }.bind(this));
                        }
                        else{
                            this.transitionTo('sign-in.index');
                        }
                    }
                }
            }
            else{
                transition.abort();
                let url = window.location.href;
                window.location.replace(config.APP.domain + "/browser-not-supported?urlkey=" + url);
            }
        }
        this._super(...arguments);
    }
});
