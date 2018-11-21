import { computed, set } from '@ember/object';
import { inject as service } from '@ember/service';
import { later } from '@ember/runloop';
import Component from '@ember/component';

export default Component.extend({
    tagName: 'div',
    classNameBindings: ['sender:host:guest'],

    urltype: false,
    msgData: null,

    sender: computed('msginfo.sender', function(){
        if(this.get('msginfo.sender')===GLOBAL.getMyID()){
            return true;
        }
        return false;
    }),

    didRender() {
        this._super(...arguments);
        let msginfo = this.get('msginfo');
        $('#chatCon').scrollTop($('#chatCon')[0].scrollHeight);
    },

    didInsertElement() {
        this._super(...arguments);
        let msginfo = this.get('msginfo');
        $('#chatCon').scrollTop($('#chatCon')[0].scrollHeight);
        // 아래 Code 확인 필요.
        if(msginfo.get('msgType')===CONST.CHAT_TYPE_TEXT){
            let chatmsgarray = msginfo.get('msgData').replace(/\</g,"&lt;").split('\n');  //convert < to &lt;
            let msgData ='';
            for(var i=0, n=chatmsgarray.length; i<n; i++){
                let chatmsgrow = chatmsgarray[i].split(' ');
                let msgDataRow ='';
                for(var j=0, m=chatmsgrow.length; j<m; j++){
                    if(chatmsgrow[j]) {
                        if(GLOBAL_MODULE.validEmail(chatmsgrow[j])){  //email address
                            msgDataRow += ' <a href="mailto:'+ chatmsgrow[j] +'" target="_blank" style="color:blue;">' + chatmsgrow[j] +'</a>';
                        }
                        else if(GLOBAL_MODULE.validURL(chatmsgrow[j])) {   // url address
                            if(chatmsgrow[j].toLowerCase().indexOf('https://') >= 0 || chatmsgrow[j].toLowerCase().indexOf('http://') >= 0) {
                                msgDataRow += ' <a href="'+ chatmsgrow[j] +'" target="_blank" style="color:blue;">' + chatmsgrow[j] +'</a>';
                            }
                            else {
                                msgDataRow += ' <a href="'+ '//' + chatmsgrow[j] +'" target="_blank" style="color:blue;">' + chatmsgrow[j] +'</a>';
                            }
                        }
                        else {
                            msgDataRow += ' ' + chatmsgrow[j];
                        }
                    }
                }
                msgData +=  '<p>' + msgDataRow + '</p>';
            }

            set(this, 'msgData', msgData);
            if(GLOBAL.getMyID()===msginfo.get('sender')) {
                this.set('ownermsg', true);
            }
        }
        else if(msginfo.get('msgType')===CONST.CHAT_TYPE_INVITE || msginfo.get('msgType')===CONST.CHAT_TYPE_KICK){
            set(this, 'msgData', msginfo.get('msgData'));
        }
    },
});
