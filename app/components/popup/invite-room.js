import { getOwner } from '@ember/application';
import EmberObject, { computed, set } from '@ember/object';
import { inject as service } from '@ember/service';
import { bind, later } from '@ember/runloop';
import Component from '@ember/component';
import config from '../../config/environment';

export default Component.extend({
    store: service('store'),
    session: service('roundee-auth'),
    tagName: 'div',
    classNames: ['invitePop'],

    checkemail: true,
    sendinvite: false,

    livepaticipants: computed('members.{[],@each,@each.mstate,@each.displayname,@each.state}', function(){
        let result = 0;
        let cmembers = this.get('store').peekAll('member').toArray();
        for(let i=0, n=cmembers.length; i<n; i++){
            if(cmembers[i].get('state')==='join'){
                result++;
            }
        }
        GLOBAL.debug('live members=' + result);
        if(result===6) {
            $(".full").css('display','inline-block');
            return '0';
        }
        else {
            $(".full").css('display','none');
            return parseInt(6-result);
        }
    }),


    pendingpaticipants: computed('members.{[],@each,@each.mstate,@each.displayname,@each.state}', function(){
        let result = 0;
        let invitation_email_val = localStorage.getItem(GLOBAL.getMyID() + '_invitation_email');
        let conf_storage = localStorage.getItem(GLOBAL.getMyID() + '_invitation_confid');
        if(conf_storage===GLOBAL.getConfID()) {
          if(invitation_email_val) {
            let invitation_email_array = invitation_email_val.split(',');
            let cmembers = this.get('store').peekAll('member').toArray();
            let add_user = '';
            let seperated_comma = ',';
            $('.mailcon > ul').empty();

            for(let j=0, m=invitation_email_array.length; j<m; j++){
                let match = false;
                for(let i=0, n=cmembers.length; i<n; i++){
                    if(!match) {
                      if(invitation_email_array[j]===cmembers[i].get('userid')) {
                        if(cmembers[i].get('state')==='join'){
                          match= true;
                        }
                      }
                    }
                }

              if(!match) {
                if(add_user.length===0) {
                    seperated_comma ='';
                } else {
                    seperated_comma =',';
                }

                add_user = add_user + seperated_comma + invitation_email_array[j];

                $('.mailcon > ul').append('<li>' + invitation_email_array[j] + '</li>');
                GLOBAL.info('pending_paticipants=' + invitation_email_array[j]);
              }
            }

            GLOBAL.info('pendingpaticipants executed');
            $('.email strong').text($('.mailcon > ul > li').length);
            if($('.mailcon > ul > li').length!==0) {
              $('.email').show();
            } else {
              localStorage.removeItem(GLOBAL.getMyID() + '_invitation_email');
              $('.email').hide();
            }
          localStorage.setItem(GLOBAL.getMyID() + '_invitation_email', add_user);
        }
      } else {
         localStorage.setItem(GLOBAL.getMyID() + '_invitation_confid', GLOBAL.getConfID());
         localStorage.removeItem(GLOBAL.getMyID() + '_invitation_email');
      }
    }),


    currentURL: computed(function() {
        return window.location.origin + window.location.pathname;
    }),

    checkEmailRegex: function(_email){
        var result = false;
        var regex = /^(\w+)([\-+.\'0-9A-Za-z_]+)*@(\w[\-\w]*\.){1,5}([A-Za-z]){2,6}$/

        if(regex.test(_email) === false){
            result = false;
        }
        else{
            result = true;
        }
        this.set('checkemail', result);
        return result;
    },

    click(event){
        if(event.target.id==='email-invite'){
            this.set('sendinvite', false);
        }
    },

    didInsertElement() {
        this._super(...arguments);
        $("#email-invite").on('blur', function(){
            let inputEmail = $("#email-invite").val().toLowerCase().trim();
            if(inputEmail.length > 0) {
                let checkmails = inputEmail.split(',');
                for(let i=0; i<checkmails.length; i++){
                    if(!this.checkEmailRegex(checkmails[i])){
                        $(".wrong").css('display','inline-block');
                        $(".sendemail").css('display','none');
                        return;
                    }
                }
            }
        }.bind(this));

        $("#email-invite").on('focus', function(){
            this.set('checkemail', true);
        }.bind(this));
    },

    actions: {
        closePopup(){
            let route = getOwner(this).lookup("route:video-call.index");
            route.send("closeModal");
        },

        copylink() {
            $('.linkPop').css('display', 'block');
            let copyText = document.getElementById("currenturl");
            let textArea = document.createElement("textarea");
            textArea.value = copyText.textContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("Copy");
            textArea.remove();

            later(function(){
                $('.linkPop').css('display', 'none');
            }.bind(this), 4000);
        },

        send_ind() {
            let selectUser = [];
            let body = {
                invitee: []
            };

            let inputEmail = $("#email-invite").val().toLowerCase().trim();
            if(inputEmail.split(',').length===1) {
                if(!this.checkEmailRegex(inputEmail)){
                    $(".wrong").css('display','inline-block');
                    $(".sendemail").css('display','none');
                    return;
                }
            }

            if(inputEmail.length){
                let invitation_email_val = localStorage.getItem(GLOBAL.getMyID() + '_invitation_email');
                let invited_users = '';
                if(invitation_email_val) {
                    invited_users = invitation_email_val;
                }

                let moreemail = inputEmail.split(',');
                for(let i=0, n=moreemail.length; i<n; i++){
                    if(this.checkEmailRegex(moreemail[i].trim())){
                        if(moreemail[i]!=='') {
                            body['invitee'].push({"userid": moreemail[i].trim() ,"type": 0});

                            $('.mailcon > ul').append('<li>' + moreemail[i].trim() + '</li>');

                            if(invited_users.indexOf(moreemail[i].trim())===-1) {
                              if(invited_users) {
                                invited_users = invited_users + ',' + moreemail[i].trim();
                              } else {  //first time
                                invited_users = invited_users + moreemail[i].trim();
                              }
                            }
                        }
                    }
                }

                $('.email').show();
                $('.email strong').text($('.mailcon > ul > li').length);

                localStorage.setItem(GLOBAL.getMyID() + '_invitation_email', invited_users);
                localStorage.setItem(GLOBAL.getMyID() + '_invitation_confid', GLOBAL.getConfID());

                GLOBAL.info('invited user by email:' + JSON.stringify(body));

                let conferenceInviteComplete = function(e){
                        $("#email-invite").val('');
                        $(".wrong").css('display','none');
                        $(".sendemail").css('display','inline-block');
                        this.set('sendinvite', true);
                  }.bind(this);

                //sending email
                ucEngine.Conf.inviteConferenceRoom(GLOBAL_MODULE.getConfID(), body, {onComplete:conferenceInviteComplete.bind(this), onError: function(e){
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
                }.bind(this) });
            }
        }
    }
});
