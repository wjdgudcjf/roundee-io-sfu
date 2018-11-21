// import Ember from 'ember';
// // import ENV from "../config/environment";
//
// export default Ember.Object.extend( Ember.Evented, {
  // _oldWindowWidth: null,
  // _oldWindowHeight: null,
var GLOBAL_MODULE = (function(parent) {
    var preSelectedRow = null;
    var vConfState={
        inprogress:"inprogress",
        scheduled:"scheduled",
        ending: "ending",
        end:"end"
    };

    Date.prototype.format = function(f) {
        if (!this.valueOf()) return " ";

        var weekName = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
        var d = this;

        return f.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|a\/p)/gi, function($1) {
            switch ($1) {
                case "yyyy": return d.getFullYear();
                case "yy": return (d.getFullYear() % 1000).zf(2);
                case "MM": return (d.getMonth() + 1).zf(2);
                case "dd": return d.getDate().zf(2);
                case "E": return weekName[d.getDay()];
                case "HH": return d.getHours().zf(2);
                case "hh": return ((h = d.getHours() % 12) ? h : 12).zf(2);
                case "mm": return d.getMinutes().zf(2);
                case "ss": return d.getSeconds().zf(2);
                case "a/p": return d.getHours() < 12 ? "AM" : "PM";
                default: return $1;
            }
        });
    };

    String.prototype.string = function(len){var s = '', i = 0; while (i++ < len) { s += this; } return s;};
    String.prototype.zf = function(len){return "0".string(len - this.length) + this;};
    Number.prototype.zf = function(len){return this.toString().zf(len);};

    Number.prototype.noExponents= function(){
        var data= String(this).split(/[eE]/);
        if(data.length== 1) return data[0];

        var  z= '', sign= this<0? '-':'',
        str= data[0].replace('.', ''),
        mag= Number(data[1])+ 1;

        if(mag<0){
            z= sign + '0.';
            while(mag++) z += '0';
            return z + str.replace(/^\-/,'');
        }
        mag -= str.length;
        while(mag--) z += '0';
        return str + z;
    };

    function getKoDateTimeString(time){
        if(time!==undefined&&time!==null){
            return new Date(time).format("yyyy년 MM월 dd일 a/p hh시 mm분");
        }
        else{
            return new Date().format("yyyy년 MM월 dd일 a/p hh시 mm분");
        }
    }

    function getKoDateString(time){
        if(time!==undefined&&time!==null){
            return new Date(time).format("yyyy년 MM월 dd일");
        }
        else{
            return new Date().format("yyyy년 MM월 dd일");
        }
    }

    function getKoTimeString(time){
        if(time!==undefined&&time!==null){
            return new Date(time).format("a/p hh시 mm분");
        }
        else{
            return new Date().format("a/p hh시 mm분");
        }
    }

    function cloneJSON(obj) {
        // basic type deep copy
        if (obj === null || obj === undefined || typeof obj !== 'object')  {
            return obj
        }
        // array deep copy
        if (obj instanceof Array) {
            var cloneA = [];
            for (var i = 0; i < obj.length; ++i) {
                cloneA[i] = cloneJSON(obj[i]);
            }
            return cloneA;
        }
        // object deep copy
        var cloneO = {};
        for (var i in obj) {
            cloneO[i] = cloneJSON(obj[i]);
        }
        return cloneO;
    }

    function getUserColor(_userID){
        var randomColor = 'no_photo c';
        var number = 0;
        if ( _userID !== undefined && _userID !== null && _userID !== "" ){
            var userID = _userID.split('@');
            if(userID[1]===undefined||userID[1]===null){
                GLOBAL.error('00-----------');
            }
            var splitedUserID = userID[1].split('');

            for(var i=0; i<splitedUserID.length; i++){
                // 숫자인지 아닌지 본다.
                // 숫자가 아니면 아스키코드값으로 변환하여 값을 넣는다.
                // 숫자인 경우 그냥 값을 넣는다.

                if(isNaN(splitedUserID[i])){
                  number += splitedUserID[i].charCodeAt();
                }
                else{
                  number += Number(splitedUserID[i]);
                }
            }

            number = (number % 27) + 1;

            if( number < 10 ){
                randomColor = randomColor + '0' + number;
            }
            else{
                randomColor = randomColor + number;
            }
            // this.set('randomColor', randomColor);
        }

        return randomColor;
    }

    // 문자열의 초성을 가져올 수 있는 함수
    function getChoSungHangul(_str)
    {
        var cho = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
        var result = "";
        for(var i=0;i<_str.length;i++){
            var code = _str.charCodeAt(i)-44032;

            if(code>-1 && code<11172){
                result += cho[Math.floor(code/588)];
            }
        }
        return result;
    }

    // canvas로 만든 것을 blob으로 만드는 function
    function dataURItoBlob(dataURI, fileType){
        var binary = atob(dataURI.split(',')[1]);
        var array = [];

        for(var i = 0; i < binary.length; i++){
            array.push(binary.charCodeAt(i));
        }

        return new Blob([new Uint8Array(array)], {type: fileType});
    }

    // 이미지 일 때만 이렇게 thumbnail을 만들고, 파일 같은 경우는 바로 올린다. 비디오인 경우에는 어떻게 Thumbnail을 만드는지 확인한다.
    function createImageThumbnail(file, fileid){
      var self = this;

      var promise = new Ember.RSVP.Promise(function(resolve, reject){
        // 썸네일 화면 비율, 글로벌로 할 지 생각했는데 메모리에 계속해서 남아 있을 필요가 없다고 생각한다.
        var pixel_size = 480;

        var reader = new FileReader();
        var image  = new Image();
        var canvas = document.createElement("canvas");
        var blob = null;

        reader.readAsDataURL(file);
        reader.onload = function(_file) {
          image.src    = _file.target.result;              // url.createObjectURL(file);
          image.onload = function (){

            var imageWidth = this.width;
            var imageHeight = this.height;

            if(imageWidth<pixel_size && imageHeight<pixel_size) {

                canvas.width  = imageWidth;
                canvas.height = imageHeight;
            }
            else {
                if(imageWidth > imageHeight)
                {
                    canvas.width  = pixel_size;
                    canvas.height = (pixel_size*imageHeight)/imageWidth;
                }
                else if(imageWidth === imageHeight)
                {
                    canvas.width = pixel_size;
                    canvas.height = pixel_size;

                }
                else if(imageWidth < imageHeight)
                {
                    canvas.height = pixel_size;
                    canvas.width  = (pixel_size*imageWidth)/imageHeight;
                }
            }

            GLOBAL.debug('canvas.width :' + canvas.width + 'canvas.height :' + canvas.height);

            var ctx = canvas.getContext("2d");

            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            // dataURItoBlob 모듈 invoke
            blob = self.dataURItoBlob(canvas.toDataURL(file.type), file.type);
            blob.name = file.name;
            blob.height = canvas.height;
            blob.width = canvas.width;
            blob.orginWidth = imageWidth;
            blob.orginHeight = imageHeight;
            blob.title = file.title;
            blob.description = file.description;
            blob.orgfile = file;
            if(fileid!==undefined){
                blob.id = fileid;
            }
            resolve(blob);
          };
        };
        reader.onerror = function(error) {
          reject(error);
        };
      });
      return promise;
    }

    // 동영상 썸네일 만드는 function
    function createVedioThumbnail(file)
    {
        var self = this;
        var promise = new Ember.RSVP.Promise(function(resolve, reject){
            FrameGrab.blob_to_video(file).then(
                function (videoEl) {
                    var frameGrabInstance = new FrameGrab({video: videoEl});

                    videoEl.setAttribute("controls", "");

                    var pixel_data = {width:300, height:300};

                    frameGrabInstance.grab_now("canvas", '', pixel_data).then(
                        function grabbed(itemEntry) {
                            var blob = self.dataURItoBlob(itemEntry.container.toDataURL(), 'image/png');

                            var newFileName = file.name.split('.');
                            blob.name = newFileName[0]+'.png';

                            resolve(blob);
                        },

                        function failedToGrab(reason) {
                            reject(reason);
                        }
                    );
                },

                function videoFailedToRender(reason) {
                    reject(reason);
                    Ember.error('videoFailedToRender reason :', reason);
                }
            );
        });

        return promise;
    }

    function getFileInfo(_file)
    {
          var promise = new Ember.RSVP.Promise(function(resolve, reject){

            var fileInfo = null;

            var reader = new FileReader();
            var image  = new Image();

            reader.readAsDataURL(_file);
            reader.onload = function(_file) {
              image.src    = _file.target.result;

              image.onload = function (){
                fileInfo.width = this.width;
                fileInfo.height = this.height;
                resolve(fileInfo);
              };

            };
            reader.onerror = function(error) {
              Ember.error('getFileInfo error :', error);
              reject(fileInfo);
            };
        });

        return promise;
    }

    function isEnableExtension(_file)
    {
        var isEnableExtension = null;
        var file = _file;

        var ext = file.name.split('.');

        ext = ext[ext.length-1];

        // ["jpg","jpeg","png","gif","mp4","avi","mov","mkv","mpg","mpeg","3gp","pdf","txt","doc","docx","ppt","pptx","xls","xlsx"]
        if (/^(jpg|jpeg|png|gif|mp4|avi|mov|mkv|mpg|mpeg|3gp|pdf|txt|doc|docx|ppt|pptx|xls|xlsx|hwp)$/.test(ext)) {
            isEnableExtension = {
                status: true,
                ext:ext
            };
        }
        else
        {
            isEnableExtension = {
                status: false,
                ext:ext
            };
        }

        return isEnableExtension;
    }

    function isEnableProfileImageExtension(_file)
    {
        var isEnableProfileImageExtension = null;
        var file = _file;

        var ext = file.name.split('.');

        ext = ext[ext.length-1].toLowerCase();

        // ["jpg","jpeg","png","gif","mp4","avi","mov","mkv","mpg","mpeg","3gp","pdf","txt","doc","docx","ppt","pptx","xls","xlsx"]
        if (/^(jpg|jpeg|png|gif)$/.test(ext)) {
            isEnableProfileImageExtension = {
                status: true,
                ext:ext
            };
        }
        else
        {
            isEnableProfileImageExtension = {
                status: false,
                ext:ext
            };
        }

        return isEnableProfileImageExtension;
    }

    function isNotAcceptExtension(_file)
    {
        var isNotAcceptExtension = null;
        var file = _file;

        var ext = file.name.split('.');

        ext = ext[ext.length-1].toLowerCase();

        // ["jpg","jpeg","png","gif","mp4","avi","mov","mkv","mpg","mpeg","3gp","pdf","txt","doc","docx","ppt","pptx","xls","xlsx"]
        if (/^(exe)$/.test(ext)) {
            isNotAcceptExtension = {
                status: false,
                ext:ext
            };
        }
        else
        {
            isNotAcceptExtension = {
                status: true,
                ext:ext
            };
        }

        return isNotAcceptExtension;
    }

    function fileDownload(filePath, fileName)
    {
        var downloadFilePath = filePath;

        var xhr = new XMLHttpRequest();

        xhr.open("GET", downloadFilePath,true);
        // xhr.withCredentials = true;
        xhr.setRequestHeader("x-uc-fileinfo", JSON.stringify(
            {
                user:GLOBAL.getMyID(),
                token:GLOBAL.getEncData('fileToken')
            })
        );

        xhr.responseType = "blob";

        xhr.onprogress = function(evt)
        {
            if (evt.lengthComputable)
            {
              var DFING = document.getElementById("DFING");
              var DFTOTAL = document.getElementById("DFTOTAL");
              DFING.innerHTML = evt.loaded;
              DFTOTAL.innerHTML = evt.total;

              var percentComplete = parseInt((evt.loaded / evt.total) * 100);
            }
        };

        xhr.onloaad = function(data){
            if(xhr.status===200){
              var url = window.URL.createObjectURL(xhr.response);

              // var url = URL.createObjectURL(blob);
              var link = document.createElement('a');
              //
              link.setAttribute('href', url);
              link.setAttribute('download', fileName);
              link.click();
            }
            else{
                GLOBAL.error(xhr.status);
            }
        };

        xhr.send();
        // var xhr = new XMLHttpRequest();
        // xhr.open("GET", downloadFilePath, true);
        // xhr.responseType = "blob";
        // xhr.withCredentials = true;
        // xhr.setRequestHeader("Access-Control-Allow-Origin", "*");
        // xhr.setRequestHeader("x-uc-fileinfo", JSON.stringify(
        //     {
        //         user:GLOBAL.getMyID(),
        //         token:GLOBAL.getEncData('fileToken')
        //     })
        // );
        //
        // xhr.onprogress = function(evt)
        // {
        //     // if (evt.lengthComputable)
        //     // {
        //     //   var DFING = document.getElementById("DFING");
        //     //   var DFTOTAL = document.getElementById("DFTOTAL");
        //     //   DFING.innerHTML = evt.loaded;
        //     //   DFTOTAL.innerHTML = evt.total;
        //     //
        //     //   var percentComplete = parseInt((evt.loaded / evt.total) * 100);
        //     // }
        // };
        //
        // xhr.onload = function (data) {
        //     // download 성공 시
        //     if (xhr.status === 200)
        //     {
        //
        //           var url = window.URL.createObjectURL(xhr.response);
        //
        //           // var url = URL.createObjectURL(blob);
        //           var link = document.createElement('a');
        //           //
        //           link.setAttribute('href', url);
        //           link.setAttribute('download', fileName);
        //           link.click();
        //     }
        //     // download 실패 시
        //     else
        //     {
        //         alert("An error occurred!", data);
        //     }
        // };
        //
        // xhr.send();
    }

    function desktopNoti(msg){
      if (Notification.permission === "granted") {
          // If it's okay let's create a notification
          var n = new Notification(msg);
          setTimeout(n.close.bind(n), 3000);
        }
    }

    function getUserInfo(userInfo){
        var userInfo = '';
        var myInfo = ucDB.userInfo.getInfo(GLOBAL.getMyID());
        var userComID = userInfo.comID;
        if(myInfo.comID===userComID){
            userInfo = Ti.Locale.currentLanguag==='ko'?userInfo.position:userInfo.engPosition;
            if(userInfo===undefined||userInfo===null||userInfo===''){
                userInfo = Ti.Locale.currentLanguag==='ko'?userInfo.jobTitle:userInfo.engJobTitle;
            }
        }
        else{
            userInfo = Ti.Locale.currentLanguag==='ko'?userInfo.position:userInfo.engPosition;
            if(userInfo===undefined||userInfo===null||userInfo===''){
                userInfo = Ti.Locale.currentLanguag==='ko'?userInfo.jobTitle:userInfo.engJobTitle;
            }
            userInfo = userInfo + '/' + Ti.Locale.currentLanguag==='ko'?userInfo.comName:userInfo.engComName;
        }
    }

    function getJobTitle(userInfo){
        var jobTitle = '';
        jobTitle = Ti.Locale.currentLanguag==='ko'?userInfo.position:userInfo.engPosition;
        if(jobTitle===undefined||jobTitle===null||jobTitle===''){
            jobTitle = Ti.Locale.currentLanguag==='ko'?userInfo.jobTitle:userInfo.engJobTitle;
        }
        return jobTitle;
    }

    function getDepartMentName(userInfo){
        var departName = '';
        departName = Ti.Locale.currentLanguag==='ko'?userInfo.prtName:userInfo.engPrtName;
        return departName;
    }

    function getConfID(){
        var authinfo = sessionStorage.getItem("roundee_io:auth");
        authinfo = GLOBAL.transStrToObj(authinfo);
        // authinfo = authinfo.authenticated;
        return authinfo.roomid;
    }

    // function getMinutesOrder(divvalue){
    //     var divided = function(value, reminder){
    //         var floattype = false;
    //         var valuelength = value.length;
    //         var tempresult = "";
    //
    //         if(reminder===undefined){
    //             reminder = 0;
    //         }
    //         else{
    //             floattype = true;
    //         }
    //
    //         for(var i=0; i<valuelength; i++){
    //             var tempvalue = parseInt(value.substr(i,1));
    //             var dividingvalue = parseInt( (reminder*10)+tempvalue );
    //             var dividedelementresult = parseInt(dividingvalue/2);
    //             if(!(tempresult===""&&dividedelementresult===0)){
    //                 tempresult += dividedelementresult.toString();
    //             }
    //             reminder = parseInt(dividingvalue%2);
    //         }
    //
    //         return {result: tempresult===""?"0":tempresult, reminder: reminder};
    //     };
    //
    //
    //     var temp = divvalue.split(".");
    //     var result = "";
    //
    //     if(temp.length===1){
    //         var calvalue = divided(temp[0]);
    //         if(calvalue.reminder!==0){
    //             result = calvalue.result + "." + divided("0", calvalue.reminder).result;
    //         }
    //         else{
    //             result = calvalue.result;
    //         }
    //     }
    //     else if(temp.length===2){
    //         var calvalue = divided(temp[0]);        // 앞자리 계산.
    //
    //         // 여기 계산이 틀렸음. 다시 해야 함 test는 value는 2500000.1
    //         if(calvalue.reminder!==0){              // 앞자리 계산시점에 나머지가 있는 경우.
    //             var floatresult = divided(temp[1], calvalue.reminder);
    //             result = calvalue.result + "." + floatresult.result;
    //             if(floatresult.reminder!==0){
    //                 result = result + divided("0", floatresult.reminder).result;
    //             }
    //         }
    //         else{
    //             var floatresult = divided(temp[1]);
    //             result = calvalue.result + "." + floatresult.result;
    //             if(floatresult.reminder!==0){
    //                  result = result + divided("0", floatresult.reminder).result;
    //             }
    //         }
    //     }
    //
    //     return result;
    // }
    //
    // function stringPlus(arg1, arg2){
    //     var stringpluscalculator=function(a, b, carry){
    //         var length1 = a.length;
    //         var length2 = b.length;
    //         var result = "";
    //         var length = length1;
    //         var tempnumber = "";
    //
    //         if(length1>length2){
    //             length = length1;
    //             for(var i=0; i< length1-length2; i++){
    //                 tempnumber += "0";
    //             }
    //             b = tempnumber + b;
    //         }
    //         else if( length2 > length1 ){
    //             length = length2;
    //             for(var i=0; i< length2-length1; i++){
    //                 tempnumber += "0";
    //             }
    //             a = tempnumber + a;
    //         }
    //
    //         for(var i=0; i<length; i++){
    //             var num1 = parseInt(a.substr((length-1-i), 1));
    //             var num2 = parseInt(b.substr((length-1-i), 1));
    //
    //             var sum = num1+num2+carry;
    //             carry = parseInt(sum/10);
    //             result = result + (sum % 10).toString();
    //         }
    //
    //         if(carry!==0){
    //             result += carry.toString();
    //         }
    //         return result.split("").reverse().join("");
    //     };
    //
    //     var stringpluscalculator2=function(a, b){
    //         a = a===undefined?"":a;
    //         b = b===undefined?"":b;
    //
    //         var length1 = a.length;
    //         var length2 = b.length;
    //         var result = "";
    //         var length = length1;
    //         var floatcarry = 0;
    //
    //         if(length1>length2){
    //             length = length1;
    //             for(var i=0; i< length1-length2; i++){
    //                 b += "0";
    //             }
    //         }
    //         else if( length2 > length1 ){
    //             length = length2;
    //             for(var i=0; i< length2-length1; i++){
    //                 a += "0";
    //             }
    //         }
    //
    //         for(var i=0; i<length; i++){
    //             var num1 = parseInt(a.substr((length-1-i), 1));
    //             var num2 = parseInt(b.substr((length-1-i), 1));
    //
    //             var sum = num1+num2+floatcarry;
    //             floatcarry = parseInt(sum/10);
    //             result = result + (sum % 10).toString();
    //         }
    //         return {result:result.split("").reverse().join(""), carry: floatcarry};
    //     };
    //
    //     var value1 = arg1.split(".");
    //     var value2 = arg2.split(".");
    //     var result1 = "";
    //     var result2 = "";
    //     var floattype = false;
    //
    //     if(value1[1]!==undefined||value2[1]!==undefined){
    //         floattype = true;
    //         result1 = stringpluscalculator2(arg1.split(".")[1], arg2.split(".")[1]);
    //     }
    //     result2 = stringpluscalculator(arg1.split(".")[0], arg2.split(".")[0], result1===""?0:result1.carry);
    //     return floattype===true?(result2+"."+result1.result):result2;
    // }

    function getFileType(filename){
        var type = "doc";
        var fileseperator = filename.split('.');
        var exttype = fileseperator[fileseperator.length-1].toLowerCase();

        if ( exttype === 'png' || exttype === 'jpg' || exttype === 'jpeg' || exttype === 'gif' || exttype === 'bmp' || exttype === 'psd' || exttype === 'tiff' ){
            return "image";
        }
        else if ( exttype === 'doc' || exttype === 'docx' || exttype === 'pdf' || exttype === 'xls' || exttype === 'xlsx' || exttype === 'ppt' || exttype === 'pptx' || exttype === 'txt' ){
            return "doc";
        }
        else if ( exttype === 'mp4' || exttype === 'webm' || exttype === 'ogg' ){
            return "video";
        }
        else if ( exttype === 'mp3' || exttype === 'wav' || exttype === 'ogg'){
            return "audio";
        }
        else if( exttype === 'zip' || exttype === 'alz' || exttype === 'tar' || exttype === 'tgz' || exttype === 'rar' || exttype === 'gz' ){
            return "zip";
        }
        else{
            return "etc";
        }
    }

    function validURL(url) {
	   var pattern = /^(http[s]?:\/\/){0,1}(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/;
	   if (!pattern.test(url)) {
        return false;
      } else {
        return true;
      }
    }

    function validEmail(email) {
      //var pattern = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/;
      var pattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      if (!pattern.test(email)) {
         return false;
       } else {
         return true;
       }
    }

    return {
                getKoDateTimeString: getKoDateTimeString,
                getKoDateString: getKoDateString,
                getKoTimeString: getKoTimeString,
                getUserColor: getUserColor,
                cloneJSON: cloneJSON,
                getChoSungHangul: getChoSungHangul,
                dataURItoBlob: dataURItoBlob,
                createImageThumbnail: createImageThumbnail,
                createVedioThumbnail: createVedioThumbnail,
                getFileInfo: getFileInfo,
                isEnableExtension: isEnableExtension,
                isNotAcceptExtension: isNotAcceptExtension,
                fileDownload: fileDownload,
                isEnableProfileImageExtension: isEnableProfileImageExtension,
                getUserInfo: getUserInfo,
                getJobTitle: getJobTitle,
                getDepartMentName: getDepartMentName,
                getConfID: getConfID,
                vConfState: vConfState,
                preSelectedRow: preSelectedRow,
                // getMinutesOrder: getMinutesOrder
                // stringPlus: stringPlus,
                validURL: validURL,
                validEmail: validEmail,
                getFileType: getFileType
            }
})(this);
