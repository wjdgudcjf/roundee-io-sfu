import { set } from '@ember/object';
import {inject as service} from '@ember/service';
import {computed} from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
    store: service('store'),
    tagName: 'div',
    classNames: ['nl'],

    // notesinfo: computed('notesinfo', 'notesinfo.{[],@notesinfo}', function(){
    //     let n = this.get('notesinfo')
    //     GLOBAL.error('noteType1:' + JSON.stringify(n.get('noteType')));
    //     // let allMessageData;
    //     // if(this.get('notesinfo')) {
    //     //     allMessageData  = this.get('notesinfo').sortBy('msgDateTime').toArray();
    //     // }
    //     // return allMessageData;
    // }),

    didRender() {
        this._super(...arguments);
        $('#note-msg-area-div').scrollTop($('#note-msg-area-div')[0].scrollHeight);
    },

    didInsertElement() {
        this._super(...arguments);
        let notesinfo = this.get('notesinfo');
        let note_id = notesinfo.get('noteID');
        if(notesinfo.get('noteType')==='favorite') {
          $("#circle_btn_"+note_id).addClass('imgChange').html('<img src="../img/video/small_star.svg" alt="">');
        } else if(notesinfo.get('noteType')==='question') {
          $("#circle_btn_"+note_id).addClass('imgChange').html('<img src="../img/video/small_question.svg" alt="">');
        } else if(notesinfo.get('noteType')==='money') {
          $("#circle_btn_"+note_id).addClass('imgChange').html('<img src="../img/video/small_money.svg" alt="">');
        } else if(notesinfo.get('noteType')==='calendar') {
          $("#circle_btn_"+note_id).addClass('imgChange').html('<img src="../img/video/small_calendar.svg" alt="">');
        } else if(notesinfo.get('noteType')==='idea') {
          $("#circle_btn_"+note_id).addClass('imgChange').html('<img src="../img/video/small_idea.svg" alt="">');
        }

        $("textarea.autosize").on('keydown keyup', function () {
            let sHeight = $(this).val().length;
        		if(sHeight < 29){
        			$(this).css('height','16px');
        			$(this).next('button').css('line-height','')
        		} else if(sHeight > 29 && sHeight <90) {
        			$(this).css('height','48px');
        			$(this).next('button').css('line-height','70px')
        		} else {
        			$(this).css('height','80px');
        			$('.tWrite button').css('line-height','102px')
        		}
      	});

        //GLOBAL.error('noteType1:' + JSON.stringify(notesinfo.get('noteType')));
    },

    actions: {
      selecticon(note_id, selectitem){
          let item = $("#" +selectitem+"_"+note_id);
          let imgSrc = item.find('img').attr('src');

          if(selectitem==='favorite') {
            imgSrc = "../img/video/small_star.svg";
          } else if(selectitem==='question') {
            imgSrc = "../img/video/small_question.svg";
          } else if(selectitem==='money') {
            imgSrc = "../img/video/small_money.svg";
          } else if(selectitem==='calendar') {
            imgSrc = "../img/video/small_calendar.svg";
          } else if(selectitem==='idea') {
            imgSrc = "../img/video/small_idea.svg";
          }

          $("#circle_btn_"+note_id).addClass('imgChange').html('<img src="' + imgSrc + '" alt="">');
          $("#circle_btn_" + note_id).removeClass('on');
          item.parents('.iconPop').hide();
          //this.set('notesinfo.noteType', selectitem);
          ucEngine.Chats.updateMsgItem(GLOBAL_MODULE.getConfID(), this.get('notesinfo.keyID'), {noteType: selectitem});
          this.get('store').push({data: {id: note_id, type: 'notes', attributes: {noteType: selectitem}}});

      },

      removecategory(note_id) {
          $("#circle_btn_" + note_id).removeClass('on');
          $('.iconPop').hide();
          ucEngine.Chats.updateMsgItem(GLOBAL_MODULE.getConfID(), this.get('notesinfo.keyID'), {noteType: null});
          this.get('store').push({data: {id: note_id, type: 'notes', attributes: {noteType: null}}});
          $("#circle_btn_"+note_id).removeClass('imgChange').html('+');
      },

      fnOpenPop_icon(Idx){
        let this_idx = $('#circle_btn_' + Idx);
        var parVal = this_idx.parents('.nl')
        var textVal = parVal.find('.cmc').text();
        //var textVal1 = parVal.find('.comment').children('textarea').val();
        parVal.find('.circle').addClass('on');
        parVal.find('.iconPop').show();

        //iconpop hover event
        $('.iconPop .con button').hover(function(){
            var imgSrc = $(this).find('img').attr('src');
            if(imgSrc) {
                $(this).find('img').attr('src' , imgSrc.replace('_on','_off'));
            }
        }, function(){
            var imgSrc = $(this).find('img').attr('src');

            if(imgSrc) {
                $(this).find('img').attr('src' , imgSrc.replace('_off','_on'));
            }
        });
      },


      fnOpenPop_del(Idx){
        let this_idx = $('#delete_btn_' + Idx);
        let parVal = this_idx.parents('.nl');
        let textVal = parVal.find('.cmc').text()
        parVal.find('.del').show().children('.con').text(textVal);

        //cancel button click event
        parVal.find('.bt').children('button').eq(0).click(function(){
            parVal.find('.del').hide().children('.con').text();
        });

        //delete button click event
        parVal.find('.bt').children('button').eq(1).click(function(){
            parVal.find('.del').hide()
            parVal.remove();

            //this.get('store').push({data: {id: Idx, type: 'notes', attributes: {noteMsg: 'del'}}});
            let noteinfo = this.get('store').peekRecord('notes', Idx, {backgroundReload: false});
            ucEngine.Chats.deleteMsgItem(GLOBAL_MODULE.getConfID(), this.get('notesinfo.keyID'));
            noteinfo.deleteRecord();
        }.bind(this));
      },


      fnClose_icon(Idx){
        $('#Icon_' + Idx).hide();
        $('#circle_btn_' + Idx).removeClass('on');
        $('body').css('overflow','auto');
        $('#Icon_' + Idx).prev('a').removeClass('on');
      },


      fnClose_del(Idx) {
        let this_idx = $('#' + Idx);
        this_idx.parent().remove();
        $('body').css('overflow','auto');
      },

      fnEditMode(idx){
        let thisobject = $('#editBox_' + idx);
        let parVal = thisobject.parents('.nl');
        let textVal = parVal.find('.cmc').text();
        var textVal1 = parVal.find('.comment').children('textarea').val();
        thisobject.parent('span').hide();
        thisobject.parent('span').next('span').show();
        parVal.find('.comment').children('textarea').val(textVal).show().focus().prev('.cmc').hide();
        parVal.find('.comment').css('background','#f8f8f8');

        let sHeight = textVal1.length;
        let textarea_note = parVal.find('.comment').children('textarea');
        if(sHeight < 29){
            textarea_note.css('height','16px');
            textarea_note.next('button').css('line-height','')
        }
        else if(sHeight > 29 && sHeight <90) {
            textarea_note.css('height','48px');
            textarea_note.next('button').css('line-height','70px')
        }
        else {
            textarea_note.css('height','80px');
            $('.tWrite button').css('line-height','102px')
        }
      },

      fnSaveMode(idx){
        let thisobject = $('#conform_Save_' + idx);
        let parVal = thisobject.parents('.nl');
        let textVal = parVal.find('.cmc').text();
        var textVal1 = parVal.find('.comment').children('textarea').val();
        thisobject.parent('span').hide();
        thisobject.parent('span').prev('span').show();
        parVal.find('.comment').children('.cmc').text(textVal1).show().next('textarea').focusout().hide();
        parVal.find('.comment').css('background','');
        ucEngine.Chats.updateMsgItem(GLOBAL_MODULE.getConfID(), this.get('notesinfo.keyID'), {noteType: this.get('notesinfo.noteType'), msgData: textVal1});
        this.get('store').push({data: {id: idx, type: 'notes', attributes: {noteMsg: textVal1}}});
      },

      fnCancelMode(idx){
        let thisobject = $('#cancel_Save_' + idx);
        let parVal = thisobject.parents('.nl');
        let textVal = parVal.find('.cmc').text();
        thisobject.parent('span').hide();
        thisobject.parent('span').prev('span').show();
        parVal.find('.comment').children('.cmc').show().next('textarea').focusout().hide();
        parVal.find('.comment').css('background','');
      },
    }
});
