import DS from 'ember-data';
const {Model, attr} = DS;

let recording = Model.extend({
    userid: attr('string', {defaultvalue:''}),
    start_time: attr(''),
    end_time: attr('')
});

export default recording;
