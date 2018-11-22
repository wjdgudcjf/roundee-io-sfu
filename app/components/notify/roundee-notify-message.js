import { computed, set } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
    // tagName: 'div',
    tagName: 'li',
    classNameBindings: [ 'notiClass','dismissClass' ],
    notiContentClass: "popup-notify-content",
    //notiContentClass: "rStart",
    //notiContentClass: "sTit",
    networkinfo: false,
    startinfo: false,
    stopinfo: true,
    showclose: false,

    dismissClass: computed('notification.dismissClass', function(){
        if(!this.get('notification.dismissClass')){
            return "show";
        }
    }),

    notiTitleClass: computed('notification.title', function(){
        let title = this.get('notification.title');
        if(title!==undefined&&title!==null){
            let notiType = this.get('notification.type');
            //this.set('notiTitleContentClass', 'popup-notify-title '+ notiType);
            this.set('notiTitleContentClass', 'sCon');
            if(notiType==="alert"){
                this.set('notiContentClass', 'popup-notify-content alert withtitle');
            }
            else{
                this.set('notiContentClass',  'popup-notify-content withtitle');
            }
            //return "popup-notify-icon " + notiType;
            return "sTit";
        }
    }),

    notiClass: computed('notification.type', function(){
        let notiType = this.get('notification.type');
        let classname = "";
        switch(notiType){
            case "recinfo":{
                classname =  "rStart";
            }
            break;

            case "recotheruserinfo":{
                classname =  "rUser";
                this.set('showclose', true);
            }
            break;

            case "recsaveinfo":{
                classname =  "rSave";
            }
            break;

            case "refreshinfo":{
                classname =  "uRref";
            }
            break;

            case "recstopinfo":{
                classname =  "uStop";
                this.set('showclose', true);
            }
            break;

            case "settingsavedinfo":{
                classname =  "sEnd";
            }
            break;

            case "msginfo":{
                classname =  "sMsg";
            }
            break;

            case "noteaddinfo":{
                classname =  "nAdd";
            }
            break;

            case "notenorecaddinfo":{
                classname =  "rSave";
            }
            break;

            case "chatinfo":{
                classname =  "uChat";
            }
            break;

            case "networkinfo":{
                set(this, 'networkinfo', true);
                classname =  "popup-notify networkinfo";
            }
            break;
        }
        return classname;
    }),

    click(event){
        if(this.get('notification.onClick')){
            this.get('notification.onClick')();
            //window.location.reload(true);
        }
    },

    actions: {
      closenotification() {
        $(".rUser").hide();
        $(".uStop").hide();
      }
    }
});
