import { inject as service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
    store: service('store'),
    router: service(),
    session: service('roundee-auth'),
    tagName: 'div',
    classNames: ['container_in'],

    errorcheck: true,

    didInsertElement() {
        this._super(...arguments);
        $("#inputuser").on('blur', function(){
            let userid = this.get('userid');
            if( $('#inputuser').val().length!=0) {
                if(this.checkemail(userid)){
                    this.set('errorcheck', true);
                }
                else{
                    this.set('errorcheck', false);
                }
            }
            else{
                this.set('errorcheck', true);
            }
        }.bind(this));

        $("#inputuser").on('focus', function(){
            this.set('errorcheck', true);
        }.bind(this));
    },

    checkemail(_email){
        let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(_email).toLowerCase());
    },

    actions: {
        joinmeeting(){
            let userid = this.get('userid');
            if(this.checkemail(userid)){
                this.set('errorcheck', true);
                // Processing Sign-in
                let authinfo = this.getProperties('userid');
                let confinfo = sessionStorage.getItem('roundee_io:confinfo');
                if(confinfo!==undefined&&confinfo!==null&&confinfo!==''){
                    confinfo = GLOBAL.transStrToObj(confinfo);
                    confinfo.userid = authinfo.userid;
                    authinfo =  confinfo;
                    authinfo.iscreate = false;
                    sessionStorage.removeItem('roundee_io:confinfo');
                }
                else{
                    if(this.get('store').peekAll('conferenceroom').length > 0){
                        confinfo = {roomid: this.get('store').peekAll('conferenceroom').content[0].id}
                        confinfo.userid = authinfo.userid;
                        authinfo =  confinfo;
                        authinfo.iscreate = false;
                    }
                }
                this.session.authenticate(authinfo).then(function(response){
                    sessionStorage.setItem('roundee_io:auth', GLOBAL.transObjToStr(response));
                    this.get('router').transitionTo('video-call.index', response.roomid);
                }.bind(this));
            }
            else{
                this.set('errorcheck', false);
            }
        }
    }
});
