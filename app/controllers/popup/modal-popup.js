import { computed, set } from '@ember/object';
import Controller from '@ember/controller';

export default Controller.extend({
    
    issettingmodal: false,
    isinvitemodal : false,
    leavemodel: computed('object', function(){
        let modaltype = this.get('object');
        if(modaltype==='leave'){
            set(this, 'issettingmodal', false);
            set(this, 'isinvitemodal', false);
            return true;
        }
        else if(modaltype==='setting'){
            set(this, 'issettingmodal', true);
            set(this, 'isinvitemodal', false);
        }
        else if(modaltype==='invitepeople'){
            set(this, 'isinvitemodal', true);
            set(this, 'issettingmodal', false);
        }
        return false;
    })
});
