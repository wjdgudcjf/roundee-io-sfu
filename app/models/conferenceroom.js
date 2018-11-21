import DS from 'ember-data';

const {Model, attr, hasMany} = DS;

let conferenceroom = Model.extend({
    keyID: attr('string'),
    seqID: attr('string'),
    name: attr('string'),
    desc: attr('string'),
    type: attr('number', {defaultvalue: 0}),
    password: attr('string'),
    start_time: attr('date'),
    end_time: attr('date'),
    time_offset: attr('string'),
    time_zone: attr('string'),
    owner: attr('string'),
    state: attr('string'),
    survey: attr('', {defaultvalue: []}),
    recording: attr('string', {defaultvalue: ''}),
    screen_share: attr('string', {defaultvalue: null}),
    // members: hasMany('member'),
    // recordings: hasMany('recording'),
    slack_access_token: attr('string'),
    slack_access_bot_token: attr('string'),
    slack_channel_name: attr('string'),
    slack_channel_id: attr('string'),
    slack_team_domain: attr('string'),
    slack_isbot_channel:  attr('string'),
    slack_ispublic_channel:  attr('string'),

    send_to_channel: attr('string', {defaultvalue: 'N'}),
    send_to_bot_channel: attr('string', {defaultvalue: 'N'}),

    result_admin_mode:  attr('string'),
    result_note_view_mode:  attr('string'),
    result_note_noview_mode:  attr('string'),

    attach_file: attr('', { defaultvalue: [] }),
    attach_file_url: attr('', { defaultvalue: [] }),

    unreadcnt: attr('number', { defaultvalue: 0}),
    usechat:  attr('string' , { defaultvalue: 'N'})
});

export default conferenceroom;
