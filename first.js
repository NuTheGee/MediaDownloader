function getCurrentTabUrl(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    var url = tab.url;
    console.assert(typeof url == 'string', 'tab.url should be a string');
    callback(url);
  });
}

function getData(url, callback) {
  var searchUrl = url;
  var x = new XMLHttpRequest();
  x.open('GET', searchUrl);
  x.onload = function() {
    var response = x.response;
    callback(response);
  };
  x.onerror = function() {
    renderStatus("http: 잘못된 URL입니다.");
  };
  x.send();
}

function putContent(id, content) {
  document.getElementById(id).textContent = content;
}

function putList(id, list) {
    var target = document.getElementById(id);
    var ul = document.createElement("ul");
    for(var i = 0; i < list.length; i++){
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.appendChild(document.createTextNode(unescape(list[i].type)));
        a.target = "_blank";
        a.href = list[i].url;
        li.appendChild(a);
        ul.appendChild(li);
    }
    target.appendChild(ul);
}

var Domain = ["youtube.com", "facebook.com", "tv.naver.com", "sports.naver.com", "sports.news.naver.com"];
var Info = [[/v=([a-zA-Z0-9_-]{11})/, /ytplayer.config = ({.+?});ytplayer.load/],
            [/\/([0-9]{17})\//, /(?:FBQualityLabel=\\"([0-9p]+)\\">)?\\x3CBaseURL>(.+?)\\x3C\/BaseURL>/g],
            [/v\/([0-9]{3,7})/, /vid=([A-F0-9]+)&outKey=(V[a-f0-9]+)&/],
            [/[?&]id=([0-9]{6})/, /videoCenterConstants.currentClipNo = '([0-9]+)';/],
            [/[?&]id=([0-9]{6})/]
           ];

var current = {"index": -1, "method": null, "filename": "noname", "result": []};

////////////////////////////////////////
//  유튜브 동영상 signature 만드는 자바스크립트 코드
//  base.js의 일부
////////////////////////////////////////

Um = function(a){
    a = a.split("");
    Tm.wk(a,2);
    Tm.u1(a,48);
    Tm.o3(a,74);
    Tm.wk(a,2);
    Tm.u1(a,40);
    Tm.o3(a,54);
    Tm.u1(a,5);
    Tm.o3(a,45);
    return a.join("");
};

var Tm = {
    
    u1: function(a,b){
        var c = a[0];
        a[0] = a[b%a.length];
        a[b] = c;
    },
    
    wk: function(a,b){
        a.splice(0,b);
    },
    
    o3: function(a){
        a.reverse();
    }
};

function sign(s){
    return Um(s);
}

////////////////////////////////////////

function youtube(data) {
    var rex = Info[0][1];
    var target = JSON.parse(rex.exec(data)[1]).args;
    current.filename = (target.author + "_" + target.title).replace(/[|?/\n\r\t\\]/g, "");
    console.log(current.filename);
    var videos1 = target.url_encoded_fmt_stream_map.split(",");
    var videos2 = target.adaptive_fmts.split(",");
    var videos = videos1.concat(videos2);
    var result = [];
    for(var i = 0; i < videos.length; i++){
        var temp = {};
        var items = videos[i].split("&");
        for(var j = 0; j < items.length; j++){
            var pair = items[j].split("=");
            temp[pair[0]] = pair[1];
        }
        if(temp.url.includes("signature")) temp.url = unescape(temp.url);
        else temp.url = unescape(temp.url) + "&signature=" + sign(temp.s);
        result.push(temp);
    }
    return result;
}

function facebook(data){
    var rex_title = /<title id="pageTitle">([^<]+)<\/title>/;
    current.filename = rex_title.exec(data)[1].replace(/[|?/\n\r\t\\]/g, "");
    console.log(current.filename);
    var rex = Info[1][1];
    var result = [];
    var match = rex.exec(data);
    while(match != null){
        var temp = {};
        var url = unescape(match[2]).replace(/&amp;/g, "&");
        temp.url = url;
        temp.type = (match[1])? match[1] : "audio";
        result.push(temp);
        match = rex.exec(data);
    }
    return result;
}

function navertv(data) {
    var rex = Info[2][1];
    var match = rex.exec(data);
    var url = "http://play.rmcnmv.naver.com/vod/play/" + match[1] + "?key=" + match[2];
    getData(url, function(data){
        var obj = JSON.parse(data);
        current.filename = obj.meta.user.name + "_" + obj.meta.subject;
        var target = obj.videos.list;
        for(var i = 0; i < target.length; i++){
            var temp = {};
            temp.type = target[i].encodingOption.name;
            temp.url = target[i].source;
            current.result.push(temp);
        }
        putList("result", current.result);
    });
}

function naversports(data) {
    var rex = Info[3][1];
    var match = rex.exec(data);
    var url = "http://tv.naver.com/v/" + match[1];
    getData(url, function(data){
        navertv(data);
    });    
}

////////////////////////////////////////

document.addEventListener('DOMContentLoaded', function() {
    getCurrentTabUrl(function(url) {
        for(var i = 0; i < Domain.length; i++){
            if(url.includes(Domain[i])){
                current.index = i;
                if (current.index == 0) current.method = youtube;
                else if (current.index == 1) current.method = facebook;
                else if (current.index == 2) current.method = navertv;
                else current.method = naversports;
                var vid = Info[current.index][0].exec(url);
                if(vid != null) putContent("result", Domain[current.index] + ": " + vid[1]);
                else putContent("status", "동영상 아이디를 찾을 수 없습니다.");
                getData(url, function(data){
                    if(current.index < 2){
                        var result = current.method(data);
                        putList("result", result);
                    }
                    else{
                        current.method(data);
                    }
                });
                break;
            }
        }
        if(current.index < 0){
            putContent("status", "지원하지않는 사이트입니다.");
        }
    });
});

chrome.downloads.onDeterminingFilename.addListener(function(item, suggest) {
  suggest({filename: current.filename + "_" + item.fileSize + "." + item.mime.split("/")[1],
           conflictAction: "uniquify"});
});
