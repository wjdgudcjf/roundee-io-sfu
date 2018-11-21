import { inject as service } from '@ember/service';
import { computed, set } from '@ember/object';
import { debounce } from '@ember/runloop';
import Component from '@ember/component';

export default Component.extend({
    store: service('store'),

    tagName: 'div',
    classNames: ['comunicate'],

    scrollbottomposition: true,
    notescrollposition: 'bottom',
    shiftenter: false,
    chatKeyUpActivated: false,

    textareascrollheight: -1,

    showchat: computed('defaulttype', function(){
        if(this.get('defaulttype')!=='note'){
            return true;
        }
        return false;
    }),

    msgdata: computed('chatdata', 'chatdata.{[],@each}', function(){
        let allMessageData;
        if(this.get('chatdata')) {
            allMessageData  = this.get('chatdata').sortBy('msgDateTime').toArray();
        }
        return allMessageData;
    }),

    onScroll(e){
        let scrollbottomposition = e.target.scrollHeight - e.target.clientHeight;
        // if($("#chatCon")[0].scrollTop === scrollbottomposition){
        if(e.target.scrollTop === scrollbottomposition){
            this.set('scrollbottomposition', true);
        }
        else{
            this.set('scrollbottomposition', false);
        }
    },

    didRender() {
        this._super(...arguments);
        if(this.get('showchat')){
            if(!$("#Chat").hasClass('current')){
                $("#Chat").addClass('current')
            }
            if($("#Notes").hasClass('current')){
                $("#Notes").removeClass('current')
            }

            if($("#chatCon")[0]&&!$("#chatCon")[0].onscroll){
                $("#chatCon")[0].onscroll = function(event){
                    debounce(this, this.onScroll.bind(this), event, 100);
                }.bind(this);
            }
        }
        else{
            if($("#Chat").hasClass('current')){
                $("#Chat").removeClass('current')
            }
            if(!$("#Notes").hasClass('current')){
                $("#Notes").addClass('current')
            }

            if(!$("#noteMsgType")[0].onkeyup){
                $("#noteMsgType")[0].onkeyup = function(event){
                    if($("#noteMsgType").val().trim().length > 0){
                        this.set('chatKeyUpActivated', true);
                    }
                    else{
                        this.set('chatKeyUpActivated', false);
                    }
                }.bind(this);
            }

            if($("#note-msg-area-div")[0]&&!$("#note-msg-area-div")[0].onscroll){
                $("#note-msg-area-div")[0].onscroll = function(event){
                    debounce(this, this.onScroll.bind(this), event, 100);
                }.bind(this);
            }
        }

        $('#chatMsgType').focus();
    },

    didInsertElement() {
        this._super(...arguments);

        if(this.get('defaulttype')!=='note'){
            if(!$("#Chat").hasClass('current')){
                $("#Chat").addClass('current');
            }
            if(this.get('host')){
                if($("#Notes").hasClass('current')){
                    $("#Notes").removeClass('current');
                }
            }
        }
        else{
            if($("#Chat").hasClass('current')){
                $("#Chat").removeClass('current');
            }
            if(this.get('host')){
                if(!$("#Notes").hasClass('current')){
                    $("#Notes").addClass('current');
                }
            }
        }
    },

    // keyUp(event){
    //     if(event.target.id==='chatMsgType'){
    //         let msgdata = document.getElementById('chatMsgType');
    //         let msg_area = document.getElementById('chat-msg-area-div');
    //         let textarea = $('#chatMsgType');
    //         //calculate the width of text
    //         let body = $('body');
    //         let text = textarea.val();
    //         let calc = '<div style="clear:both;display:block;visibility:hidden;"><span style="width;inherit;margin:0;font-family:'  + textarea.css('font-family') + ';font-size:'  + textarea.css('font-size') + ';font-weight:' + textarea.css('font-weight') + '">' + text + '</span></div>';
    //         body.append(calc);
    //         var width = $('body').find('span:last').width();
    //         body.find('span:last').parent().remove();
    //
    //         if(textarea.val().split(/\r*\n/).length===1) {
    //             msgdata.style.height = "16px";
    //             msg_area.style.height = 'calc(100% - 76px)';
    //             this.set('shiftenter', false);
    //         }
    //
    //         //GLOBAL.error('keydown:' + textarea.val().split(/\r*\n/).length);
    //
    //         if(this.get('shiftenter')) {
    //             msgdata.style.height = "62px";
    //             msg_area.style.height = 'calc(100% - 122px)';
    //             $("#chat-msg-area-div").scrollTop($("#chat-msg-area-div")[0].scrollHeight);
    //         }
    //         else if(width > 217){
    //             msgdata.style.height = "62px";
    //             msg_area.style.height = 'calc(100% - 122px)';
    //             $("#chat-msg-area-div").scrollTop($("#chat-msg-area-div")[0].scrollHeight);
    //         }
    //         else {
    //             msgdata.style.height = "16px";
    //             msg_area.style.height = 'calc(100% - 76px)';
    //         }
    //     }
    //     else if(event.target.id==='noteMsgType'){
    //         let notedata = $("#noteMsgType");
    //         if(notedata.val().trim().length >0) {
    //             this.set('chatKeyUpActivated', true);
    //         }
    //         else {
    //             this.set('chatKeyUpActivated', false);
    //         }
    //     }
    // },
    //
    // keyDown(event){
    //     if(event.target.id==='chatMsgType'){
    //         let msgdata = document.getElementById('chatMsgType');
    //         let msg_area = document.getElementById('chat-msg-area-div');
    //         let textarea = $('#chatMsgType');
    //
    //         if (this._isShiftEnter(event)) {
    //             this._super(event);
    //             this.set('shiftenter', true);
    //         }
    //         else if(this._isAltEnter(event)) {
    //             this._super(event);
    //             let value = textarea.val();
    //             value = value+"\r\n";
    //             $('#chatMsgType').val(value).trigger('input');
    //             $('#chatMsgType').scrollTop($("#chatMsgType")[0].scrollHeight);
    //             this.set('shiftenter', true);
    //         }
    //         else if(event.keyCode===13){
    //             let msgdata = $("#chatMsgType");
    //             event.preventDefault();
    //             if(msgdata.val().trim().length >0) {
    //                 $("#send_btn").click();
    //             }
    //         }
    //         //calculate the width of text
    //         let body = $('body');
    //         let text = textarea.val();
    //         let calc = '<div style="clear:both;display:block;visibility:hidden;"><span style="width;inherit;margin:0;font-family:'  + textarea.css('font-family') + ';font-size:'  + textarea.css('font-size') + ';font-weight:' + textarea.css('font-weight') + '">' + text + '</span></div>';
    //         body.append(calc);
    //         var width = $('body').find('span:last').width();
    //         body.find('span:last').parent().remove();
    //
    //         if(this.get('shiftenter')) {
    //             msgdata.style.height = "62px";
    //             msg_area.style.height = 'calc(100% - 122px)';
    //             $("#chat-msg-area-div").scrollTop($("#chat-msg-area-div")[0].scrollHeight);
    //         }
    //         else if(width > 217){
    //             msgdata.style.height = "62px";
    //             msg_area.style.height = 'calc(100% - 122px)';
    //             $("#chat-msg-area-div").scrollTop($("#chat-msg-area-div")[0].scrollHeight);
    //         }
    //         else {
    //             msgdata.style.height = "16px";
    //             msg_area.style.height = 'calc(100% - 76px)';
    //         }
    //     }
    //     else if(event.target.id==='noteMsgType'){
    //         if(event.keyCode===13){
    //             let notedata = $("#noteMsgType");
    //             event.preventDefault();
    //             $("#send_note_btn").click();
    //             this.set('chatKeyUpActivated', true);
    //         }
    //     }
    // },

    keyDown(event){
        if(event.target.id==='chatMsgType'){
            if(event.keyCode===8 || event.keyCode===46){
                document.getElementById('chatMsgType').style.height = '';
            }
            else if((event.keyCode===13&&event.shiftKey)||(event.keyCode===13&&event.altKey)){
                if(event.keyCode===13&&event.shiftKey){
                    event.preventDefault();
                }
                let value = $('#chatMsgType').val();
                value = value+"\r\n";
                $('#chatMsgType').val(value).trigger('input');
                $('#chatMsgType').scrollTop($("#chatMsgType")[0].scrollHeight);
            }

            else if(event.keyCode===13){
                this.send('sendMsg_form');
                event.preventDefault();
            }
        } else if(event.target.id==='noteMsgType'){
            if(event.keyCode===13){
                this.send('sendNote');
                event.preventDefault();
            }
        }
    },

    // _isShiftEnter: function(event) {
    //     if (event.keyCode !== undefined) {
    //         if ( event.keyCode === 13 && event.shiftKey ) {
    //             return true;
    //         }
    //     }
    // },
    //
    // _isAltEnter: function(event) {
    //     if (event.keyCode !== undefined) {
    //         if ( event.keyCode === 13 && event.altKey ) {
    //             event.preventDefault();
    //             return true;
    //         }
    //     }
    // },

    actions: {
        inputdata(){
            this.set('textareascrollheight', $("#chatMsgType")[0].scrollHeight);
            $("#chatMsgType").height($("#chatMsgType")[0].scrollHeight-20);

            let linecount = $("#chatMsgType").height()/16;
            if(linecount===2){
                if($(".chatCon").hasClass('line3')){
                    $(".chatCon").removeClass('line3');
                }
                if(!$(".chatCon").hasClass('line2')){
                    $(".chatCon").addClass('line2')
                }
                if(this.get('scrollbottomposition')){
                    $("#chatCon")[0].scrollTop = $("#chatCon")[0].scrollHeight - $("#chatCon")[0].clientHeight;
                }
            }
            else if(linecount===3){
                if($(".chatCon").hasClass('line2')){
                    $(".chatCon").removeClass('line2');
                }
                if(!$(".chatCon").hasClass('line3')){
                    $(".chatCon").addClass('line3')
                }
                if(this.get('scrollbottomposition')){
                    $("#chatCon")[0].scrollTop = $("#chatCon")[0].scrollHeight - $("#chatCon")[0].clientHeight;
                }
            }
            else if(linecount <= 1){
                if($(".chatCon").hasClass('line2')){
                    $(".chatCon").removeClass('line2');
                }
                if($(".chatCon").hasClass('line3')){
                    $(".chatCon").removeClass('line3')
                }
            }
        },

        chatAreaClose(){
            this.get('chatAreaClose')();
        },

        sendMsg_form() {
            let msgdata = $("#chatMsgType");
            if(msgdata.val().trim().length >0) {
                let senddate = null;
                let enddate = null;
                let nowdate = new Date();
                senddate = new Date(Date.parse(nowdate));
                let body = {
                    "msgID":GLOBAL.genMsgID(),
                    "senderName": GLOBAL.getMyName(),
                    "roomID": GLOBAL_MODULE.getConfID(),
                    "sender":GLOBAL.getMyID(),
                    "msgDateTime": senddate.toISOString(),
                    "msgData": msgdata.val(),
                    "msgType":"text",
                    "type":"text"
                };

                this.set('shiftenter', false);

                this.get('store').push({data: {id: body.msgID, type: 'logmsg', attributes: body}});
                ucEngine.Chats.sendMsgData(GLOBAL_MODULE.getConfID(), 1, body);
                msgdata.val('');
                msgdata.css('height', "16px");
                let confinfo = this.get('confinfo');
                if(confinfo.get('usechat')!=='Y'){
                    GLOBAL.info('conference_usechat:Y');
                    ucEngine.Conf.updateConferenceReserve(GLOBAL_MODULE.getConfID(), {usechat: 'Y'}, null);
                }
            }
            if($(".chatCon").hasClass('line2')){
                $(".chatCon").removeClass('line2');
            }
            if($(".chatCon").hasClass('line3')){
                $(".chatCon").removeClass('line3')
            }
            this.set('scrollbottomposition', true);
        },

        sendNote() {
            // TODO: Change Code
            let notedata = $("#noteMsgType");
            if(notedata.val().trim().length > 0){
                let rectime = document.getElementById('recBtn');
                let rec_timer = rectime.children[1];
                let note_id = GLOBAL.genNotesID();
                let nowdate = new Date();
                let senddate = new Date(Date.parse(nowdate));

                let note_body = {
                    msgID: note_id,
                    senderName: GLOBAL.getMyName(),
                    roomID: GLOBAL_MODULE.getConfID(),
                    sender: GLOBAL.getMyID(),
                    msgDateTime: senddate.toISOString(),
                    msgData:  notedata.val(),
                    recordtimer: rec_timer.innerHTML,
                    noteType: null,
                    msgType: CONST.CHAT_TYPE_NOTE,
                    type: CONST.CHAT_TYPE_NOTE
                }

                this.get('store').push({data: {id: note_id, type: 'notes', attributes: {noteID: note_id,  noteMsg: notedata.val(), noteTimer: rec_timer.innerHTML, noteType: null} }});
                notedata.val('');

                notedata.css('height','16px');
                $('.nWrite button').css('line-height','');
                ucEngine.Chats.sendMsgData(GLOBAL_MODULE.getConfID(), 1, note_body);
            }
        },

        open_ChatNote(item) {
            if(item==='Chat') {
                this.set('showchat', true);
                ucEngine.Chats.sendReadData(this.get('confinfo.keyID'), GLOBAL.lastmsginfo.keyID, GLOBAL.lastmsginfo.msgID, 1);
            }
            else{
                this.set('showchat', false);
            }
            // $('.comunicate').find('.current').removeClass('current').next('div').hide();
            // $('#' + item).addClass('current').next('div').show();
            //
            // let scrollTop = $('.comunicate ul').scrollTop();
            // let scrollTop1 = $('.comunicate .notes > ul').scrollTop();
            // let chatHeight =$('.chat ul')[0].scrollHeight; // 스크롤을 포함한 전체 길이
            // let chatHeight1 =$('.chat ul').outerHeight(); // 스크롤시 최하단 높이
            //
            // if(chatHeight > chatHeight1){
            //     $('.chat .scroll').css('opacity' , '1').show();
            // }
            // else {
            //     $('.chat .scroll').css('opacity' , '0').hide();
            // }
            //
            // $('.notes .scroll').css('opacity' , '1').show();
        },

        fnClose(Idx){
            $('#' + Idx).hide();
            $('body').css('overflow','auto');
        },

        fnOpenPop_icon(Idx){
            let this_idx = $('#noteIcon');
            this_idx.next('.iconPop').show();

            //iconpop hover event
            $('.iconPop .con button').hover(function(){
                var imgSrc = $(this).find('img').attr('src');
                $(this).find('img').attr('src' , imgSrc.replace('_on','_off'));
            }, function(){
                var imgSrc = $(this).find('img').attr('src');
                $(this).find('img').attr('src' , imgSrc.replace('_off','_on'));
            });
        },

        selecticon(selectitem){
            let item = $("#" +selectitem);
            let imgSrc = item.find('img').attr('src');
            item.parents('.iconPop').hide();
            GLOBAL.info('selected note:' + selectitem);

            let rectime = document.getElementById('recBtn');
            let notedata = $("#noteMsgType");
            let rec_timer = rectime.children[1];
            //let node_id = GLOBAL.genNotesID();
            // let note_body = {
            //     "noteID": node_id,
            //     "noteMsg": null,
            //     "noteTimer": rec_timer.innerHTML,
            //     "noteType":selectitem
            // };
            //
            // this.get('store').push({data: {id: node_id, type: 'notes', attributes: note_body}});

            let note_id = GLOBAL.genNotesID();
            let nowdate = new Date();
            let senddate = new Date(Date.parse(nowdate));


            let note_body = {
                msgID: note_id,
                senderName: GLOBAL.getMyName(),
                roomID: GLOBAL_MODULE.getConfID(),
                sender: GLOBAL.getMyID(),
                msgDateTime: senddate.toISOString(),
                msgData:  null,
                recordtimer: rec_timer.innerHTML,
                noteType: selectitem,
                msgType: CONST.CHAT_TYPE_NOTE,
                type: CONST.CHAT_TYPE_NOTE
            }

            this.get('store').push({data: {id: note_id, type: 'notes', attributes: {noteID: note_id,  noteMsg: null, noteTimer: rec_timer.innerHTML, noteType: selectitem} }});
            ucEngine.Chats.sendMsgData(GLOBAL_MODULE.getConfID(), 1, note_body);
        }
    }
});
